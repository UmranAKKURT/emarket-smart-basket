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
    assert summary["total_products"] == health["product_count"]
    assert summary["total_categories"] > 0
    assert summary["total_association_rules"] == health["rule_count"]
    assert 0 <= summary["active_rule_count"] <= summary["total_association_rules"]
    assert summary["last_order_at"] is not None
    assert summary["most_recommended_product"]["recommendation_count"] > 0
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


def test_top_product_pairs_are_sorted_and_include_support(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/admin/analytics/top-product-pairs",
        params={"limit": 10},
    )

    assert response.status_code == 200
    pairs = response.json()
    assert 0 < len(pairs) <= 10
    assert {"order_count", "combined_quantity", "support"}.issubset(pairs[0])
    assert pairs == sorted(
        pairs,
        key=lambda pair: (
            -pair["order_count"],
            -pair["combined_quantity"],
            pair["first_product_name"],
            pair["second_product_name"],
        ),
    )


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


def test_rule_history_page_supports_filters_and_detail(client: TestClient) -> None:
    response = client.get(
        "/api/v1/admin/analytics/rules/page",
        params={
            "limit": 5,
            "offset": 0,
            "sort_by": "lift",
            "sort_direction": "desc",
            "status_filter": "active",
            "min_confidence": 0.5,
            "min_lift": 1,
            "min_support": 0.01,
        },
    )

    assert response.status_code == 200
    page = response.json()
    assert page["limit"] == 5
    assert page["status_filter"] == "active"
    assert page["rules"]
    assert all(rule["is_active"] for rule in page["rules"])
    assert all(rule["calculation_count"] >= 1 for rule in page["rules"])

    detail_response = client.get(
        f"/api/v1/admin/analytics/rules/detail/{page['rules'][0]['rule_id']}"
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["rule_id"] == page["rules"][0]["rule_id"]


def test_rule_history_exports_csv_and_excel(client: TestClient) -> None:
    csv_response = client.get(
        "/api/v1/admin/analytics/rules/export",
        params={"format": "csv", "min_confidence": 0.5},
    )
    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")
    assert b"rule_id" in csv_response.content

    xlsx_response = client.get(
        "/api/v1/admin/analytics/rules/export",
        params={"format": "xlsx"},
    )
    assert xlsx_response.status_code == 200
    assert xlsx_response.content.startswith(b"PK")


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
        "period_metrics",
        "top_products",
        "top_product_pairs",
        "category_sales",
        "daily_sales",
        "strongest_rules",
    }
    summary = response.json()["summary"]
    assert {
        "total_products",
        "total_categories",
        "last_order_at",
        "most_recommended_product",
        "total_association_rules",
        "active_rule_count",
    }.issubset(summary)
    period_metrics = response.json()["period_metrics"]
    assert {
        "last_7_day_orders",
        "last_30_day_orders",
        "daily_average_orders",
        "daily_average_revenue",
    }.issubset(period_metrics)
    assert response.json()["top_product_pairs"]


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
