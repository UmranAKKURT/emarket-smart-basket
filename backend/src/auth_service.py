from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from src.auth_repository import AuthRepository
from src.security import Security
from src.settings import Settings


class AuthServiceError(Exception): pass
class InvalidCredentialsError(AuthServiceError): pass
class AccountLockedError(AuthServiceError): pass
class InactiveAccountError(AuthServiceError): pass
class UnauthorizedError(AuthServiceError): pass
class ForbiddenError(AuthServiceError): pass
class CsrfValidationError(AuthServiceError): pass
class WeakPasswordError(AuthServiceError): pass


class AuthService:
    def __init__(self, repository: AuthRepository, security: Security, settings: Settings) -> None:
        self.repository = repository
        self.security = security
        self.settings = settings

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

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
        normalized = self._normalize_email(email)
        if self.repository.get_user_by_email(normalized):
            raise AuthServiceError("Bu e-posta adresi zaten kayıtlı.")
        try:
            password_hash = self.security.hash_password(password)
        except ValueError as exception:
            raise WeakPasswordError(str(exception)) from exception
        user_id = self.repository.create_user(normalized, password_hash, "admin", True)
        return self._public_user(self.repository.get_user_by_id(user_id))

    def login(self, email: str, password: str, user_agent: str | None, ip_address: str | None) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        user = self.repository.get_user_by_email(self._normalize_email(email))
        if user is None:
            raise InvalidCredentialsError("E-posta veya parola hatalı.")
        if not bool(user["is_active"]):
            raise InactiveAccountError("Hesap aktif değil.")
        if user["locked_until"]:
            locked_until = datetime.fromisoformat(user["locked_until"])
            if locked_until > now:
                raise AccountLockedError("Hesap geçici olarak kilitlendi. Daha sonra tekrar deneyin.")

        verified, updated_hash = self.security.verify_and_update_password(password, user["password_hash"])
        if not verified:
            attempts = int(user["failed_login_attempts"]) + 1
            lock_until = None
            if attempts >= self.settings.login_max_attempts:
                lock_until = (now + timedelta(minutes=self.settings.login_lock_minutes)).isoformat(timespec="seconds")
            self.repository.record_failed_login(user["id"], attempts, lock_until)
            raise InvalidCredentialsError("E-posta veya parola hatalı.")

        if updated_hash:
            self.repository.update_password(user["id"], updated_hash)
        timestamp = now.isoformat(timespec="seconds")
        self.repository.reset_failed_login(user["id"])
        self.repository.update_last_login(user["id"], timestamp)
        self.repository.delete_expired_sessions(timestamp)

        raw_session = self.security.generate_session_token()
        raw_csrf = self.security.generate_csrf_token()
        expires_at = (now + timedelta(minutes=self.settings.session_ttl_minutes)).isoformat(timespec="seconds")
        self.repository.create_session(
            user_id=user["id"], token_hash=self.security.hash_token(raw_session),
            csrf_token_hash=self.security.hash_token(raw_csrf), created_at=timestamp,
            expires_at=expires_at, last_seen_at=timestamp, user_agent=user_agent,
            ip_address=ip_address,
        )
        refreshed = self.repository.get_user_by_id(user["id"])
        return {"user": self._public_user(refreshed), "session_token": raw_session, "csrf_token": raw_csrf, "expires_at": expires_at}

    def authenticate_session(self, raw_session_token: str | None) -> dict[str, Any]:
        if not raw_session_token:
            raise UnauthorizedError("Geçerli bir admin oturumu gerekli.")
        token_hash = self.security.hash_token(raw_session_token)
        session = self.repository.get_active_session_by_token_hash(token_hash)
        if session is None:
            raise UnauthorizedError("Geçerli bir admin oturumu gerekli.")
        now = datetime.now(timezone.utc)
        if datetime.fromisoformat(session["expires_at"]) <= now:
            self.repository.revoke_session(token_hash, now.isoformat(timespec="seconds"))
            raise UnauthorizedError("Admin oturumunun süresi doldu.")
        if not bool(session["is_active"]):
            raise UnauthorizedError("Geçerli bir admin oturumu gerekli.")
        self.repository.touch_session(token_hash, now.isoformat(timespec="seconds"))
        return {**self._public_user(session), "csrf_token_hash": session["csrf_token_hash"]}

    def require_admin(self, raw_session_token: str | None) -> dict[str, Any]:
        user = self.authenticate_session(raw_session_token)
        if user["role"] != "admin":
            raise ForbiddenError("Bu işlem için admin yetkisi gerekli.")
        return user

    def validate_csrf(self, raw_session_token: str | None, csrf_header: str | None) -> dict[str, Any]:
        user = self.require_admin(raw_session_token)
        if not csrf_header or not self.security.verify_token(csrf_header, user["csrf_token_hash"]):
            raise CsrfValidationError("CSRF doğrulaması başarısız.")
        return user

    def logout(self, raw_session_token: str | None) -> None:
        if raw_session_token:
            self.repository.revoke_session(
                self.security.hash_token(raw_session_token),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            )
