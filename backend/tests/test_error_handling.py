from __future__ import annotations

import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.exception_handlers import register_exception_handlers


def test_http_errors_keep_standard_detail_response(
    unauthenticated_client: TestClient,
) -> None:
    response = unauthenticated_client.get("/api/v1/products/999999")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "999999 id değerine sahip ürün bulunamadı."
    }


def test_validation_errors_keep_detail_list(
    unauthenticated_client: TestClient,
) -> None:
    response = unauthenticated_client.get("/api/v1/orders?user_id=0")

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_request_log_excludes_query_values(
    unauthenticated_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    secret_value = "must-not-be-logged"

    with caplog.at_level(logging.INFO, logger="emarket.http"):
        response = unauthenticated_client.get(
            "/api/v1/health",
            params={"token": secret_value},
        )

    assert response.status_code == 200
    messages = [
        record.getMessage()
        for record in caplog.records
        if record.name == "emarket.http"
    ]
    assert any(
        "method=GET path=/api/v1/health status=200" in message
        for message in messages
    )
    assert all(secret_value not in message for message in messages)


def test_unexpected_errors_return_safe_standard_response() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("internal-sensitive-detail")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Beklenmeyen bir sunucu hatası oluştu."
    }
    assert "internal-sensitive-detail" not in response.text

