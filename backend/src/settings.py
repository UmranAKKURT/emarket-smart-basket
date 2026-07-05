from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Security architecture:
# - The admin session is kept in an HttpOnly cookie; only its hash is stored.
# - State-changing admin requests require a CSRF token.
# - Backend dependencies protect every admin endpoint.
# - Production requires HTTPS and Secure cookies, plus gateway rate limiting.
# - Real secrets and passwords must never be committed to Git.

# Production: HTTPS + Secure cookie zorunlu tutulmalı; reverse proxy/gateway
# seviyesinde ek rate limiting uygulanmalı ve gerçek parolalar Git'e eklenmemelidir.

@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    session_ttl_minutes: int = 60
    cookie_secure: bool = False
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    session_cookie_name: str = "emarket_admin_session"
    csrf_cookie_name: str = "emarket_admin_csrf"

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "EMARKET_ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        )
        return cls(
            environment=os.getenv("EMARKET_ENV", "development"),
            session_ttl_minutes=int(os.getenv("EMARKET_SESSION_TTL_MINUTES", "60")),
            cookie_secure=os.getenv("EMARKET_COOKIE_SECURE", "false").lower()
            in {"1", "true", "yes"},
            allowed_origins=origins,
            login_max_attempts=int(os.getenv("EMARKET_LOGIN_MAX_ATTEMPTS", "5")),
            login_lock_minutes=int(os.getenv("EMARKET_LOGIN_LOCK_MINUTES", "15")),
        )
