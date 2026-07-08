from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Iterable

try:
    from src.db_helper import EMarketDBHelper
except ModuleNotFoundError:
    from db_helper import EMarketDBHelper


class RepositoryError(Exception):
    """
    Repository katmanında oluşan özel hatalar için kullanılır.
    """

    pass


class BaseRepository:
    """
    Tüm repository sınıfları için ortak temel sınıf.

    Bu sınıf veritabanı bağlantısını doğrudan oluşturmaz.
    Bağlantı yönetimini EMarketDBHelper sınıfından alır.
    Böylece repository katmanı db_helper katmanına gevşek bağlı kalır.
    """

    def __init__(self, db_helper: EMarketDBHelper | None = None) -> None:
        self.db_helper = db_helper or EMarketDBHelper()

    @staticmethod
    def _row_to_dict(row: Any) -> dict[str, Any] | None:
        if row is None:
            return None

        return dict(row)

    @staticmethod
    def _rows_to_dicts(rows: Iterable[Any]) -> list[dict[str, Any]]:
        return [dict(row) for row in rows]


class ProductRepository(BaseRepository):
    """
    Ürünlerle ilgili veritabanı sorgularını yöneten repository sınıfı.
    """

    def get_all_products(self) -> list[dict[str, Any]]:
        """
        Tüm ürünleri kategori ve ürün adına göre sıralı getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                ORDER BY category ASC, name ASC;
                """
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_product_by_id(self, product_id: int) -> dict[str, Any] | None:
        """
        Ürün id değerine göre tek ürün getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                WHERE id = ?;
                """,
                (product_id,),
            ).fetchone()

        return self._row_to_dict(row)

    def get_product_by_name(self, product_name: str) -> dict[str, Any] | None:
        """
        Ürün adına göre tek ürün getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                WHERE name = ?;
                """,
                (product_name,),
            ).fetchone()

        return self._row_to_dict(row)

    def get_products_by_category(self, category: str) -> list[dict[str, Any]]:
        """
        Belirli bir kategoriye ait ürünleri getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                WHERE category = ?
                ORDER BY name ASC;
                """,
                (category,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_categories(self) -> list[str]:
        """
        Sistemde bulunan ürün kategorilerini getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT DISTINCT category
                FROM products
                ORDER BY category ASC;
                """
            ).fetchall()

        return [row["category"] for row in rows]

    def search_products(self, keyword: str) -> list[dict[str, Any]]:
        """
        Ürün adı veya kategori içinde arama yapar.
        """

        search_pattern = f"%{keyword.strip()}%"

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                WHERE name LIKE ? OR category LIKE ?
                ORDER BY category ASC, name ASC;
                """,
                (search_pattern, search_pattern),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_products_by_ids(self, product_ids: list[int]) -> list[dict[str, Any]]:
        """
        Birden fazla ürün id değerine göre ürünleri getirir.

        Bu metot ileride sepetteki ürün detaylarını göstermek için kullanılabilir.
        """

        if not product_ids:
            return []

        placeholders = ", ".join("?" for _ in product_ids)

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT
                    id,
                    name,
                    price,
                    category,
                    emoji
                FROM products
                WHERE id IN ({placeholders})
                ORDER BY category ASC, name ASC;
                """,
                tuple(product_ids),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def count_products(self) -> int:
        """
        Toplam ürün sayısını getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM products;
                """
            ).fetchone()

        return int(row["total"])


