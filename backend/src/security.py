from __future__ import annotations

import hashlib
import hmac
import secrets

from pwdlib import PasswordHash


class Security:
    def __init__(self) -> None:
        self.password_hash = PasswordHash.recommended()

    @staticmethod
    def validate_password(password: str) -> None:
        if not isinstance(password, str) or not 12 <= len(password) <= 128:
            raise ValueError("Parola 12 ile 128 karakter arasında olmalıdır.")
        if not password.strip():
            raise ValueError("Parola boş olamaz.")

    def hash_password(self, password: str) -> str:
        self.validate_password(password)
        return self.password_hash.hash(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            return self.password_hash.verify(password, password_hash)
        except (ValueError, TypeError):
            return False

    def verify_and_update_password(
        self,
        password: str,
        password_hash: str,
    ) -> tuple[bool, str | None]:
        try:
            return self.password_hash.verify_and_update(password, password_hash)
        except (ValueError, TypeError):
            return False, None

    @staticmethod
    def generate_session_token() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def generate_csrf_token() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def verify_token(self, raw_token: str, expected_hash: str) -> bool:
        return hmac.compare_digest(self.hash_token(raw_token), expected_hash)
