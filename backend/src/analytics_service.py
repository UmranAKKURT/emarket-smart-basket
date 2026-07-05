from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from src.analytics_repository import AnalyticsRepository


class AnalyticsServiceError(Exception):
    """Analitik servisindeki hataların temel sınıfı."""


class InvalidAnalyticsParameterError(AnalyticsServiceError):
    """Analitik parametresi desteklenen aralığın dışında olduğunda yükseltilir."""


class AnalyticsService:
    """Analitik sorgu sonuçlarını doğrular ve API biçimine dönüştürür."""

    def __init__(self, analytics_repository: AnalyticsRepository) -> None:
        self.analytics_repository = analytics_repository

    def get_dashboard_summary(self) -> dict[str, Any]:
        summary = self.analytics_repository.get_summary()
        summary["total_revenue"] = round(float(summary["total_revenue"]), 2)
        summary["average_order_value"] = round(
            float(summary["average_order_value"]),
            2,
        )
        return summary

    def get_top_products(self, limit: int = 5) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, 1, 20)
        products = self.analytics_repository.get_top_products(limit)

        for product in products:
            product["total_revenue"] = round(float(product["total_revenue"]), 2)

        return products

    def get_category_sales(self) -> list[dict[str, Any]]:
        categories = self.analytics_repository.get_category_sales()

        for category in categories:
            category["total_revenue"] = round(
                float(category["total_revenue"]),
                2,
            )
            category["revenue_share"] = round(
                float(category["revenue_share"]),
                6,
            )

        return categories

    def get_daily_sales(self, days: int = 30) -> list[dict[str, Any]]:
        self._validate_integer_range("days", days, 7, 365)
        rows_by_date = {
            row["date"]: row
            for row in self.analytics_repository.get_daily_sales(days)
        }
        today = datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=days - 1)
        daily_sales: list[dict[str, Any]] = []

        for day_offset in range(days):
            day = start_date + timedelta(days=day_offset)
            date_text = day.isoformat()
            row = rows_by_date.get(date_text)
            daily_sales.append(
                {
                    "date": date_text,
                    "order_count": int(row["order_count"]) if row else 0,
                    "total_quantity": int(row["total_quantity"]) if row else 0,
                    "total_revenue": round(
                        float(row["total_revenue"]) if row else 0.0,
                        2,
                    ),
                }
            )

        return daily_sales

    def get_strongest_rules(self, limit: int = 10) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, 1, 50)
        return self.analytics_repository.get_strongest_rules(limit)

    @staticmethod
    def _validate_integer_range(
        name: str,
        value: int,
        minimum: int,
        maximum: int,
    ) -> None:
        if (
            isinstance(value, bool)
            or not isinstance(value, int)
            or not minimum <= value <= maximum
        ):
            raise InvalidAnalyticsParameterError(
                f"{name} {minimum} ile {maximum} arasında olmalıdır."
            )
