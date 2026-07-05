from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api import ApplicationContainer, create_app
from src.db_helper import EMarketDBHelper
from src.settings import Settings


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    return tmp_path / "test_emarket.db"


@pytest.fixture
def db_helper(test_db_path: Path) -> EMarketDBHelper:
    return EMarketDBHelper(db_path=test_db_path)


@pytest.fixture
def container(db_helper: EMarketDBHelper) -> ApplicationContainer:
    return ApplicationContainer(
        db_helper=db_helper,
        settings=Settings(login_max_attempts=3, login_lock_minutes=15),
    )


@pytest.fixture
def unauthenticated_client(container: ApplicationContainer) -> Iterator[TestClient]:
    app = create_app(container=container)

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_password() -> str:
    return "TestAdminPass!2026"


@pytest.fixture
def admin_user(container: ApplicationContainer, admin_password: str) -> dict:
    return container.auth_service.create_admin("admin@example.com", admin_password)


@pytest.fixture
def client(
    unauthenticated_client: TestClient,
    admin_user: dict,
    admin_password: str,
) -> TestClient:
    response = unauthenticated_client.post(
        "/api/v1/auth/admin/login",
        json={"email": admin_user["email"], "password": admin_password},
    )
    assert response.status_code == 200
    return unauthenticated_client


@pytest.fixture
def products(client: TestClient) -> list[dict]:
    response = client.get("/api/v1/products")
    assert response.status_code == 200
    return response.json()
