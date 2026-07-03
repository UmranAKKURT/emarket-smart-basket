from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable


class EMarketDBHelper:
    """
    E-Market Smart Basket projesinin veritabanı kurulum ve seed katmanı.

    Bu sınıf sadece veri katmanından sorumludur:
    - SQLite bağlantısını yönetir.
    - Tabloları oluşturur.
    - Örnek ürünleri ekler.
    - Örnek sipariş geçmişini ekler.

    Not:
    Bu sınıf API, frontend, öneri motoru veya rule mining işlemi yapmaz.
    """

    def __init__(self, db_path: str | Path | None = None, auto_initialize: bool = True) -> None:
        backend_root = Path(__file__).resolve().parents[1]

        self.db_path = Path(db_path) if db_path else backend_root / "database" / "emarket.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        if auto_initialize:
            self.initialize_database()

    def get_connection(self) -> sqlite3.Connection:
        """
        SQLite bağlantısı oluşturur.
        """

        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON;")
        return connection

    def initialize_database(self) -> None:
        """
        Veritabanını hazır hale getirir.
        """

        with self.get_connection() as connection:
            self.create_tables(connection)
            self.create_indexes(connection)
            self.seed_market_data(connection)
            self.seed_order_history(connection)
            connection.commit()

    def create_tables(self, connection: sqlite3.Connection) -> None:
        """
        Proje için gerekli tabloları oluşturur.
        """

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                price REAL NOT NULL CHECK(price >= 0),
                category TEXT NOT NULL,
                emoji TEXT NOT NULL
            );
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),

                UNIQUE(order_id, product_id),

                FOREIGN KEY (order_id)
                    REFERENCES orders(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE,

                FOREIGN KEY (product_id)
                    REFERENCES products(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE
            );
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS association_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                antecedent_product_id INTEGER NOT NULL,
                consequent_product_id INTEGER NOT NULL,
                support REAL NOT NULL CHECK(support >= 0 AND support <= 1),
                confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
                lift REAL NOT NULL CHECK(lift >= 0),
                context_message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(antecedent_product_id, consequent_product_id),

                CHECK(antecedent_product_id <> consequent_product_id),

                FOREIGN KEY (antecedent_product_id)
                    REFERENCES products(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE,

                FOREIGN KEY (consequent_product_id)
                    REFERENCES products(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE
            );
            """
        )

    def create_indexes(self, connection: sqlite3.Connection) -> None:
        """
        Sorguların daha hızlı çalışması için temel indexleri oluşturur.
        """

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_products_category
            ON products(category);
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_orders_user_id
            ON orders(user_id);
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_order_items_order_id
            ON order_items(order_id);
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_order_items_product_id
            ON order_items(product_id);
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_rules_antecedent
            ON association_rules(antecedent_product_id);
            """
        )

    def seed_market_data(self, connection: sqlite3.Connection) -> None:
        """
        Örnek market ürünlerini veritabanına ekler.
        """

        products = self._get_seed_products()

        connection.executemany(
            """
            INSERT OR IGNORE INTO products
                (id, name, price, category, emoji)
            VALUES
                (?, ?, ?, ?, ?);
            """,
            products,
        )

    def seed_order_history(self, connection: sqlite3.Connection) -> None:
        """
        Örnek sipariş geçmişini veritabanına ekler.

        Bu siparişler ilerleyen günlerde rule_miner.py tarafından analiz edilecek.
        Association rule tablosu bu aşamada elle doldurulmaz.
        """

        orders = self._get_seed_orders()

        connection.executemany(
            """
            INSERT OR IGNORE INTO orders
                (id, user_id, created_at)
            VALUES
                (?, ?, ?);
            """,
            orders,
        )

        product_id_map = self._get_product_id_map(connection)
        order_baskets = self._get_seed_order_baskets()

        order_items = self._build_order_items(product_id_map, order_baskets)

        connection.executemany(
            """
            INSERT OR IGNORE INTO order_items
                (order_id, product_id, quantity)
            VALUES
                (?, ?, ?);
            """,
            order_items,
        )

    def _get_product_id_map(self, connection: sqlite3.Connection) -> dict[str, int]:
        """
        Ürün adlarını ürün id değerleriyle eşleştirir.
        """

        rows = connection.execute(
            """
            SELECT id, name
            FROM products;
            """
        ).fetchall()

        return {row["name"]: row["id"] for row in rows}

    def _build_order_items(
        self,
        product_id_map: dict[str, int],
        order_baskets: dict[int, list[tuple[str, int]]],
    ) -> list[tuple[int, int, int]]:
        """
        Ürün isimlerinden order_items tablosuna yazılacak kayıtları üretir.
        """

        order_items: list[tuple[int, int, int]] = []

        for order_id, basket_items in order_baskets.items():
            for product_name, quantity in basket_items:
                product_id = product_id_map.get(product_name)

                if product_id is None:
                    raise ValueError(f"Seed verisinde bulunamayan ürün: {product_name}")

                order_items.append((order_id, product_id, quantity))

        return order_items

    @staticmethod
    def _get_seed_products() -> list[tuple[int, str, float, str, str]]:
        """
        Getir / Trendyol Market tarzı örnek ürünler.
        """

        return [
            # Meyve & Sebze
            (1, "Salkım Domates", 39.90, "Meyve & Sebze", "🍅"),
            (2, "Soğan", 24.90, "Meyve & Sebze", "🧅"),
            (3, "Limon", 29.90, "Meyve & Sebze", "🍋"),
            (4, "Muz", 54.90, "Meyve & Sebze", "🍌"),
            (5, "Elma", 42.50, "Meyve & Sebze", "🍎"),
            (6, "Salatalık", 34.90, "Meyve & Sebze", "🥒"),

            # Süt Ürünleri
            (7, "Ezine Peyniri", 129.90, "Süt Ürünleri", "🧀"),
            (8, "Tam Yağlı Süt", 34.90, "Süt Ürünleri", "🥛"),
            (9, "Yoğurt", 49.90, "Süt Ürünleri", "🥣"),
            (10, "Tereyağı", 99.90, "Süt Ürünleri", "🧈"),
            (11, "Kaşar Peyniri", 119.90, "Süt Ürünleri", "🧀"),
            (12, "Ayran", 17.50, "Süt Ürünleri", "🥛"),

            # Atıştırmalık
            (13, "Patates Cipsi", 44.90, "Atıştırmalık", "🥔"),
            (14, "Çikolata", 32.50, "Atıştırmalık", "🍫"),
            (15, "Kraker", 24.90, "Atıştırmalık", "🥨"),
            (16, "Kuruyemiş Karışık", 89.90, "Atıştırmalık", "🥜"),
            (17, "Bisküvi", 27.90, "Atıştırmalık", "🍪"),

            # İçecek
            (18, "Kola", 39.90, "İçecek", "🥤"),
            (19, "Maden Suyu", 14.90, "İçecek", "🫧"),
            (20, "Portakal Suyu", 49.90, "İçecek", "🧃"),
            (21, "Soğuk Çay", 36.90, "İçecek", "🧋"),

            # Et & Tavuk
            (22, "Dana Kıyma", 249.90, "Et & Tavuk", "🥩"),
            (23, "Tavuk Göğsü", 139.90, "Et & Tavuk", "🍗"),
            (24, "Sucuk", 189.90, "Et & Tavuk", "🌭"),
            (25, "Köfte", 219.90, "Et & Tavuk", "🍖"),

            # Kahvaltılık
            (26, "Yumurta", 74.90, "Kahvaltılık", "🥚"),
            (27, "Zeytin", 84.90, "Kahvaltılık", "🫒"),
            (28, "Bal", 149.90, "Kahvaltılık", "🍯"),
            (29, "Reçel", 79.90, "Kahvaltılık", "🍓"),
            (30, "Ekmek", 12.50, "Kahvaltılık", "🍞"),

            # Temel Gıda
            (31, "Makarna", 24.90, "Temel Gıda", "🍝"),
            (32, "Pirinç", 89.90, "Temel Gıda", "🍚"),
            (33, "Un", 59.90, "Temel Gıda", "🌾"),
            (34, "Zeytinyağı", 189.90, "Temel Gıda", "🫒"),
        ]

    @staticmethod
    def _get_seed_orders() -> list[tuple[int, int, str]]:
        """
        Örnek sipariş üst bilgileri.
        """

        return [
            (1, 101, "2026-07-01 09:15:00"),
            (2, 102, "2026-07-01 10:20:00"),
            (3, 103, "2026-07-01 11:05:00"),
            (4, 104, "2026-07-01 12:30:00"),
            (5, 105, "2026-07-01 13:45:00"),
            (6, 106, "2026-07-01 15:10:00"),
            (7, 107, "2026-07-01 16:25:00"),
            (8, 108, "2026-07-01 17:40:00"),
            (9, 109, "2026-07-01 18:55:00"),
            (10, 110, "2026-07-01 20:05:00"),
            (11, 111, "2026-07-02 09:35:00"),
            (12, 112, "2026-07-02 10:50:00"),
            (13, 113, "2026-07-02 12:15:00"),
            (14, 114, "2026-07-02 14:00:00"),
            (15, 115, "2026-07-02 16:20:00"),
        ]

    @staticmethod
    def _get_seed_order_baskets() -> dict[int, list[tuple[str, int]]]:
        """
        Örnek sepet geçmişi.

        Bu veriler bilinçli şekilde tekrar eden kombinasyonlar içerir.
        Böylece ilerleyen günlerde association rule mining çalıştığında
        anlamlı ürün ilişkileri çıkarılabilir.
        """

        return {
            # Kahvaltı sepetleri: Domates + Peynir + Zeytin + Ekmek
            1: [
                ("Salkım Domates", 1),
                ("Ezine Peyniri", 1),
                ("Zeytin", 1),
                ("Ekmek", 2),
                ("Yumurta", 1),
            ],
            2: [
                ("Salkım Domates", 1),
                ("Ezine Peyniri", 1),
                ("Zeytin", 1),
                ("Ekmek", 1),
            ],
            3: [
                ("Salkım Domates", 1),
                ("Ezine Peyniri", 1),
                ("Salatalık", 1),
                ("Ekmek", 1),
                ("Çay", 1) if False else ("Tam Yağlı Süt", 1),
            ],

            # Yemek sepetleri: Kıyma + Soğan + Makarna
            4: [
                ("Dana Kıyma", 1),
                ("Soğan", 2),
                ("Makarna", 2),
                ("Yoğurt", 1),
            ],
            5: [
                ("Dana Kıyma", 1),
                ("Soğan", 2),
                ("Pirinç", 1),
                ("Yoğurt", 1),
            ],
            6: [
                ("Dana Kıyma", 1),
                ("Soğan", 1),
                ("Makarna", 1),
                ("Zeytinyağı", 1),
            ],

            # Atıştırmalık sepetleri: Cips + Kola + Çikolata
            7: [
                ("Patates Cipsi", 2),
                ("Kola", 1),
                ("Çikolata", 1),
            ],
            8: [
                ("Patates Cipsi", 1),
                ("Kola", 2),
                ("Kraker", 1),
            ],
            9: [
                ("Patates Cipsi", 1),
                ("Kola", 1),
                ("Çikolata", 2),
                ("Kuruyemiş Karışık", 1),
            ],

            # Tavuk hazırlık sepetleri: Tavuk + Limon + Yoğurt
            10: [
                ("Tavuk Göğsü", 1),
                ("Limon", 2),
                ("Yoğurt", 1),
                ("Pirinç", 1),
            ],
            11: [
                ("Tavuk Göğsü", 1),
                ("Limon", 1),
                ("Ayran", 2),
                ("Makarna", 1),
            ],
            12: [
                ("Tavuk Göğsü", 1),
                ("Yoğurt", 1),
                ("Zeytinyağı", 1),
                ("Limon", 1),
            ],

            # Smoothie / ara öğün sepetleri: Muz + Süt
            13: [
                ("Muz", 1),
                ("Tam Yağlı Süt", 1),
                ("Bal", 1),
            ],
            14: [
                ("Muz", 2),
                ("Tam Yağlı Süt", 1),
                ("Bisküvi", 1),
            ],
            15: [
                ("Elma", 1),
                ("Kuruyemiş Karışık", 1),
                ("Maden Suyu", 2),
            ],
        }


if __name__ == "__main__":
    db_helper = EMarketDBHelper()
    print(f"Veritabanı başarıyla hazırlandı: {db_helper.db_path}")