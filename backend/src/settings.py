from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
TRUE_VALUES = {"1", "true", "yes"}
LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


class ConfigurationError(ValueError):
    """Geçersiz environment ayarlarında yükseltilir."""


def _read_positive_int(
    values: Mapping[str, str],
    name: str,
    default: int,
) -> int:
    raw_value = values.get(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as exception:
        raise ConfigurationError(f"{name} tam sayı olmalıdır.") from exception
    if value <= 0:
        raise ConfigurationError(f"{name} sıfırdan büyük olmalıdır.")
    return value


def _read_origins(values: Mapping[str, str]) -> tuple[str, ...]:
    raw_origins = values.get(
        "EMARKET_ALLOWED_ORIGINS",
        ",".join(DEFAULT_ALLOWED_ORIGINS),
    )
    origins = tuple(
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    )
    if not origins:
        raise ConfigurationError("EMARKET_ALLOWED_ORIGINS boş olamaz.")
    if "*" in origins:
        raise ConfigurationError(
            "Credential kullanılan CORS ayarında '*' kullanılamaz."
        )
    return origins


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    session_ttl_minutes: int = 60
    cookie_secure: bool = False
    allowed_origins: tuple[str, ...] = DEFAULT_ALLOWED_ORIGINS
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    session_cookie_name: str = "emarket_admin_session"
    csrf_cookie_name: str = "emarket_admin_csrf"
    log_level: str = "INFO"

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
    ) -> "Settings":
        # Gerçek gizli değerler yalnızca yerel .env/ortamdan okunur;
        # kaynak koda ve örnek dosyalara yazılmaz.
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        values = environ if environ is not None else os.environ
        log_level = values.get("EMARKET_LOG_LEVEL", "INFO").upper()
        if log_level not in LOG_LEVELS:
            raise ConfigurationError(
                "EMARKET_LOG_LEVEL DEBUG, INFO, WARNING, ERROR veya CRITICAL olmalıdır."
            )

        return cls(
            environment=values.get("EMARKET_ENV", "development"),
            session_ttl_minutes=_read_positive_int(
                values,
                "EMARKET_SESSION_TTL_MINUTES",
                60,
            ),
            cookie_secure=values.get("EMARKET_COOKIE_SECURE", "false").lower()
            in TRUE_VALUES,
            allowed_origins=_read_origins(values),
            login_max_attempts=_read_positive_int(
                values,
                "EMARKET_LOGIN_MAX_ATTEMPTS",
                5,
            ),
            login_lock_minutes=_read_positive_int(
                values,
                "EMARKET_LOGIN_LOCK_MINUTES",
                15,
            ),
            log_level=log_level,
        )
