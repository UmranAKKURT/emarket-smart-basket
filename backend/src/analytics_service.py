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
DAILY_SALES_DAY_RANGE = (1, MAX_ANALYTICS_DAYS)
STRONG_RULES_LIMIT_RANGE = (MIN_RULE_LIMIT, MAX_RULE_LIMIT)
RULE_SORT_FIELDS = {
    "confidence",
    "lift",
    "support",
    "created_at",
    "updated_at",
    "calculation_count",
}
RULE_STATUS_FILTERS = {"all", "active", "passive"}
RULE_RELIABILITY_MIN_SUPPORT = 0.05
RULE_RELIABILITY_MIN_CALCULATION_COUNT = 3
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

    def get_dashboard_summary(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        previous_start_date: str | None = None,
        previous_end_date: str | None = None,
    ) -> dict[str, Any]:
        summary = self.analytics_repository.get_summary(start_date, end_date)
        summary["most_recommended_product"] = (
            self.analytics_repository.get_most_recommended_product()
        )
        summary["total_revenue"] = self._round_money(summary["total_revenue"])
        summary["average_order_value"] = round(
            float(summary["average_order_value"]),
            MONEY_PRECISION,
        )
        summary["comparisons"] = self._build_summary_comparisons(
            summary,
            previous_start_date,
            previous_end_date,
        )
        return summary

    def get_dashboard_period_metrics(
        self,
        days: int = 30,
        start_date: str | None = None,
        end_date: str | None = None,
        previous_start_date: str | None = None,
        previous_end_date: str | None = None,
    ) -> dict[str, Any]:
        """Dashboard üst seviye dönem KPI'larını günlük satışlardan hesaplar."""

        daily_sales = self.get_daily_sales(days, start_date, end_date)
        selected_period_orders = sum(row["order_count"] for row in daily_sales)
        selected_period_revenue = sum(row["total_revenue"] for row in daily_sales)
        period_day_count = len(daily_sales) or 1
        active_day_count = sum(1 for row in daily_sales if row["order_count"] > 0)

        metrics = {
            "selected_period_orders": selected_period_orders,
            "selected_period_revenue": self._round_money(selected_period_revenue),
            "daily_average_orders": round(
                selected_period_orders / period_day_count,
                2,
            ),
            "daily_average_revenue": self._round_money(
                selected_period_revenue / period_day_count,
            ),
            "active_day_count": active_day_count,
            "period_day_count": period_day_count,
        }
        metrics["comparisons"] = self._build_period_comparisons(
            metrics,
            previous_start_date,
            previous_end_date,
        )
        return metrics

    def get_top_products(
        self,
        limit: int = 5,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, *TOP_PRODUCTS_LIMIT_RANGE)
        products = self.analytics_repository.get_top_products(
            limit,
            start_date,
            end_date,
        )

        for product in products:
            product["total_revenue"] = self._round_money(
                product["total_revenue"]
            )

        return products

    def get_top_product_pairs(
        self,
        limit: int = 10,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        self._validate_integer_range("limit", limit, *TOP_PRODUCTS_LIMIT_RANGE)
        pairs = self.analytics_repository.get_top_product_pairs(
            limit,
            start_date,
            end_date,
        )

        for pair in pairs:
            pair["support"] = round(float(pair["support"]), REVENUE_SHARE_PRECISION)

        return pairs

    def get_category_sales(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        categories = self.analytics_repository.get_category_sales(
            start_date,
            end_date,
        )

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

    def get_daily_sales(
        self,
        days: int = 30,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        self._validate_integer_range("days", days, *DAILY_SALES_DAY_RANGE)
        rows_by_date = {
            row["date"]: row
            for row in self.analytics_repository.get_daily_sales(
                days,
                start_date,
                end_date,
            )
        }
        if start_date and end_date:
            start_day = datetime.fromisoformat(start_date).date()
            end_day = datetime.fromisoformat(end_date).date()
            days = (end_day - start_day).days + 1
        else:
            today = datetime.now(timezone.utc).date()
            start_day = today - timedelta(days=days - 1)
        daily_sales: list[dict[str, Any]] = []

        for day_offset in range(days):
            day = start_day + timedelta(days=day_offset)
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
        return self._mark_strongest_rule(
            self.analytics_repository.get_strongest_rules(limit)
        )

    def resolve_period(
        self,
        period: str = "last_30_days",
        start_date: str | None = None,
        end_date: str | None = None,
        days: int = 30,
    ) -> dict[str, Any]:
        today = datetime.now(timezone.utc).date()

        if period == "all_time":
            date_range = self.analytics_repository.get_order_date_range()
            first_order_date = date_range["first_order_date"]
            start_day = (
                datetime.fromisoformat(first_order_date).date()
                if first_order_date
                else today
            )
            day_count = (today - start_day).days + 1
            return {
                "days": day_count,
                "start_date": start_day.isoformat(),
                "end_date": today.isoformat(),
                "previous_start_date": None,
                "previous_end_date": None,
            }

        if period == "custom":
            if not start_date or not end_date:
                raise InvalidAnalyticsParameterError(
                    "Özel dönem için başlangıç ve bitiş tarihi gereklidir."
                )
            start_day = datetime.fromisoformat(start_date).date()
            end_day = datetime.fromisoformat(end_date).date()
        else:
            period_days = {
                "today": 1,
                "last_7_days": 7,
                "last_30_days": 30,
            }.get(period, days)
            end_day = today
            start_day = today - timedelta(days=period_days - 1)

        if start_day > end_day:
            raise InvalidAnalyticsParameterError(
                "Başlangıç tarihi bitiş tarihinden sonra olamaz."
            )
        if end_day > today:
            raise InvalidAnalyticsParameterError("Gelecek tarihli dönem seçilemez.")

        day_count = (end_day - start_day).days + 1
        previous_end = start_day - timedelta(days=1)
        previous_start = previous_end - timedelta(days=day_count - 1)

        return {
            "days": day_count,
            "start_date": start_day.isoformat(),
            "end_date": end_day.isoformat(),
            "previous_start_date": previous_start.isoformat(),
            "previous_end_date": previous_end.isoformat(),
        }

    def _build_summary_comparisons(
        self,
        current: dict[str, Any],
        previous_start_date: str | None,
        previous_end_date: str | None,
    ) -> dict[str, str]:
        if not previous_start_date or not previous_end_date:
            return {}

        previous = self.analytics_repository.get_summary(
            previous_start_date,
            previous_end_date,
        )
        return {
            "total_orders": self._format_comparison(
                current["total_orders"],
                previous["total_orders"],
            ),
            "total_revenue": self._format_comparison(
                current["total_revenue"],
                previous["total_revenue"],
            ),
            "average_order_value": self._format_comparison(
                current["average_order_value"],
                previous["average_order_value"],
            ),
            "total_units_sold": self._format_comparison(
                current["total_units_sold"],
                previous["total_units_sold"],
            ),
        }

    def _build_period_comparisons(
        self,
        current: dict[str, Any],
        previous_start_date: str | None,
        previous_end_date: str | None,
    ) -> dict[str, dict[str, Any]]:
        if not previous_start_date or not previous_end_date:
            return {}

        previous_days = (
            datetime.fromisoformat(previous_end_date).date()
            - datetime.fromisoformat(previous_start_date).date()
        ).days + 1
        previous_sales = self.get_daily_sales(
            previous_days,
            previous_start_date,
            previous_end_date,
        )
        previous_orders = sum(row["order_count"] for row in previous_sales)
        previous_revenue = sum(row["total_revenue"] for row in previous_sales)
        previous_day_count = len(previous_sales) or 1
        return {
            "selected_period_orders": self._format_comparison(
                current["selected_period_orders"],
                previous_orders,
            ),
            "selected_period_revenue": self._format_comparison(
                current["selected_period_revenue"],
                self._round_money(previous_revenue),
            ),
            "daily_average_orders": self._format_comparison(
                current["daily_average_orders"],
                round(previous_orders / previous_day_count, 2),
            ),
            "daily_average_revenue": self._format_comparison(
                current["daily_average_revenue"],
                self._round_money(previous_revenue / previous_day_count),
            ),
        }

    @staticmethod
    def _format_comparison(current: Any, previous: Any) -> dict[str, Any]:
        current_value = float(current or 0)
        previous_value = float(previous or 0)

        if previous_value == 0:
            return {
                "status": "no_previous" if current_value else "same",
                "change_percent": None,
            }

        change = ((current_value - previous_value) / previous_value) * 100
        if abs(change) < 0.05:
            return {
                "status": "same",
                "change_percent": 0.0,
            }

        return {
            "status": "increase" if change > 0 else "decrease",
            "change_percent": round(abs(change), 1),
        }

    @staticmethod
    def _format_change(current: Any, previous: Any) -> str:
        current_value = float(current or 0)
        previous_value = float(previous or 0)

        if previous_value == 0:
            return "Önceki dönemde veri yok" if current_value else "Değişim yok"

        change = ((current_value - previous_value) / previous_value) * 100
        if abs(change) < 0.05:
            return "Değişim yok"

        arrow = "↑" if change > 0 else "↓"
        return f"Önceki döneme göre {arrow} %{abs(change):.1f}"

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
            "rules": self._mark_strongest_rule(page["rules"]),
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
        return self._mark_strongest_rule([rule])[0]

    @staticmethod
    def _is_rule_reliable(rule: dict[str, Any]) -> bool:
        return (
            float(rule.get("support") or 0) >= RULE_RELIABILITY_MIN_SUPPORT
            and int(rule.get("calculation_count") or 1)
            >= RULE_RELIABILITY_MIN_CALCULATION_COUNT
        )

    @staticmethod
    def _rule_strength_key(rule: dict[str, Any]) -> tuple[float, float, float, int]:
        return (
            float(rule.get("confidence") or 0),
            float(rule.get("lift") or 0),
            float(rule.get("support") or 0),
            int(rule.get("calculation_count") or 1),
        )

    def _mark_strongest_rule(
        self,
        rules: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        reliable_rules = [rule for rule in rules if self._is_rule_reliable(rule)]
        strongest_rule_id = None

        if reliable_rules:
            strongest_rule_id = max(
                reliable_rules,
                key=self._rule_strength_key,
            ).get("rule_id")

        return [
            {
                **rule,
                "is_strongest": rule.get("rule_id") == strongest_rule_id,
            }
            for rule in rules
        ]

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
