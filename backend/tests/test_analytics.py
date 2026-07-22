from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.analytics_service import AnalyticsService
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


def test_limited_sample_rule_is_not_marked_as_strongest() -> None:
    service = AnalyticsService.__new__(AnalyticsService)

    rules = service._mark_strongest_rule([
        {
            "rule_id": 1,
            "confidence": 1.0,
            "lift": 5.0,
            "support": 0.03,
            "calculation_count": 1,
        },
        {
            "rule_id": 2,
            "confidence": 1.0,
            "lift": 3.0,
            "support": 0.099,
            "calculation_count": 56,
        },
    ])

    assert rules[0]["is_strongest"] is False
    assert rules[1]["is_strongest"] is True


def test_no_rule_is_strongest_when_all_samples_are_limited() -> None:
    service = AnalyticsService.__new__(AnalyticsService)

    rules = service._mark_strongest_rule([
        {
            "rule_id": 1,
            "confidence": 1.0,
            "lift": 5.0,
            "support": 0.03,
            "calculation_count": 1,
        },
        {
            "rule_id": 2,
            "confidence": 0.99,
            "lift": 4.0,
            "support": 0.04,
            "calculation_count": 2,
        },
    ])

    assert all(rule["is_strongest"] is False for rule in rules)


def test_period_metrics_use_selected_period_totals_and_comparisons() -> None:
    service = AnalyticsService.__new__(AnalyticsService)

    def fake_daily_sales(days, start_date=None, end_date=None):
        if start_date == "2026-06-01":
            return [
                {"date": "2026-06-01", "order_count": 2, "total_revenue": 100.0},
                {"date": "2026-06-02", "order_count": 0, "total_revenue": 0.0},
            ]
        return [
            {"date": "2026-07-01", "order_count": 3, "total_revenue": 150.0},
            {"date": "2026-07-02", "order_count": 1, "total_revenue": 50.0},
        ]

    service.get_daily_sales = fake_daily_sales

    metrics = service.get_dashboard_period_metrics(
        days=2,
        start_date="2026-07-01",
        end_date="2026-07-02",
        previous_start_date="2026-06-01",
        previous_end_date="2026-06-02",
    )

    assert metrics["selected_period_orders"] == 4
    assert metrics["selected_period_revenue"] == 200.0
    assert metrics["active_day_count"] == 2
    assert metrics["period_day_count"] == 2
    assert metrics["comparisons"]["selected_period_orders"] == {
        "status": "increase",
        "change_percent": 100.0,
    }
    assert metrics["comparisons"]["selected_period_revenue"] == {
        "status": "increase",
        "change_percent": 100.0,
    }


def test_comparison_handles_zero_previous_without_infinity() -> None:
    assert AnalyticsService._format_comparison(5, 0) == {
        "status": "no_previous",
        "change_percent": None,
    }
    assert AnalyticsService._format_comparison(0, 0) == {
        "status": "same",
        "change_percent": None,
    }


def test_resolve_period_all_time_uses_first_order_date() -> None:
    class FakeRepository:
        def get_order_date_range(self):
            return {
                "first_order_date": "2026-07-01",
                "last_order_date": "2026-07-05",
                "total_orders": 5,
            }

    service = AnalyticsService(FakeRepository())
    period = service.resolve_period("all_time")

    assert period["start_date"] == "2026-07-01"
    assert period["previous_start_date"] is None
    assert period["previous_end_date"] is None


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
        "recommendation_impact",
    }
    summary = response.json()["summary"]
    assert {
        "total_products",
        "total_categories",
        "last_order_at",
        "most_recommended_product",
        "total_association_rules",
        "active_rule_count",
        "comparisons",
    }.issubset(summary)
    period_metrics = response.json()["period_metrics"]
    assert {
        "selected_period_orders",
        "selected_period_revenue",
        "daily_average_orders",
        "daily_average_revenue",
        "active_day_count",
        "period_day_count",
        "comparisons",
    }.issubset(period_metrics)
    assert {
        "impressions",
        "add_to_cart",
        "purchases",
        "recommendation_revenue",
        "add_to_cart_rate",
        "purchase_rate",
    }.issubset(response.json()["recommendation_impact"])
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
