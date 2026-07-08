from __future__ import annotations

from typing import Any

from src.db_helper import EMarketDBHelper


class AnalyticsRepository:
    """Yönetim analitikleri için salt-okunur SQL sorgularını yönetir."""

    def __init__(self, db_helper: EMarketDBHelper) -> None:
        self.db_helper = db_helper

    @staticmethod
    def _rows_to_dicts(rows: list[Any]) -> list[dict[str, Any]]:
        return [dict(row) for row in rows]

    def get_summary(self) -> dict[str, Any]:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    COUNT(DISTINCT o.id) AS total_orders,
                    COALESCE(SUM(
                        COALESCE(oi.unit_price, p.price) * oi.quantity
                    ), 0) AS total_revenue,
                    COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
                    COUNT(DISTINCT o.user_id) AS unique_customers,
                    MAX(o.created_at) AS last_order_at,
                    (SELECT COUNT(*) FROM products) AS total_products,
                    (SELECT COUNT(DISTINCT category) FROM products)
                        AS total_categories,
                    (SELECT COUNT(*) FROM association_rules)
                        AS total_association_rules,
                    (SELECT COUNT(*) FROM association_rules WHERE is_active = 1)
                        AS active_rule_count
                FROM orders AS o
                LEFT JOIN order_items AS oi
                    ON oi.order_id = o.id
                LEFT JOIN products AS p
                    ON p.id = oi.product_id;
                """
            ).fetchone()

        total_orders = int(row["total_orders"])
        total_revenue = float(row["total_revenue"])

        return {
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "total_units_sold": int(row["total_units_sold"]),
            "average_order_value": (
                total_revenue / total_orders if total_orders else 0.0
            ),
            "unique_customers": int(row["unique_customers"]),
            "total_products": int(row["total_products"]),
            "total_categories": int(row["total_categories"]),
            "total_association_rules": int(row["total_association_rules"]),
            "active_rule_count": int(row["active_rule_count"]),
            "last_order_at": row["last_order_at"],
        }

    def get_most_recommended_product(self) -> dict[str, Any] | None:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    product.id AS product_id,
                    product.name AS product_name,
                    product.emoji,
                    COUNT(rule.id) AS recommendation_count
                FROM association_rules AS rule
                INNER JOIN products AS product
                    ON product.id = rule.consequent_product_id
                WHERE rule.is_active = 1
                GROUP BY product.id, product.name, product.emoji
                ORDER BY
                    recommendation_count DESC,
                    AVG(rule.confidence) DESC,
                    MAX(rule.lift) DESC,
                    product.name ASC
                LIMIT 1;
                """
            ).fetchone()

        return dict(row) if row is not None else None

    def get_top_products(self, limit: int = 5) -> list[dict[str, Any]]:
        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    p.id AS product_id,
                    p.name AS product_name,
                    p.emoji,
                    p.category,
                    SUM(oi.quantity) AS total_quantity,
                    ROUND(SUM(
                        COALESCE(oi.unit_price, p.price) * oi.quantity
                    ), 2) AS total_revenue,
                    COUNT(DISTINCT oi.order_id) AS order_count
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                GROUP BY p.id, p.name, p.emoji, p.category
                ORDER BY
                    total_quantity DESC,
                    total_revenue DESC,
                    product_name ASC
                LIMIT ?;
                """,
                (limit,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_top_product_pairs(self, limit: int = 10) -> list[dict[str, Any]]:
        """En sık aynı siparişte birlikte görülen ürün çiftlerini getirir."""

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                WITH total_orders AS (
                    SELECT COUNT(*) AS value
                    FROM orders
                ),
                pairs AS (
                    SELECT
                        left_item.product_id AS first_product_id,
                        right_item.product_id AS second_product_id,
                        COUNT(DISTINCT left_item.order_id) AS order_count,
                        SUM(left_item.quantity + right_item.quantity)
                            AS combined_quantity
                    FROM order_items AS left_item
                    INNER JOIN order_items AS right_item
                        ON right_item.order_id = left_item.order_id
                        AND right_item.product_id > left_item.product_id
                    GROUP BY left_item.product_id, right_item.product_id
                )
                SELECT
                    first_product.id AS first_product_id,
                    first_product.name AS first_product_name,
                    first_product.emoji AS first_product_emoji,
                    second_product.id AS second_product_id,
                    second_product.name AS second_product_name,
                    second_product.emoji AS second_product_emoji,
                    pairs.order_count,
                    pairs.combined_quantity,
                    CASE
                        WHEN total_orders.value = 0 THEN 0.0
                        ELSE CAST(pairs.order_count AS REAL) / total_orders.value
                    END AS support
                FROM pairs
                INNER JOIN products AS first_product
                    ON first_product.id = pairs.first_product_id
                INNER JOIN products AS second_product
                    ON second_product.id = pairs.second_product_id
                CROSS JOIN total_orders
                ORDER BY
                    pairs.order_count DESC,
                    pairs.combined_quantity DESC,
                    first_product.name ASC,
                    second_product.name ASC
                LIMIT ?;
                """,
                (limit,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_category_sales(self) -> list[dict[str, Any]]:
        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                WITH category_totals AS (
                    SELECT
                        p.category,
                        SUM(oi.quantity) AS total_quantity,
                        SUM(
                            COALESCE(oi.unit_price, p.price) * oi.quantity
                        ) AS total_revenue,
                        COUNT(DISTINCT oi.order_id) AS order_count
                    FROM order_items AS oi
                    INNER JOIN products AS p
                        ON p.id = oi.product_id
                    GROUP BY p.category
                ),
                grand_total AS (
                    SELECT COALESCE(SUM(total_revenue), 0) AS revenue
                    FROM category_totals
                )
                SELECT
                    category_totals.category,
                    category_totals.total_quantity,
                    ROUND(category_totals.total_revenue, 2) AS total_revenue,
                    category_totals.order_count,
                    CASE
                        WHEN grand_total.revenue = 0 THEN 0.0
                        ELSE category_totals.total_revenue / grand_total.revenue
                    END AS revenue_share
                FROM category_totals
                CROSS JOIN grand_total
                ORDER BY category_totals.total_revenue DESC;
                """
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_daily_sales(self, days: int = 30) -> list[dict[str, Any]]:
        modifier = f"-{days - 1} days"

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    date(o.created_at) AS date,
                    COUNT(DISTINCT o.id) AS order_count,
                    SUM(oi.quantity) AS total_quantity,
                    ROUND(SUM(
                        COALESCE(oi.unit_price, p.price) * oi.quantity
                    ), 2) AS total_revenue
                FROM orders AS o
                INNER JOIN order_items AS oi
                    ON oi.order_id = o.id
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE date(o.created_at) >= date('now', ?)
                  AND date(o.created_at) <= date('now')
                GROUP BY date(o.created_at)
                ORDER BY date(o.created_at) ASC;
                """,
                (modifier,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_strongest_rules(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    ar.id AS rule_id,
                    ar.antecedent_product_id,
                    antecedent.name AS antecedent_name,
                    antecedent.emoji AS antecedent_emoji,
                    ar.consequent_product_id,
                    consequent.name AS consequent_name,
                    consequent.emoji AS consequent_emoji,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                FROM association_rules AS ar
                INNER JOIN products AS antecedent
                    ON antecedent.id = ar.antecedent_product_id
                INNER JOIN products AS consequent
                    ON consequent.id = ar.consequent_product_id
                ORDER BY
                    ar.confidence DESC,
                    ar.lift DESC,
                    ar.support DESC,
                    ar.id ASC
                LIMIT ?;
                """,
                (limit,),
            ).fetchall()

        return self._rows_to_dicts(rows)


    def get_rules_page(
        self,
        limit: int,
        offset: int,
        search: str | None,
        sort_by: str,
        sort_direction: str,
        status_filter: str = "all",
        min_confidence: float | None = None,
        min_lift: float | None = None,
        min_support: float | None = None,
        created_from: str | None = None,
        created_to: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> dict[str, Any]:
        sort_columns = {
            "confidence": "ar.confidence",
            "lift": "ar.lift",
            "support": "ar.support",
            "created_at": "ar.created_at",
            "updated_at": "ar.updated_at",
            "calculation_count": "ar.calculation_count",
        }
        sort_column = sort_columns.get(sort_by, "ar.confidence")
        direction = "ASC" if sort_direction == "asc" else "DESC"

        base_from, params = self._build_rules_query(
            search=search,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )

        with self.db_helper.get_connection() as connection:
            total_row = connection.execute(
                f"SELECT COUNT(*) AS total {base_from};",
                tuple(params),
            ).fetchone()
            rows = connection.execute(
                f"""
                SELECT
                    ar.id AS rule_id,
                    ar.antecedent_product_id,
                    antecedent.name AS antecedent_name,
                    antecedent.emoji AS antecedent_emoji,
                    ar.consequent_product_id,
                    consequent.name AS consequent_name,
                    consequent.emoji AS consequent_emoji,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                {base_from}
                ORDER BY {sort_column} {direction},
                    ar.confidence DESC,
                    ar.lift DESC,
                    ar.support DESC,
                    ar.id ASC
                LIMIT ? OFFSET ?;
                """,
                tuple(params + [limit, offset]),
            ).fetchall()

        return {
            "rules": self._rows_to_dicts(rows),
            "total": int(total_row["total"]),
        }

    def get_rule_by_id(self, rule_id: int) -> dict[str, Any] | None:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    ar.id AS rule_id,
                    ar.antecedent_product_id,
                    antecedent.name AS antecedent_name,
                    antecedent.emoji AS antecedent_emoji,
                    ar.consequent_product_id,
                    consequent.name AS consequent_name,
                    consequent.emoji AS consequent_emoji,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                FROM association_rules AS ar
                INNER JOIN products AS antecedent
                    ON antecedent.id = ar.antecedent_product_id
                INNER JOIN products AS consequent
                    ON consequent.id = ar.consequent_product_id
                WHERE ar.id = ?;
                """,
                (rule_id,),
            ).fetchone()

        return dict(row) if row else None

    def get_rules_for_export(
        self,
        search: str | None,
        sort_by: str,
        sort_direction: str,
        status_filter: str = "all",
        min_confidence: float | None = None,
        min_lift: float | None = None,
        min_support: float | None = None,
        created_from: str | None = None,
        created_to: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> list[dict[str, Any]]:
        sort_columns = {
            "confidence": "ar.confidence",
            "lift": "ar.lift",
            "support": "ar.support",
            "created_at": "ar.created_at",
            "updated_at": "ar.updated_at",
            "calculation_count": "ar.calculation_count",
        }
        sort_column = sort_columns.get(sort_by, "ar.confidence")
        direction = "ASC" if sort_direction == "asc" else "DESC"
        base_from, params = self._build_rules_query(
            search=search,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT
                    ar.id AS rule_id,
                    antecedent.name AS antecedent_name,
                    consequent.name AS consequent_name,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                {base_from}
                ORDER BY {sort_column} {direction},
                    ar.confidence DESC,
                    ar.lift DESC,
                    ar.support DESC,
                    ar.id ASC;
                """,
                tuple(params),
            ).fetchall()

        return self._rows_to_dicts(rows)

    @staticmethod
    def _append_metric_filter(
        where_clauses: list[str],
        params: list[Any],
        column: str,
        value: float | None,
    ) -> None:
        if value is not None:
            where_clauses.append(f"{column} >= ?")
            params.append(value)

    def _build_rules_query(
        self,
        search: str | None,
        status_filter: str,
        min_confidence: float | None,
        min_lift: float | None,
        min_support: float | None,
        created_from: str | None,
        created_to: str | None,
        updated_from: str | None,
        updated_to: str | None,
    ) -> tuple[str, list[Any]]:
        where_clauses: list[str] = []
        params: list[Any] = []

        if status_filter == "active":
            where_clauses.append("ar.is_active = 1")
        elif status_filter == "passive":
            where_clauses.append("ar.is_active = 0")

        normalized_search = (search or "").strip()
        if normalized_search:
            pattern = f"%{normalized_search}%"
            where_clauses.append(
                "(antecedent.name LIKE ? OR consequent.name LIKE ? OR ar.context_message LIKE ?)"
            )
            params.extend([pattern, pattern, pattern])

        self._append_metric_filter(where_clauses, params, "ar.confidence", min_confidence)
        self._append_metric_filter(where_clauses, params, "ar.lift", min_lift)
        self._append_metric_filter(where_clauses, params, "ar.support", min_support)

        if created_from:
            where_clauses.append("date(ar.created_at) >= date(?)")
            params.append(created_from)
        if created_to:
            where_clauses.append("date(ar.created_at) <= date(?)")
            params.append(created_to)
        if updated_from:
            where_clauses.append("date(ar.updated_at) >= date(?)")
            params.append(updated_from)
        if updated_to:
            where_clauses.append("date(ar.updated_at) <= date(?)")
            params.append(updated_to)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return (
            f"""
            FROM association_rules AS ar
            INNER JOIN products AS antecedent
                ON antecedent.id = ar.antecedent_product_id
            INNER JOIN products AS consequent
                ON consequent.id = ar.consequent_product_id
            {where_sql}
            """,
            params,
        )
