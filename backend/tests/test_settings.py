from __future__ import annotations

import pytest

from src.settings import ConfigurationError, Settings


def test_settings_parse_and_normalize_environment_values() -> None:
    settings = Settings.from_env(
        {
            "EMARKET_ENV": "test",
            "EMARKET_SESSION_TTL_MINUTES": "90",
            "EMARKET_COOKIE_SECURE": "yes",
            "EMARKET_ALLOWED_ORIGINS": "http://localhost:5173, http://app.test",
            "EMARKET_LOGIN_MAX_ATTEMPTS": "4",
            "EMARKET_LOGIN_LOCK_MINUTES": "20",
            "EMARKET_LOG_LEVEL": "warning",
        }
    )

    assert settings.environment == "test"
    assert settings.session_ttl_minutes == 90
    assert settings.cookie_secure is True
    assert settings.allowed_origins == (
        "http://localhost:5173",
        "http://app.test",
    )
    assert settings.login_max_attempts == 4
    assert settings.login_lock_minutes == 20
    assert settings.log_level == "WARNING"


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("EMARKET_SESSION_TTL_MINUTES", "invalid"),
        ("EMARKET_LOGIN_MAX_ATTEMPTS", "0"),
        ("EMARKET_ALLOWED_ORIGINS", ""),
        ("EMARKET_ALLOWED_ORIGINS", "*"),
        ("EMARKET_LOG_LEVEL", "VERBOSE"),
    ],
)
def test_settings_reject_invalid_values(name: str, value: str) -> None:
    with pytest.raises(ConfigurationError):
        Settings.from_env({name: value})
