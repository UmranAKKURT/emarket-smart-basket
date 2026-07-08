from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from src.api import ApplicationContainer


def login(client: TestClient, email: str, password: str):
    return client.post(
        "/api/v1/auth/admin/login",
        json={"email": email, "password": password},
    )


def test_admin_password_is_argon2_not_plaintext(
    container: ApplicationContainer,
    admin_user: dict,
    admin_password: str,
) -> None:
    stored = container.auth_repository.get_user_by_id(admin_user["id"])
    assert stored["password_hash"] != admin_password
    assert stored["password_hash"].startswith("$argon2id$")


def test_login_sets_secure_session_cookie_properties(
    unauthenticated_client: TestClient,
    admin_user: dict,
    admin_password: str,
) -> None:
    response = login(unauthenticated_client, admin_user["email"], admin_password)
    cookies = response.headers.get_list("set-cookie")
    session_cookie = next(value for value in cookies if value.startswith("emarket_admin_session="))
    assert response.status_code == 200
    assert "HttpOnly" in session_cookie
    assert "SameSite=lax" in session_cookie
    assert "emarket_admin_session" in response.cookies


def test_csrf_cookie_is_readable_but_database_stores_only_hash(
    unauthenticated_client: TestClient,
    container: ApplicationContainer,
    admin_user: dict,
    admin_password: str,
) -> None:
    response = login(unauthenticated_client, admin_user["email"], admin_password)
    cookies = response.headers.get_list("set-cookie")
    csrf_cookie = next(value for value in cookies if value.startswith("emarket_admin_csrf="))
    raw_csrf = unauthenticated_client.cookies.get("emarket_admin_csrf")
    with container.db_helper.get_connection() as connection:
        row = connection.execute("SELECT csrf_token_hash FROM admin_sessions").fetchone()
    assert "HttpOnly" not in csrf_cookie
    assert row["csrf_token_hash"] != raw_csrf
    assert row["csrf_token_hash"] == container.security.hash_token(raw_csrf)


@pytest.mark.parametrize("email", ["admin@example.com", "missing@example.com"])
def test_wrong_credentials_share_general_401_message(
    unauthenticated_client: TestClient,
    admin_user: dict,
    email: str,
) -> None:
    response = login(unauthenticated_client, email, "WrongPassword!2026")
    assert response.status_code == 401
    assert response.json()["detail"] == "E-posta veya parola hatalı."


def test_failed_attempts_lock_account(
    unauthenticated_client: TestClient,
    admin_user: dict,
) -> None:
    for _ in range(3):
        assert login(unauthenticated_client, admin_user["email"], "WrongPassword!2026").status_code == 401
    assert login(unauthenticated_client, admin_user["email"], "WrongPassword!2026").status_code == 429


def test_successful_login_resets_failed_attempts(
    unauthenticated_client: TestClient,
    container: ApplicationContainer,
    admin_user: dict,
    admin_password: str,
) -> None:
    login(unauthenticated_client, admin_user["email"], "WrongPassword!2026")
    assert login(unauthenticated_client, admin_user["email"], admin_password).status_code == 200
    assert container.auth_repository.get_user_by_id(admin_user["id"])["failed_login_attempts"] == 0


def test_me_requires_cookie_and_accepts_valid_session(
    unauthenticated_client: TestClient,
    admin_user: dict,
    admin_password: str,
) -> None:
    assert unauthenticated_client.get("/api/v1/auth/admin/me").status_code == 401
    login(unauthenticated_client, admin_user["email"], admin_password)
    response = unauthenticated_client.get("/api/v1/auth/admin/me")
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"


def test_session_database_contains_only_hash(
    unauthenticated_client: TestClient,
    container: ApplicationContainer,
    admin_user: dict,
    admin_password: str,
) -> None:
    login(unauthenticated_client, admin_user["email"], admin_password)
    raw_token = unauthenticated_client.cookies.get("emarket_admin_session")
    with container.db_helper.get_connection() as connection:
        row = connection.execute("SELECT token_hash FROM admin_sessions").fetchone()
    assert row["token_hash"] != raw_token
    assert row["token_hash"] == container.security.hash_token(raw_token)


@pytest.mark.parametrize("mode", ["expired", "revoked"])
def test_expired_or_revoked_session_returns_401(
    unauthenticated_client: TestClient,
    container: ApplicationContainer,
    admin_user: dict,
    admin_password: str,
    mode: str,
) -> None:
    login(unauthenticated_client, admin_user["email"], admin_password)
    raw = unauthenticated_client.cookies.get("emarket_admin_session")
    token_hash = container.security.hash_token(raw)
    timestamp = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(timespec="seconds")
    with container.db_helper.get_connection() as connection:
        if mode == "expired":
            connection.execute("UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ?", (timestamp, token_hash))
        else:
            connection.execute("UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?", (timestamp, token_hash))
        connection.commit()
    assert unauthenticated_client.get("/api/v1/auth/admin/me").status_code == 401


def test_analytics_requires_admin_and_customer_gets_403(
    unauthenticated_client: TestClient,
    container: ApplicationContainer,
) -> None:
    url = "/api/v1/admin/analytics/summary"
    assert unauthenticated_client.get(url).status_code == 401
    password = "CustomerPass!2026"
    user_id = container.auth_repository.create_user(
        "customer@example.com", container.security.hash_password(password), "customer", True
    )
    assert user_id > 0
    assert login(unauthenticated_client, "customer@example.com", password).status_code == 200
    assert unauthenticated_client.get(url).status_code == 403


@pytest.mark.parametrize(
    "url",
    [
        "/api/v1/admin/analytics/dashboard",
        "/api/v1/admin/analytics/summary",
        "/api/v1/admin/analytics/top-products",
        "/api/v1/admin/analytics/top-product-pairs",
        "/api/v1/admin/analytics/categories",
        "/api/v1/admin/analytics/daily-sales",
        "/api/v1/admin/analytics/rules",
        "/api/v1/admin/analytics/rules/page",
        "/api/v1/admin/analytics/rules/export",
        "/api/v1/admin/analytics/rules/detail/1",
        "/api/v1/admin/analytics/dashboard/stream",
    ],
)
def test_every_admin_analytics_endpoint_requires_session(
    unauthenticated_client: TestClient,
    url: str,
) -> None:
    assert unauthenticated_client.get(url).status_code == 401


def test_admin_analytics_accepts_valid_cookie(client: TestClient) -> None:
    assert client.get("/api/v1/admin/analytics/summary").status_code == 200


@pytest.mark.parametrize("csrf_mode", ["missing", "wrong"])
def test_logout_rejects_invalid_csrf(client: TestClient, csrf_mode: str) -> None:
    headers = {} if csrf_mode == "missing" else {"X-CSRF-Token": "wrong"}
    assert client.post("/api/v1/auth/admin/logout", headers=headers).status_code == 403


def test_logout_revokes_session_and_clears_access(client: TestClient) -> None:
    csrf = client.cookies.get("emarket_admin_csrf")
    response = client.post(
        "/api/v1/auth/admin/logout",
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200
    assert client.get("/api/v1/auth/admin/me").status_code == 401


def test_rule_rebuild_requires_csrf_and_accepts_valid_token(client: TestClient) -> None:
    url = "/api/v1/admin/rules/rebuild"
    assert client.post(url).status_code == 403
    csrf = client.cookies.get("emarket_admin_csrf")
    assert client.post(url, headers={"X-CSRF-Token": csrf}).status_code == 200
