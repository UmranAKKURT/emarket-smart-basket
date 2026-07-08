from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Protocol, Sequence

try:
    from src.db_helper import EMarketDBHelper
    from src.repository import (
        AssociationRuleRepository,
        ProductRepository,
    )
except ModuleNotFoundError:
    from db_helper import EMarketDBHelper
    from repository import (
        AssociationRuleRepository,
        ProductRepository,
    )


class RecommendationEngineError(Exception):
    """
    Öneri motorunda oluşan genel hatalar için kullanılır.
    """

    pass


class BasketValidationError(RecommendationEngineError):
    """
    Sepet verisi geçersiz olduğunda kullanılır.
    """

    pass


class ProductRepositoryProtocol(Protocol):
    """
    RecommendationEngine'in ihtiyaç duyduğu ürün repository davranışları.

    Engine doğrudan ProductRepository sınıfına bağımlı değildir.
    Bu davranışları sağlayan farklı bir repository de kullanılabilir.
    """

    def get_products_by_ids(
        self,
        product_ids: list[int],
    ) -> list[dict[str, Any]]:
        ...


class AssociationRuleRepositoryProtocol(Protocol):
    """
    RecommendationEngine'in ihtiyaç duyduğu kural repository davranışları.
    """

    def get_rules_by_antecedent(
        self,
        antecedent_product_id: int,
    ) -> list[dict[str, Any]]:
        ...


@dataclass(frozen=True, slots=True)
class Recommendation:
    """
    Kullanıcıya sunulacak tek bir ürün önerisini temsil eder.
    """

    source_product_id: int
    source_product_name: str

    recommended_product_id: int
    recommended_product_name: str
    recommended_product_price: float
    recommended_product_category: str
    recommended_product_emoji: str
    co_occurrence_count: int

    support: float
    confidence: float
    lift: float
    context_message: str
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """
        Recommendation nesnesini API'de kullanılabilecek sözlüğe dönüştürür.
        """

        return asdict(self)


