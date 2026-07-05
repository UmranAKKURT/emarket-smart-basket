from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def product_id(products: list[dict], name: str) -> int:
    return next(product["id"] for product in products if product["name"] == name)


def create_order(
    client: TestClient,
    items: list[dict[str, int]],
    user_id: int = 1001,
):
    return client.post(
        "/api/v1/orders",
        json={"user_id": user_id, "items": items},
    )


def test_create_order_uses_database_prices(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato = next(product for product in products if product["name"] == "Salkım Domates")
    response = create_order(
        client,
        [{"product_id": tomato["id"], "quantity": 2}],
    )

    assert response.status_code == 201
    data = response.json()
    assert data["items"][0]["price"] == tomato["price"]
    assert data["total_amount"] == round(tomato["price"] * 2, 2)


def test_duplicate_products_are_merged_and_count_increases(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato_id = product_id(products, "Salkım Domates")
    before_count = client.get("/api/v1/health").json()["order_count"]

    response = create_order(
        client,
        [
            {"product_id": tomato_id, "quantity": 1},
            {"product_id": tomato_id, "quantity": 2},
        ],
    )

    assert response.status_code == 201
    assert response.json()["items"][0]["quantity"] == 3
    assert client.get("/api/v1/health").json()["order_count"] == before_count + 1


def test_missing_product_returns_404_without_creating_order(client: TestClient) -> None:
    before_count = client.get("/api/v1/health").json()["order_count"]
    response = create_order(client, [{"product_id": 999999, "quantity": 1}])

    assert response.status_code == 404
    assert client.get("/api/v1/health").json()["order_count"] == before_count


@pytest.mark.parametrize(
    "items",
    [
        [],
        [{"product_id": 1, "quantity": 0}],
        [{"product_id": 1, "quantity": 51}],
    ],
)
def test_invalid_order_returns_422_without_creating_order(
    client: TestClient,
    items: list[dict[str, int]],
) -> None:
    before_count = client.get("/api/v1/health").json()["order_count"]
    response = create_order(client, items)

    assert response.status_code == 422
    assert client.get("/api/v1/health").json()["order_count"] == before_count


def test_order_history_lists_newest_order_first(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato_id = product_id(products, "Salkım Domates")
    first = create_order(client, [{"product_id": tomato_id, "quantity": 1}]).json()
    second = create_order(client, [{"product_id": tomato_id, "quantity": 2}]).json()

    response = client.get(
        "/api/v1/orders",
        params={"user_id": 1001, "limit": 10, "offset": 0},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert data["orders"][0]["order_id"] == second["order_id"]
    assert data["orders"][0]["order_id"] > first["order_id"]


def test_order_detail_returns_items(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato_id = product_id(products, "Salkım Domates")
    created = create_order(client, [{"product_id": tomato_id, "quantity": 2}]).json()

    response = client.get(
        f"/api/v1/orders/{created['order_id']}",
        params={"user_id": 1001},
    )

    assert response.status_code == 200
    assert response.json()["items"] == created["items"]
    assert response.json()["total_amount"] == created["total_amount"]


def test_order_detail_is_private_to_user(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato_id = product_id(products, "Salkım Domates")
    created = create_order(client, [{"product_id": tomato_id, "quantity": 1}]).json()

    response = client.get(
        f"/api/v1/orders/{created['order_id']}",
        params={"user_id": 2002},
    )

    assert response.status_code == 404


def test_missing_order_returns_404(client: TestClient) -> None:
    response = client.get(
        "/api/v1/orders/999999",
        params={"user_id": 1001},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "params",
    [
        {"user_id": 1001, "limit": 0},
        {"user_id": 1001, "limit": 51},
        {"user_id": 1001, "offset": -1},
    ],
)
def test_order_history_rejects_invalid_pagination(
    client: TestClient,
    params: dict[str, int],
) -> None:
    response = client.get("/api/v1/orders", params=params)

    assert response.status_code == 422
