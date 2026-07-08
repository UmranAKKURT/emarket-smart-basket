from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Any

from src.analytics_repository import AnalyticsRepository
from src.validation import (
    MAX_ANALYTICS_DAYS,
    MAX_RULE_LIMIT,
    MAX_TOP_PRODUCT_LIMIT,
    MIN_ANALYTICS_DAYS,
    MIN_PAGE_OFFSET,
    MIN_RULE_LIMIT,
    MIN_TOP_PRODUCT_LIMIT,
)


MONEY_PRECISION = 2
REVENUE_SHARE_PRECISION = 6
TOP_PRODUCTS_LIMIT_RANGE = (MIN_TOP_PRODUCT_LIMIT, MAX_TOP_PRODUCT_LIMIT)
DAILY_SALES_DAY_RANGE = (MIN_ANALYTICS_DAYS, MAX_ANALYTICS_DAYS)
STRONG_RULES_LIMIT_RANGE = (MIN_RULE_LIMIT, MAX_RULE_LIMIT)
RULE_SORT_FIELDS = {"confidence", "lift", "support", "created_at", "updated_at"}
RULE_STATUS_FILTERS = {"all", "active", "passive"}
RULE_EXPORT_COLUMNS = [
    "rule_id",
    "antecedent_name",
    "consequent_name",
    "support",
    "confidence",
    "lift",
    "calculation_count",
    "is_active",
    "created_at",
    "updated_at",
    "context_message",
]


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
        summary["most_recommended_product"] = (
            self.analytics_repository.get_most_recommended_product()
        )
        summary["total_revenue"] = self._round_money(summary["total_revenue"])
        summary["average_order_value"] = round(
            float(summary["average_order_value"]),
            MONEY_PRECISION,
        )
        return summary

    def get_dashboard_period_metrics(self, days: int = 30) -> dict[str, Any]:
        """Dashboard üst seviye dönem KPI'larını günlük satışlardan hesaplar."""

        daily_sales = self.get_daily_sales(days)
        last_7_days = daily_sales[-7:]
        total_orders = sum(row["order_count"] for row in daily_sales)
        total_revenue = sum(row["total_revenue"] for row in daily_sales)
        day_count = len(daily_sales) or 1

        return {
            "last_7_day_orders": sum(row["order_count"] for row in last_7_days),
            "last_30_day_orders": total_orders,
            "daily_average_orders": round(total_orders / day_count, 2),
            "daily_average_revenue": self._round_money(total_revenue / day_count),
        }

    def get_top_products(self, limit: int = 5) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, *TOP_PRODUCTS_LIMIT_RANGE)
        products = self.analytics_repository.get_top_products(limit)

        for product in products:
            product["total_revenue"] = self._round_money(
                product["total_revenue"]
            )

        return products

    def get_top_product_pairs(self, limit: int = 10) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, *TOP_PRODUCTS_LIMIT_RANGE)
        pairs = self.analytics_repository.get_top_product_pairs(limit)

        for pair in pairs:
            pair["support"] = round(float(pair["support"]), REVENUE_SHARE_PRECISION)

        return pairs

    def get_category_sales(self) -> list[dict[str, Any]]:
        categories = self.analytics_repository.get_category_sales()

        for category in categories:
            category["total_revenue"] = round(
                float(category["total_revenue"]),
                MONEY_PRECISION,
            )
            category["revenue_share"] = round(
                float(category["revenue_share"]),
                REVENUE_SHARE_PRECISION,
            )

        return categories

    def get_daily_sales(self, days: int = 30) -> list[dict[str, Any]]:
        self._validate_integer_range("days", days, *DAILY_SALES_DAY_RANGE)
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
                        MONEY_PRECISION,
                    ),
                }
            )

        return daily_sales

    def get_strongest_rules(self, limit: int = 10) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, *STRONG_RULES_LIMIT_RANGE)
        return self.analytics_repository.get_strongest_rules(limit)

    def get_rules_page(
        self,
        limit: int = 5,
        offset: int = 0,
        search: str | None = None,
        sort_by: str = "confidence",
        sort_direction: str = "desc",
        include_inactive: bool = True,
        status_filter: str = "all",
        min_confidence: float | None = None,
        min_lift: float | None = None,
        min_support: float | None = None,
        created_from: str | None = None,
        created_to: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> dict[str, Any]:
        self._validate_integer_range("limit", limit, *STRONG_RULES_LIMIT_RANGE)

        if offset < MIN_PAGE_OFFSET:
            raise InvalidAnalyticsParameterError("offset 0 veya daha büyük olmalıdır.")

        if sort_by not in RULE_SORT_FIELDS:
            raise InvalidAnalyticsParameterError("Geçersiz association rule sıralama alanı.")

        if sort_direction not in {"asc", "desc"}:
            raise InvalidAnalyticsParameterError("Sıralama yönü asc veya desc olmalıdır.")

        if status_filter not in RULE_STATUS_FILTERS:
            raise InvalidAnalyticsParameterError("Geçersiz association rule durum filtresi.")

        if not include_inactive and status_filter == "all":
            status_filter = "active"

        self._validate_optional_ratio("min_confidence", min_confidence)
        self._validate_optional_ratio("min_support", min_support)
        self._validate_optional_minimum("min_lift", min_lift)

        page = self.analytics_repository.get_rules_page(
            limit=limit,
            offset=offset,
            search=search,
            sort_by=sort_by,
            sort_direction=sort_direction,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )

        return {
            "rules": page["rules"],
            "total": page["total"],
            "limit": limit,
            "offset": offset,
            "search": search or "",
            "sort_by": sort_by,
            "sort_direction": sort_direction,
            "status_filter": status_filter,
        }

    def get_rule_detail(self, rule_id: int) -> dict[str, Any]:
        rule = self.analytics_repository.get_rule_by_id(rule_id)
        if rule is None:
            raise InvalidAnalyticsParameterError("Association rule bulunamadı.")
        return rule

    def export_rules(
        self,
        export_format: str,
        search: str | None = None,
        sort_by: str = "confidence",
        sort_direction: str = "desc",
        status_filter: str = "all",
        min_confidence: float | None = None,
        min_lift: float | None = None,
        min_support: float | None = None,
        created_from: str | None = None,
        created_to: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> tuple[bytes, str, str]:
        if export_format not in {"csv", "xlsx"}:
            raise InvalidAnalyticsParameterError("Export formatı csv veya xlsx olmalıdır.")

        self.get_rules_page(
            limit=1,
            offset=0,
            search=search,
            sort_by=sort_by,
            sort_direction=sort_direction,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )
        rows = self.analytics_repository.get_rules_for_export(
            search=search,
            sort_by=sort_by,
            sort_direction=sort_direction,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )

        if export_format == "csv":
            return (
                self._build_csv(rows),
                "text/csv; charset=utf-8",
                "association-rules.csv",
            )

        return (
            self._build_xlsx(rows),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "association-rules.xlsx",
        )

    @staticmethod
    def _round_money(value: Any) -> float:
        return round(float(value), MONEY_PRECISION)

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

    @staticmethod
    def _validate_optional_ratio(name: str, value: float | None) -> None:
        if value is not None and not 0 <= value <= 1:
            raise InvalidAnalyticsParameterError(f"{name} 0 ile 1 arasında olmalıdır.")

    @staticmethod
    def _validate_optional_minimum(name: str, value: float | None) -> None:
        if value is not None and value < 0:
            raise InvalidAnalyticsParameterError(f"{name} negatif olamaz.")

    @staticmethod
    def _build_csv(rows: list[dict[str, Any]]) -> bytes:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=RULE_EXPORT_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in RULE_EXPORT_COLUMNS})
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    @staticmethod
    def _build_xlsx(rows: list[dict[str, Any]]) -> bytes:
        def cell(value: Any) -> str:
            return f"<c t=\"inlineStr\"><is><t>{escape(str(value if value is not None else ''))}</t></is></c>"

        sheet_rows = [
            f"<row>{''.join(cell(column) for column in RULE_EXPORT_COLUMNS)}</row>"
        ]
        for row in rows:
            sheet_rows.append(
                f"<row>{''.join(cell(row.get(column, '')) for column in RULE_EXPORT_COLUMNS)}</row>"
            )

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>""",
            )
            archive.writestr(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
            )
            archive.writestr(
                "xl/workbook.xml",
                """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Association Rules" sheetId="1" r:id="rId1"/></sheets>
</workbook>""",
            )
            archive.writestr(
                "xl/_rels/workbook.xml.rels",
                """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>""",
            )
            archive.writestr(
                "xl/worksheets/sheet1.xml",
                f"""<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>{''.join(sheet_rows)}</sheetData>
</worksheet>""",
            )
        return buffer.getvalue()