class RecommendationEngine:
    """
    Kullanıcının sepetine göre en güçlü ürün önerilerini belirleyen iş mantığı.

    Bu sınıf:
    - SQL sorgusu yazmaz.
    - Veritabanına doğrudan bağlanmaz.
    - API veya frontend işlemi yapmaz.
    - Hazır association rule kayıtlarını değerlendirir.
    """

    def __init__(
        self,
        product_repository: ProductRepositoryProtocol,
        rule_repository: AssociationRuleRepositoryProtocol,
        min_confidence: float = 0.50,
        min_lift: float = 1.00,
    ) -> None:
        self.product_repository = product_repository
        self.rule_repository = rule_repository

        self._validate_thresholds(
            min_confidence=min_confidence,
            min_lift=min_lift,
        )

        self.min_confidence = min_confidence
        self.min_lift = min_lift

    def recommend_one(
        self,
        basket_product_ids: Sequence[int],
    ) -> Recommendation | None:
        """
        Sepet için en güçlü tek öneriyi döndürür.

        Uygun öneri bulunamazsa None döndürür.
        """

        recommendations = self.recommend(
            basket_product_ids=basket_product_ids,
            limit=1,
        )

        if not recommendations:
            return None

        return recommendations[0]

    def recommend(
        self,
        basket_product_ids: Sequence[int],
        limit: int = 3,
    ) -> list[Recommendation]:
        """
        Sepete göre en güçlü ürün önerilerini döndürür.

        Sıralama önceliği:
        1. Confidence
        2. Lift
        3. Support

        Aynı ürün birden fazla sepet ürünü tarafından önerilirse,
        o ürün için yalnızca en güçlü kural korunur.
        """

        if limit <= 0:
            raise BasketValidationError(
                "Öneri limiti sıfırdan büyük olmalıdır."
            )

        normalized_basket = self._normalize_basket(basket_product_ids)

        if not normalized_basket:
            return []

        self._validate_basket_products(normalized_basket)

        recommendations_by_product = self._collect_recommendations(
            basket_product_ids=normalized_basket,
        )

        sorted_recommendations = sorted(
            recommendations_by_product.values(),
            key=self._recommendation_sort_key,
            reverse=True,
        )

        return sorted_recommendations[:limit]

    def _collect_recommendations(
        self,
        basket_product_ids: list[int],
    ) -> dict[int, Recommendation]:
        """
        Sepetteki tüm ürünler için kural adaylarını toplar.

        Anahtar olarak önerilen ürün id değeri kullanılır.
        Böylece aynı ürün birden fazla kez önerilmez.
        """

        basket_product_id_set = set(basket_product_ids)
        recommendations_by_product: dict[int, Recommendation] = {}

        for basket_product_id in basket_product_ids:
            rules = self.rule_repository.get_rules_by_antecedent(
                basket_product_id
            )

            for rule in rules:
                consequent_product_id = rule["consequent_product_id"]

                # Önerilecek ürün zaten sepetteyse gösterilmez.
                if consequent_product_id in basket_product_id_set:
                    continue

                if not self._rule_passes_thresholds(rule):
                    continue

                recommendation = self._build_recommendation(rule)

                current_recommendation = recommendations_by_product.get(
                    consequent_product_id
                )

                if (
                    current_recommendation is None
                    or self._is_stronger_recommendation(
                        candidate=recommendation,
                        current=current_recommendation,
                    )
                ):
                    recommendations_by_product[consequent_product_id] = (
                        recommendation
                    )

        return recommendations_by_product

    def _validate_basket_products(
        self,
        basket_product_ids: list[int],
    ) -> None:
        """
        Sepetteki bütün ürün id değerlerinin veritabanında bulunduğunu doğrular.
        """

        products = self.product_repository.get_products_by_ids(
            basket_product_ids
        )

        existing_product_ids = {
            product["id"]
            for product in products
        }

        missing_product_ids = [
            product_id
            for product_id in basket_product_ids
            if product_id not in existing_product_ids
        ]

        if missing_product_ids:
            missing_ids_text = ", ".join(
                str(product_id)
                for product_id in missing_product_ids
            )

            raise BasketValidationError(
                "Veritabanında bulunamayan ürün id değerleri: "
                f"{missing_ids_text}"
            )

    @staticmethod
    def _normalize_basket(
        basket_product_ids: Sequence[int],
    ) -> list[int]:
        """
        Sepet id listesini doğrular ve tekrar eden id değerlerini temizler.

        Ürün miktarı öneri hesabında kullanılmadığı için aynı ürün id değeri
        yalnızca bir kez değerlendirilir.
        """

        if isinstance(basket_product_ids, (str, bytes)):
            raise BasketValidationError(
                "Sepet ürün id değerlerinden oluşan bir liste olmalıdır."
            )

        normalized_product_ids: list[int] = []
        seen_product_ids: set[int] = set()

        for product_id in basket_product_ids:
            if isinstance(product_id, bool) or not isinstance(product_id, int):
                raise BasketValidationError(
                    "Sepetteki bütün ürün id değerleri tam sayı olmalıdır."
                )

            if product_id <= 0:
                raise BasketValidationError(
                    "Ürün id değerleri sıfırdan büyük olmalıdır."
                )

            if product_id not in seen_product_ids:
                seen_product_ids.add(product_id)
                normalized_product_ids.append(product_id)

        return normalized_product_ids

    def _rule_passes_thresholds(
        self,
        rule: dict[str, Any],
    ) -> bool:
        """
        Kuralın engine eşiklerinden geçip geçmediğini kontrol eder.
        """

        confidence = float(rule["confidence"])
        lift = float(rule["lift"])

        return (
            confidence >= self.min_confidence
            and lift >= self.min_lift
        )

    @staticmethod
    def _build_recommendation(
        rule: dict[str, Any],
    ) -> Recommendation:
        """
        Repository'den gelen kural kaydını Recommendation nesnesine dönüştürür.
        """

        return Recommendation(
            source_product_id=int(rule["antecedent_product_id"]),
            source_product_name=str(rule["antecedent_name"]),
            recommended_product_id=int(rule["consequent_product_id"]),
            recommended_product_name=str(rule["consequent_name"]),
            recommended_product_price=float(rule["consequent_price"]),
            recommended_product_category=str(
                rule["consequent_category"]
            ),
            recommended_product_emoji=str(rule["consequent_emoji"]),
            co_occurrence_count=int(rule.get("co_occurrence_count") or 0),
            support=float(rule["support"]),
            confidence=float(rule["confidence"]),
            lift=float(rule["lift"]),
            context_message=str(rule["context_message"]),
            score=0.0,
        )

    @staticmethod
    def _recommendation_sort_key(
        recommendation: Recommendation,
    ) -> tuple[float, float, float, float]:
        """
        Önerilerin sıralama anahtarını döndürür.
        """

        return (
            recommendation.score,
            recommendation.confidence,
            recommendation.lift,
            recommendation.support,
        )

    def _is_stronger_recommendation(
        self,
        candidate: Recommendation,
        current: Recommendation,
    ) -> bool:
        """
        İki öneriden hangisinin daha güçlü olduğunu karşılaştırır.
        """

        return (
            self._recommendation_sort_key(candidate)
            > self._recommendation_sort_key(current)
        )

    @staticmethod
    def _validate_thresholds(
        min_confidence: float,
        min_lift: float,
    ) -> None:
        """
        Engine eşiklerini doğrular.
        """

        if not 0 <= min_confidence <= 1:
            raise ValueError(
                "Minimum confidence değeri 0 ile 1 arasında olmalıdır."
            )

        if min_lift < 0:
            raise ValueError(
                "Minimum lift değeri negatif olamaz."
            )


if __name__ == "__main__":
    db_helper = EMarketDBHelper()

    product_repository = ProductRepository(db_helper)
    rule_repository = AssociationRuleRepository(db_helper)

    if rule_repository.count_rules() == 0:
        raise RecommendationEngineError(
            "Association rule tablosu boş. "
            "Önce 'python src/rule_miner.py' komutunu çalıştır."
        )

    engine = RecommendationEngine(
        product_repository=product_repository,
        rule_repository=rule_repository,
        min_confidence=0.50,
        min_lift=1.00,
    )

    domates = product_repository.get_product_by_name(
        "Salkım Domates"
    )

    if domates is None:
        raise RecommendationEngineError(
            "Test ürünü olan Salkım Domates bulunamadı."
        )

    basket_product_ids = [domates["id"]]

    print("Sepetteki ürün:")
    print(f"- {domates['emoji']} {domates['name']}")
    print("-" * 70)

    recommendation = engine.recommend_one(basket_product_ids)

    if recommendation is None:
        print("Bu sepet için uygun öneri bulunamadı.")
    else:
        print("En güçlü öneri:")
        print(
            f"- {recommendation.recommended_product_emoji} "
            f"{recommendation.recommended_product_name}"
        )
        print(
            f"- Fiyat: {recommendation.recommended_product_price:.2f} TL"
        )
        print(
            f"- Confidence: {recommendation.confidence:.2%}"
        )
        print(
            f"- Lift: {recommendation.lift:.2f}"
        )
        print(
            f"- Support: {recommendation.support:.2%}"
        )
        print(
            f"- Mesaj: {recommendation.context_message}"
        )