class OrderRepository(BaseRepository):
    """
    Sipariş ve sipariş kalemleriyle ilgili sorguları yöneten repository sınıfı.
    """

    def create_order(
        self,
        user_id: int,
        items: list[dict[str, int]],
    ) -> int:
        """
        Siparişi ve kalemlerini tek transaction içinde kaydeder.

        Repository, servis katmanındaki kontrole ek olarak ürün id değerlerini
        transaction içinde yeniden doğrular. Böylece eksik ürün durumunda
        kısmi sipariş kaydı oluşmaz.
        """

        merged_items: dict[int, int] = {}
        for item in items:
            product_id = int(item["product_id"])
            quantity = int(item["quantity"])
            merged_items[product_id] = merged_items.get(product_id, 0) + quantity

        if not merged_items:
            raise RepositoryError("Sipariş en az bir ürün içermelidir.")

        connection = self.db_helper.get_connection()

        try:
            connection.execute("BEGIN;")

            product_ids = list(merged_items)
            placeholders = ", ".join("?" for _ in product_ids)
            rows = connection.execute(
                f"SELECT id, price FROM products WHERE id IN ({placeholders});",
                tuple(product_ids),
            ).fetchall()
            existing_product_ids = {int(row["id"]) for row in rows}
            product_prices = {
                int(row["id"]): float(row["price"])
                for row in rows
            }
            missing_product_ids = sorted(set(product_ids) - existing_product_ids)

            if missing_product_ids:
                raise RepositoryError(
                    "Bulunamayan ürün id değerleri: "
                    + ", ".join(str(product_id) for product_id in missing_product_ids)
                )

            cursor = connection.execute(
                """
                INSERT INTO orders (user_id, created_at)
                VALUES (?, ?);
                """,
                (
                    user_id,
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
            order_id = int(cursor.lastrowid)

            connection.executemany(
                """
                INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price)
                VALUES (?, ?, ?, ?);
                """,
                [
                    (
                        order_id,
                        product_id,
                        quantity,
                        product_prices[product_id],
                    )
                    for product_id, quantity in merged_items.items()
                ],
            )
            connection.commit()
            return order_id
        except RepositoryError:
            connection.rollback()
            raise
        except (sqlite3.Error, KeyError, TypeError, ValueError) as exception:
            connection.rollback()
            raise RepositoryError(
                "Sipariş veritabanına kaydedilemedi."
            ) from exception
        finally:
            connection.close()

    def get_order_summary(self, order_id: int) -> dict[str, Any] | None:
        """
        Sipariş üst bilgisini, ürünlerini ve veritabanı fiyatlı toplamını getirir.
        """

        with self.db_helper.get_connection() as connection:
            order_row = connection.execute(
                """
                SELECT id, user_id, created_at
                FROM orders
                WHERE id = ?;
                """,
                (order_id,),
            ).fetchone()

            if order_row is None:
                return None

            item_rows = connection.execute(
                """
                SELECT
                    oi.product_id,
                    p.name AS product_name,
                    p.emoji,
                    COALESCE(oi.unit_price, p.price) AS price,
                    oi.quantity,
                    ROUND(
                        COALESCE(oi.unit_price, p.price) * oi.quantity,
                        2
                    ) AS line_total
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC;
                """,
                (order_id,),
            ).fetchall()

        items = self._rows_to_dicts(item_rows)
        total_amount = round(
            sum(float(item["line_total"]) for item in items),
            2,
        )

        return {
            "order_id": int(order_row["id"]),
            "user_id": int(order_row["user_id"]),
            "created_at": order_row["created_at"],
            "items": items,
            "total_amount": total_amount,
        }

    def get_orders_by_user(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Kullanıcının siparişlerini özet bilgilerle en yeniden eskiye getirir."""

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    o.id AS order_id,
                    o.user_id,
                    o.created_at,
                    COUNT(DISTINCT oi.product_id) AS item_count,
                    SUM(oi.quantity) AS total_quantity,
                    ROUND(
                        SUM(COALESCE(oi.unit_price, p.price) * oi.quantity),
                        2
                    ) AS total_amount
                FROM orders AS o
                INNER JOIN order_items AS oi
                    ON oi.order_id = o.id
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE o.user_id = ?
                GROUP BY o.id, o.user_id, o.created_at
                ORDER BY o.created_at DESC, o.id DESC
                LIMIT ? OFFSET ?;
                """,
                (user_id, limit, offset),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def count_orders_by_user(self, user_id: int) -> int:
        """Kullanıcının toplam sipariş sayısını getirir."""

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM orders
                WHERE user_id = ?;
                """,
                (user_id,),
            ).fetchone()

        return int(row["total"])

    def get_order_summary_for_user(
        self,
        order_id: int,
        user_id: int,
    ) -> dict[str, Any] | None:
        """Sipariş kullanıcıya aitse detay özetini, aksi halde None döndürür."""

        with self.db_helper.get_connection() as connection:
            order_row = connection.execute(
                """
                SELECT id, user_id, created_at
                FROM orders
                WHERE id = ? AND user_id = ?;
                """,
                (order_id, user_id),
            ).fetchone()

            if order_row is None:
                return None

            item_rows = connection.execute(
                """
                SELECT
                    oi.product_id,
                    p.name AS product_name,
                    p.emoji,
                    COALESCE(oi.unit_price, p.price) AS price,
                    oi.quantity,
                    ROUND(
                        COALESCE(oi.unit_price, p.price) * oi.quantity,
                        2
                    ) AS line_total
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC;
                """,
                (order_id,),
            ).fetchall()

        items = self._rows_to_dicts(item_rows)

        return {
            "order_id": int(order_row["id"]),
            "user_id": int(order_row["user_id"]),
            "created_at": order_row["created_at"],
            "items": items,
            "total_amount": round(
                sum(float(item["line_total"]) for item in items),
                2,
            ),
        }

    def get_all_orders(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        """
        Siparişleri sayfalama mantığıyla getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    user_id,
                    created_at
                FROM orders
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?;
                """,
                (limit, offset),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_order_by_id(self, order_id: int) -> dict[str, Any] | None:
        """
        Sipariş id değerine göre tek sipariş getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT
                    id,
                    user_id,
                    created_at
                FROM orders
                WHERE id = ?;
                """,
                (order_id,),
            ).fetchone()

        return self._row_to_dict(row)

    def get_order_items(self, order_id: int) -> list[dict[str, Any]]:
        """
        Bir siparişin içindeki ürünleri detaylı şekilde getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    oi.order_id,
                    oi.product_id,
                    p.name AS product_name,
                    p.category,
                    COALESCE(oi.unit_price, p.price) AS price,
                    p.emoji,
                    oi.quantity,
                    ROUND(
                        COALESCE(oi.unit_price, p.price) * oi.quantity,
                        2
                    ) AS line_total
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY p.category ASC, p.name ASC;
                """,
                (order_id,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_order_basket_product_names(self, order_id: int) -> list[str]:
        """
        Bir siparişteki ürün adlarını liste olarak getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT p.name
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY p.name ASC;
                """,
                (order_id,),
            ).fetchall()

        return [row["name"] for row in rows]

    def get_all_order_baskets(self) -> dict[int, list[int]]:
        """
        Tüm siparişleri rule mining için sepet formatında getirir.

        Dönüş formatı:
        {
            1: [1, 7, 27, 30],
            2: [1, 7, 27, 30],
            ...
        }

        Burada listelerde ürün id değerleri bulunur.
        Bu metot 3. günde rule_miner.py tarafından kullanılacak.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    oi.order_id,
                    oi.product_id
                FROM order_items AS oi
                INNER JOIN orders AS o
                    ON o.id = oi.order_id
                ORDER BY oi.order_id ASC, oi.product_id ASC;
                """
            ).fetchall()

        baskets: dict[int, list[int]] = {}

        for row in rows:
            order_id = row["order_id"]
            product_id = row["product_id"]

            if order_id not in baskets:
                baskets[order_id] = []

            baskets[order_id].append(product_id)

        return baskets

    def get_all_order_basket_names(self) -> dict[int, list[str]]:
        """
        Tüm siparişleri ürün adlarıyla birlikte getirir.

        Bu metot test ve kontrol amacıyla faydalıdır.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    oi.order_id,
                    p.name AS product_name
                FROM order_items AS oi
                INNER JOIN products AS p
                    ON p.id = oi.product_id
                ORDER BY oi.order_id ASC, p.name ASC;
                """
            ).fetchall()

        baskets: dict[int, list[str]] = {}

        for row in rows:
            order_id = row["order_id"]
            product_name = row["product_name"]

            if order_id not in baskets:
                baskets[order_id] = []

            baskets[order_id].append(product_name)

        return baskets

    def count_orders(self) -> int:
        """
        Toplam sipariş sayısını getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM orders;
                """
            ).fetchone()

        return int(row["total"])

    def count_order_items(self) -> int:
        """
        Toplam sipariş kalemi sayısını getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM order_items;
                """
            ).fetchone()

        return int(row["total"])


class AssociationRuleRepository(BaseRepository):
    """
    Association rule kayıtlarıyla ilgili veritabanı işlemlerini yöneten sınıf.

    Not:
    Bu sınıf kural hesaplamaz.
    Sadece association_rules tablosunu okur veya yazar.
    Kural hesaplama işlemi 3. günde rule_miner.py içinde yapılacak.
    """

    def get_all_rules(self) -> list[dict[str, Any]]:
        """
        Tüm association rule kayıtlarını ürün adlarıyla birlikte getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    ar.id,
                    ar.antecedent_product_id,
                    p1.name AS antecedent_name,
                    ar.consequent_product_id,
                    p2.name AS consequent_name,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                FROM association_rules AS ar
                INNER JOIN products AS p1
                    ON p1.id = ar.antecedent_product_id
                INNER JOIN products AS p2
                    ON p2.id = ar.consequent_product_id
                ORDER BY ar.confidence DESC, ar.lift DESC;
                """
            ).fetchall()

        return self._rows_to_dicts(rows)

    def get_rules_by_antecedent(self, antecedent_product_id: int) -> list[dict[str, Any]]:
        """
        Belirli bir üründen çıkan öneri kurallarını getirir.
        """

        with self.db_helper.get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    ar.id,
                    ar.antecedent_product_id,
                    p1.name AS antecedent_name,
                    ar.consequent_product_id,
                    p2.name AS consequent_name,
                    p2.price AS consequent_price,
                    p2.category AS consequent_category,
                    p2.emoji AS consequent_emoji,
                    (
                        SELECT COUNT(DISTINCT left_item.order_id)
                        FROM order_items AS left_item
                        INNER JOIN order_items AS right_item
                            ON right_item.order_id = left_item.order_id
                        WHERE left_item.product_id = ar.antecedent_product_id
                            AND right_item.product_id = ar.consequent_product_id
                    ) AS co_occurrence_count,
                    ar.support,
                    ar.confidence,
                    ar.lift,
                    ar.context_message,
                    ar.created_at,
                    ar.updated_at,
                    ar.calculation_count,
                    ar.is_active
                FROM association_rules AS ar
                INNER JOIN products AS p1
                    ON p1.id = ar.antecedent_product_id
                INNER JOIN products AS p2
                    ON p2.id = ar.consequent_product_id
                WHERE ar.antecedent_product_id = ?
                    AND ar.is_active = 1
                ORDER BY ar.confidence DESC, ar.lift DESC;
                """,
                (antecedent_product_id,),
            ).fetchall()

        return self._rows_to_dicts(rows)

    def insert_rule(
        self,
        antecedent_product_id: int,
        consequent_product_id: int,
        support: float,
        confidence: float,
        lift: float,
        context_message: str,
    ) -> None:
        """
        Tek bir association rule kaydını ekler veya günceller.
        """

        try:
            with self.db_helper.get_connection() as connection:
                connection.execute(
                    """
                    INSERT INTO association_rules
                        (
                            antecedent_product_id,
                            consequent_product_id,
                            support,
                            confidence,
                            lift,
                            context_message,
                            updated_at,
                            calculation_count,
                            is_active
                        )
                    VALUES
                        (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 1)
                    ON CONFLICT(antecedent_product_id, consequent_product_id)
                    DO UPDATE SET
                        support = excluded.support,
                        confidence = excluded.confidence,
                        lift = excluded.lift,
                        context_message = excluded.context_message,
                        updated_at = CURRENT_TIMESTAMP,
                        calculation_count = COALESCE(association_rules.calculation_count, 1) + 1,
                        is_active = 1;
                    """,
                    (
                        antecedent_product_id,
                        consequent_product_id,
                        support,
                        confidence,
                        lift,
                        context_message,
                    ),
                )

                connection.commit()

        except Exception as exc:
            raise RepositoryError(f"Association rule eklenirken hata oluştu: {exc}") from exc

    def insert_many_rules(self, rules: list[dict[str, Any]]) -> None:
        """
        Birden fazla association rule kaydını ekler veya günceller.

        Bu metot 3. günde rule_miner.py tarafından kullanılacak.
        """

        if not rules:
            return

        try:
            with self.db_helper.get_connection() as connection:
                connection.executemany(
                    """
                    INSERT INTO association_rules
                        (
                            antecedent_product_id,
                            consequent_product_id,
                            support,
                            confidence,
                            lift,
                            context_message,
                            updated_at,
                            calculation_count,
                            is_active
                        )
                    VALUES
                        (
                            :antecedent_product_id,
                            :consequent_product_id,
                            :support,
                            :confidence,
                            :lift,
                            :context_message,
                            CURRENT_TIMESTAMP,
                            1,
                            1
                        )
                    ON CONFLICT(antecedent_product_id, consequent_product_id)
                    DO UPDATE SET
                        support = excluded.support,
                        confidence = excluded.confidence,
                        lift = excluded.lift,
                        context_message = excluded.context_message,
                        updated_at = CURRENT_TIMESTAMP,
                        calculation_count = COALESCE(association_rules.calculation_count, 1) + 1,
                        is_active = 1;
                    """,
                    rules,
                )

                connection.commit()

        except Exception as exc:
            raise RepositoryError(
                "Association rule kayıtları eklenirken hata oluştu: "
                f"{exc}"
            ) from exc

    def clear_rules(self) -> None:
        """
        Kuralları veri kaybı oluşturmadan pasif hale getirir.

        Eski çağrılarla geriye uyumluluk için metot adı korunur; artık kayıt
        silmek yerine geçmişi saklar ve aktif görünümden çıkarır.
        """

        with self.db_helper.get_connection() as connection:
            connection.execute(
                """
                UPDATE association_rules
                SET is_active = 0,
                    updated_at = CURRENT_TIMESTAMP;
                """
            )
            connection.commit()

    def deactivate_rules_not_in(self, rules: list[dict[str, Any]]) -> None:
        """Son hesaplamada üretilmeyen kuralları silmeden pasifleştirir."""

        active_pairs = {
            (int(rule["antecedent_product_id"]), int(rule["consequent_product_id"]))
            for rule in rules
        }

        with self.db_helper.get_connection() as connection:
            existing_rows = connection.execute(
                """
                SELECT antecedent_product_id, consequent_product_id
                FROM association_rules;
                """
            ).fetchall()

            stale_pairs = [
                (row["antecedent_product_id"], row["consequent_product_id"])
                for row in existing_rows
                if (row["antecedent_product_id"], row["consequent_product_id"])
                not in active_pairs
            ]

            if stale_pairs:
                connection.executemany(
                    """
                    UPDATE association_rules
                    SET is_active = 0,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE antecedent_product_id = ?
                        AND consequent_product_id = ?;
                    """,
                    stale_pairs,
                )
                connection.commit()

    def count_rules(self) -> int:
        """
        Toplam association rule sayısını getirir.
        """

        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM association_rules;
                """
            ).fetchone()

        return int(row["total"])


if __name__ == "__main__":
    db_helper = EMarketDBHelper()

    product_repository = ProductRepository(db_helper)
    order_repository = OrderRepository(db_helper)
    rule_repository = AssociationRuleRepository(db_helper)

    print("Repository katmanı başarıyla çalıştı.")
    print("-" * 50)

    print(f"Toplam ürün sayısı: {product_repository.count_products()}")
    print(f"Toplam sipariş sayısı: {order_repository.count_orders()}")
    print(f"Toplam sipariş kalemi sayısı: {order_repository.count_order_items()}")
    print(f"Toplam association rule sayısı: {rule_repository.count_rules()}")

    print("-" * 50)

    print("Kategoriler:")
    for category in product_repository.get_categories():
        print(f"- {category}")

    print("-" * 50)

    print("1 numaralı sipariş sepeti:")
    for product_name in order_repository.get_order_basket_product_names(order_id=1):
        print(f"- {product_name}")
