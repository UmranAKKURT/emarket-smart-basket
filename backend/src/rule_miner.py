from __future__ import annotations

from collections import Counter
from itertools import combinations
from typing import Any

try:
    from src.db_helper import EMarketDBHelper
    from src.repository import (
        AssociationRuleRepository,
        OrderRepository,
        ProductRepository,
    )
except ModuleNotFoundError:
    from db_helper import EMarketDBHelper
    from repository import (
        AssociationRuleRepository,
        OrderRepository,
        ProductRepository,
    )


class RuleMiningError(Exception):
    """
    Rule mining işlemi sırasında oluşan özel hatalar için kullanılır.
    """

    pass


class AssociationRuleMiner:
    """
    Geçmiş siparişlerden association rule üreten sınıf.

    Bu sınıfın görevi:
    - Sipariş geçmişini repository katmanından almak
    - Ürün birlikteliklerini hesaplamak
    - Support, confidence ve lift değerlerini üretmek
    - Üretilen kuralları association_rules tablosuna kaydetmek

    Not:
    Bu sınıf UI, API veya frontend işlemi yapmaz.
    """

    def __init__(
        self,
        product_repository: ProductRepository,
        order_repository: OrderRepository,
        rule_repository: AssociationRuleRepository,
        min_support: float = 0.13,
        min_confidence: float = 0.50,
        min_lift: float = 1.00,
    ) -> None:
        self.product_repository = product_repository
        self.order_repository = order_repository
        self.rule_repository = rule_repository

        self.min_support = min_support
        self.min_confidence = min_confidence
        self.min_lift = min_lift

    def mine_rules(self) -> list[dict[str, Any]]:
        """
        Sipariş geçmişinden association rule listesi üretir.

        Dönüş formatı:
        [
            {
                "antecedent_product_id": 1,
                "consequent_product_id": 7,
                "support": 0.2,
                "confidence": 1.0,
                "lift": 5.0,
                "context_message": "..."
            }
        ]
        """

        baskets = self.order_repository.get_all_order_baskets()

        if not baskets:
            raise RuleMiningError("Rule mining için sipariş geçmişi bulunamadı.")

        total_orders = len(baskets)

        product_counts = self._count_product_occurrences(baskets)
        pair_counts = self._count_product_pair_occurrences(baskets)
        product_lookup = self._get_product_lookup()

        rules = self._generate_rules(
            total_orders=total_orders,
            product_counts=product_counts,
            pair_counts=pair_counts,
            product_lookup=product_lookup,
        )

        rules.sort(
            key=lambda rule: (
                rule["confidence"],
                rule["lift"],
                rule["support"],
            ),
            reverse=True,
        )

        return rules

    def mine_and_save_rules(self, clear_existing: bool = True) -> int:
        """
        Kuralları üretir ve association_rules tablosuna kaydeder.

        clear_existing=True ise eski kurallar temizlenir.
        """

        rules = self.mine_rules()

        if clear_existing:
            self.rule_repository.clear_rules()

        self.rule_repository.insert_many_rules(rules)

        return len(rules)

    @staticmethod
    def _count_product_occurrences(
        baskets: dict[int, list[int]],
    ) -> Counter[int]:
        """
        Her ürünün kaç farklı siparişte geçtiğini hesaplar.

        Quantity dikkate alınmaz.
        Bir ürün aynı siparişte birden fazla olsa bile 1 kez sayılır.
        """

        product_counts: Counter[int] = Counter()

        for product_ids in baskets.values():
            unique_product_ids = set(product_ids)
            product_counts.update(unique_product_ids)

        return product_counts

    @staticmethod
    def _count_product_pair_occurrences(
        baskets: dict[int, list[int]],
    ) -> Counter[tuple[int, int]]:
        """
        Ürün çiftlerinin kaç farklı siparişte birlikte geçtiğini hesaplar.
        """

        pair_counts: Counter[tuple[int, int]] = Counter()

        for product_ids in baskets.values():
            unique_product_ids = sorted(set(product_ids))

            for first_product_id, second_product_id in combinations(unique_product_ids, 2):
                pair_counts[(first_product_id, second_product_id)] += 1

        return pair_counts

    def _generate_rules(
        self,
        total_orders: int,
        product_counts: Counter[int],
        pair_counts: Counter[tuple[int, int]],
        product_lookup: dict[int, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Ürün çiftlerinden iki yönlü association rule üretir.

        Örneğin:
        Domates + Peynir birlikte geçiyorsa hem

        Domates → Peynir

        hem de

        Peynir → Domates

        adayı hesaplanır.
        """

        rules: list[dict[str, Any]] = []

        for (first_product_id, second_product_id), pair_count in pair_counts.items():
            candidate_rules = [
                (first_product_id, second_product_id),
                (second_product_id, first_product_id),
            ]

            for antecedent_id, consequent_id in candidate_rules:
                rule = self._calculate_single_rule(
                    antecedent_id=antecedent_id,
                    consequent_id=consequent_id,
                    pair_count=pair_count,
                    total_orders=total_orders,
                    product_counts=product_counts,
                    product_lookup=product_lookup,
                )

                if rule is not None:
                    rules.append(rule)

        return rules

    def _calculate_single_rule(
        self,
        antecedent_id: int,
        consequent_id: int,
        pair_count: int,
        total_orders: int,
        product_counts: Counter[int],
        product_lookup: dict[int, dict[str, Any]],
    ) -> dict[str, Any] | None:
        """
        Tek bir A → B kuralı için support, confidence ve lift hesaplar.
        """

        antecedent_count = product_counts[antecedent_id]
        consequent_count = product_counts[consequent_id]

        support = pair_count / total_orders
        confidence = pair_count / antecedent_count
        consequent_support = consequent_count / total_orders
        lift = confidence / consequent_support if consequent_support > 0 else 0

        if not self._passes_thresholds(support, confidence, lift):
            return None

        context_message = self._build_context_message(
            antecedent_id=antecedent_id,
            consequent_id=consequent_id,
            product_lookup=product_lookup,
        )

        return {
            "antecedent_product_id": antecedent_id,
            "consequent_product_id": consequent_id,
            "support": round(support, 4),
            "confidence": round(confidence, 4),
            "lift": round(lift, 4),
            "context_message": context_message,
        }

    def _passes_thresholds(
        self,
        support: float,
        confidence: float,
        lift: float,
    ) -> bool:
        """
        Hesaplanan kuralın minimum eşiklerden geçip geçmediğini kontrol eder.
        """

        return (
            support >= self.min_support
            and confidence >= self.min_confidence
            and lift >= self.min_lift
        )

    def _get_product_lookup(self) -> dict[int, dict[str, Any]]:
        """
        Ürünleri id değerine göre erişilebilir sözlük formatına çevirir.
        """

        products = self.product_repository.get_all_products()

        return {
            product["id"]: product
            for product in products
        }

    def _build_context_message(
        self,
        antecedent_id: int,
        consequent_id: int,
        product_lookup: dict[int, dict[str, Any]],
    ) -> str:
        """
        Kullanıcıya gösterilecek dostane öneri mesajını üretir.
        """

        antecedent = product_lookup[antecedent_id]
        consequent = product_lookup[consequent_id]

        antecedent_name = antecedent["name"]
        antecedent_emoji = antecedent["emoji"]

        consequent_name = consequent["name"]
        consequent_emoji = consequent["emoji"]

        custom_messages = {
            ("Salkım Domates", "Ezine Peyniri"): (
                "Tarifini Tamamla: Domatesin yanına Ezine Peyniri çok iyi gider! 🍅🧀"
            ),
            ("Ezine Peyniri", "Salkım Domates"): (
                "Kahvaltı Sepeti: Peynirin yanına taze domates eklemeyi unutma! 🧀🍅"
            ),
            ("Dana Kıyma", "Soğan"): (
                "Yemek Hazırlığı: Kıymanın yanına soğan ekleyerek tarifini tamamlayabilirsin. 🥩🧅"
            ),
            ("Soğan", "Dana Kıyma"): (
                "Akşam Yemeği Fikri: Soğanın yanına dana kıyma ekleyerek güzel bir yemek hazırlayabilirsin. 🧅🥩"
            ),
            ("Patates Cipsi", "Kola"): (
                "Film Keyfi: Cipsin yanına kola ekleyerek atıştırmalık menünü tamamla. 🥔🥤"
            ),
            ("Kola", "Patates Cipsi"): (
                "Atıştırmalık Önerisi: Kola sepetindeyken patates cipsi de iyi gider. 🥤🥔"
            ),
            ("Tavuk Göğsü", "Limon"): (
                "Marine Önerisi: Tavuk göğsünün yanına limon ekleyerek lezzeti artırabilirsin. 🍗🍋"
            ),
            ("Limon", "Tavuk Göğsü"): (
                "Yemek Hazırlığı: Limonun yanına tavuk göğsü ekleyerek pratik bir menü oluşturabilirsin. 🍋🍗"
            ),
            ("Muz", "Tam Yağlı Süt"): (
                "Smoothie Fikri: Muz ve sütle hızlı bir içecek hazırlayabilirsin. 🍌🥛"
            ),
            ("Tam Yağlı Süt", "Muz"): (
                "Ara Öğün Önerisi: Sütün yanına muz ekleyerek smoothie hazırlayabilirsin. 🥛🍌"
            ),
        }

        custom_message = custom_messages.get((antecedent_name, consequent_name))

        if custom_message:
            return custom_message

        return (
            f"Sepetini Tamamla: {antecedent_emoji} {antecedent_name} alanlar "
            f"{consequent_emoji} {consequent_name} ürününü de tercih ediyor."
        )


if __name__ == "__main__":
    db_helper = EMarketDBHelper()

    product_repository = ProductRepository(db_helper)
    order_repository = OrderRepository(db_helper)
    rule_repository = AssociationRuleRepository(db_helper)

    rule_miner = AssociationRuleMiner(
        product_repository=product_repository,
        order_repository=order_repository,
        rule_repository=rule_repository,
        min_support=0.13,
        min_confidence=0.50,
        min_lift=1.00,
    )

    created_rule_count = rule_miner.mine_and_save_rules(clear_existing=True)

    print("Rule mining işlemi başarıyla tamamlandı.")
    print("-" * 60)
    print(f"Oluşturulan association rule sayısı: {created_rule_count}")
    print(f"Veritabanındaki toplam rule sayısı: {rule_repository.count_rules()}")
    print("-" * 60)

    print("En güçlü ilk 10 kural:")

    top_rules = rule_repository.get_all_rules()[:10]

    for rule in top_rules:
        print(
            f"{rule['antecedent_name']} → {rule['consequent_name']} | "
            f"support={rule['support']} | "
            f"confidence={rule['confidence']} | "
            f"lift={rule['lift']}"
        )