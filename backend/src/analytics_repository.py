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
                        AS total_categories
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
                    ar.context_message
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
