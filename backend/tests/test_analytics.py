from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.db_helper import EMarketDBHelper


def test_summary_matches_temporary_database_health(client: TestClient) -> None:
    health = client.get("/api/v1/health").json()
    response = client.get("/api/v1/admin/analytics/summary")

    assert response.status_code == 200
    summary = response.json()
    assert summary["total_orders"] == health["order_count"]
    assert summary["total_revenue"] > 0
    assert summary["average_order_value"] == round(
        summary["total_revenue"] / summary["total_orders"],
        2,
    )


def test_top_products_are_sorted(client: TestClient) -> None:
    response = client.get(
        "/api/v1/admin/analytics/top-products",
        params={"limit": 5},
    )

    assert response.status_code == 200
    products = response.json()
    assert 0 < len(products) <= 5
    assert products == sorted(
        products,
        key=lambda product: (
            -product["total_quantity"],
            -product["total_revenue"],
            product["product_name"],
        ),
    )


@pytest.mark.parametrize("limit", [0, 21])
def test_top_products_reject_invalid_limit(
    client: TestClient,
    limit: int,
) -> None:
    response = client.get(
        "/api/v1/admin/analytics/top-products",
        params={"limit": limit},
    )

    assert response.status_code == 422


def test_category_revenue_shares_sum_to_one(client: TestClient) -> None:
    response = client.get("/api/v1/admin/analytics/categories")

    assert response.status_code == 200
    categories = response.json()
    assert categories
    assert sum(category["revenue_share"] for category in categories) == pytest.approx(
        1.0,
        abs=0.00001,
    )


def test_daily_sales_fills_requested_period(client: TestClient) -> None:
    response = client.get(
        "/api/v1/admin/analytics/daily-sales",
        params={"days": 30},
    )

    assert response.status_code == 200
    daily_sales = response.json()
    assert len(daily_sales) == 30
    assert daily_sales == sorted(daily_sales, key=lambda row: row["date"])


@pytest.mark.parametrize("days", [6, 366])
def test_daily_sales_reject_invalid_days(
    client: TestClient,
    days: int,
) -> None:
    response = client.get(
        "/api/v1/admin/analytics/daily-sales",
        params={"days": days},
    )

    assert response.status_code == 422


def test_strongest_rules_include_metrics(client: TestClient) -> None:
    response = client.get(
        "/api/v1/admin/analytics/rules",
        params={"limit": 10},
    )

    assert response.status_code == 200
    rules = response.json()
    assert rules
    assert {"confidence", "lift", "support"}.issubset(rules[0])


def test_dashboard_contains_all_sections(client: TestClient) -> None:
    response = client.get(
        "/api/v1/admin/analytics/dashboard",
        params={
            "top_product_limit": 5,
            "rule_limit": 10,
            "days": 30,
        },
    )

    assert response.status_code == 200
    assert set(response.json()) == {
        "summary",
        "top_products",
        "category_sales",
        "daily_sales",
        "strongest_rules",
    }


def test_created_order_stores_database_unit_price(
    client: TestClient,
    products: list[dict],
    db_helper: EMarketDBHelper,
) -> None:
    product = products[0]
    response = client.post(
        "/api/v1/orders",
        json={
            "user_id": 1001,
            "items": [{"product_id": product["id"], "quantity": 2}],
        },
    )

    assert response.status_code == 201
    order_id = response.json()["order_id"]

    with db_helper.get_connection() as connection:
        row = connection.execute(
            """
            SELECT unit_price
            FROM order_items
            WHERE order_id = ? AND product_id = ?;
            """,
            (order_id, product["id"]),
        ).fetchone()

    assert row["unit_price"] == product["price"]


def test_historical_revenue_uses_unit_price_after_product_price_change(
    client: TestClient,
    products: list[dict],
    db_helper: EMarketDBHelper,
) -> None:
    product = products[0]
    created = client.post(
        "/api/v1/orders",
        json={
            "user_id": 1001,
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    revenue_before = client.get(
        "/api/v1/admin/analytics/summary"
    ).json()["total_revenue"]

    with db_helper.get_connection() as connection:
        connection.execute(
            "UPDATE products SET price = price + 500 WHERE id = ?;",
            (product["id"],),
        )
        connection.commit()

    revenue_after = client.get(
        "/api/v1/admin/analytics/summary"
    ).json()["total_revenue"]
    detail = client.get(
        f"/api/v1/orders/{created['order_id']}",
        params={"user_id": 1001},
    ).json()

    assert revenue_after == revenue_before
    assert detail["items"][0]["price"] == product["price"]
