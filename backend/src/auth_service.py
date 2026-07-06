from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from src.auth_repository import AuthRepository
from src.security import Security
from src.settings import Settings


INVALID_CREDENTIALS_MESSAGE = "E-posta veya parola hatalı."
UNAUTHORIZED_MESSAGE = "Geçerli bir admin oturumu gerekli."
TIMESTAMP_PRECISION = "seconds"


class AuthServiceError(Exception):
    """Kimlik doğrulama servisindeki hataların temel sınıfı."""


class InvalidCredentialsError(AuthServiceError):
    """Giriş bilgileri doğrulanamadığında yükseltilir."""


class AccountLockedError(AuthServiceError):
    """Geçici hesap kilidi etkin olduğunda yükseltilir."""


class InactiveAccountError(AuthServiceError):
    """Pasif kullanıcı giriş yapmaya çalıştığında yükseltilir."""


class UnauthorizedError(AuthServiceError):
    """Geçerli bir oturum bulunmadığında yükseltilir."""


class ForbiddenError(AuthServiceError):
    """Kullanıcı gerekli role sahip olmadığında yükseltilir."""


class CsrfValidationError(AuthServiceError):
    """CSRF token doğrulanamadığında yükseltilir."""


class WeakPasswordError(AuthServiceError):
    """Parola güvenlik politikasına uymadığında yükseltilir."""


class AuthService:
    """Admin hesap, giriş ve iptal edilebilir session akışını yönetir."""

    def __init__(
        self,
        repository: AuthRepository,
        security: Security,
        settings: Settings,
    ) -> None:
        self.repository = repository
        self.security = security
        self.settings = settings

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _timestamp(value: datetime) -> str:
        return value.isoformat(timespec=TIMESTAMP_PRECISION)

    @staticmethod
    def _public_user(user: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": int(user.get("user_id", user.get("id"))),
            "email": user["email"],
            "role": user["role"],
            "is_active": bool(user["is_active"]),
            "created_at": user.get("user_created_at", user.get("created_at")),
            "last_login_at": user.get("last_login_at"),
        }

    def create_admin(self, email: str, password: str) -> dict[str, Any]:
        normalized_email = self._normalize_email(email)
        if self.repository.get_user_by_email(normalized_email):
            raise AuthServiceError("Bu e-posta adresi zaten kayıtlı.")

        try:
            password_hash = self.security.hash_password(password)
        except ValueError as exception:
            raise WeakPasswordError(str(exception)) from exception

        user_id = self.repository.create_user(
            normalized_email,
            password_hash,
            "admin",
            True,
        )
        return self._public_user(self.repository.get_user_by_id(user_id))

    def login(
        self,
        email: str,
        password: str,
        user_agent: str | None,
        ip_address: str | None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        user = self.repository.get_user_by_email(self._normalize_email(email))

        self._validate_login_candidate(user, now)
        verified, updated_hash = self.security.verify_and_update_password(
            password,
            user["password_hash"],
        )
        if not verified:
            self._record_failed_login(user, now)
            raise InvalidCredentialsError(INVALID_CREDENTIALS_MESSAGE)

        if updated_hash:
            self.repository.update_password(user["id"], updated_hash)

        timestamp = self._timestamp(now)
        self.repository.reset_failed_login(user["id"])
        self.repository.update_last_login(user["id"], timestamp)
        self.repository.delete_expired_sessions(timestamp)

        session = self._create_session(
            user_id=user["id"],
            now=now,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        refreshed_user = self.repository.get_user_by_id(user["id"])
        return {"user": self._public_user(refreshed_user), **session}

    def _validate_login_candidate(
        self,
        user: dict[str, Any] | None,
        now: datetime,
    ) -> None:
        if user is None:
            raise InvalidCredentialsError(INVALID_CREDENTIALS_MESSAGE)
        if not bool(user["is_active"]):
            raise InactiveAccountError("Hesap aktif değil.")
        if user["locked_until"]:
            locked_until = datetime.fromisoformat(user["locked_until"])
            if locked_until > now:
                raise AccountLockedError(
                    "Hesap geçici olarak kilitlendi. Daha sonra tekrar deneyin."
                )

    def _record_failed_login(
        self,
        user: dict[str, Any],
        now: datetime,
    ) -> None:
        failed_attempts = int(user["failed_login_attempts"]) + 1
        locked_until = None
        if failed_attempts >= self.settings.login_max_attempts:
            locked_until = self._timestamp(
                now + timedelta(minutes=self.settings.login_lock_minutes)
            )
        self.repository.record_failed_login(
            user["id"],
            failed_attempts,
            locked_until,
        )

    def _create_session(
        self,
        user_id: int,
        now: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> dict[str, str]:
        raw_session = self.security.generate_session_token()
        raw_csrf = self.security.generate_csrf_token()
        created_at = self._timestamp(now)
        expires_at = self._timestamp(
            now + timedelta(minutes=self.settings.session_ttl_minutes)
        )
        self.repository.create_session(
            user_id=user_id,
            token_hash=self.security.hash_token(raw_session),
            csrf_token_hash=self.security.hash_token(raw_csrf),
            created_at=created_at,
            expires_at=expires_at,
            last_seen_at=created_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        return {
            "session_token": raw_session,
            "csrf_token": raw_csrf,
            "expires_at": expires_at,
        }

    def authenticate_session(
        self,
        raw_session_token: str | None,
    ) -> dict[str, Any]:
        if not raw_session_token:
            raise UnauthorizedError(UNAUTHORIZED_MESSAGE)

        token_hash = self.security.hash_token(raw_session_token)
        session = self.repository.get_active_session_by_token_hash(token_hash)
        if session is None:
            raise UnauthorizedError(UNAUTHORIZED_MESSAGE)

        now = datetime.now(timezone.utc)
        timestamp = self._timestamp(now)
        if datetime.fromisoformat(session["expires_at"]) <= now:
            self.repository.revoke_session(token_hash, timestamp)
            raise UnauthorizedError("Admin oturumunun süresi doldu.")
        if not bool(session["is_active"]):
            raise UnauthorizedError(UNAUTHORIZED_MESSAGE)

        self.repository.touch_session(token_hash, timestamp)
        return {
            **self._public_user(session),
            "csrf_token_hash": session["csrf_token_hash"],
        }

    def require_admin(self, raw_session_token: str | None) -> dict[str, Any]:
        user = self.authenticate_session(raw_session_token)
        if user["role"] != "admin":
            raise ForbiddenError("Bu işlem için admin yetkisi gerekli.")
        return user

    def validate_csrf(
        self,
        raw_session_token: str | None,
        csrf_header: str | None,
    ) -> dict[str, Any]:
        user = self.require_admin(raw_session_token)
        csrf_is_valid = csrf_header and self.security.verify_token(
            csrf_header,
            user["csrf_token_hash"],
        )
        if not csrf_is_valid:
            raise CsrfValidationError("CSRF doğrulaması başarısız.")
        return user

    def logout(self, raw_session_token: str | None) -> None:
        if not raw_session_token:
            return

        self.repository.revoke_session(
            self.security.hash_token(raw_session_token),
            self._timestamp(datetime.now(timezone.utc)),
        )
