from fastapi.testclient import TestClient

from src.engine import Recommendation, RecommendationEngine
from src.recommendation_service import RecommendationService
from src.rule_miner import AssociationRuleMiner


def test_tomato_has_recommendation(
    client: TestClient,
    products: list[dict],
) -> None:
    tomato_id = next(
        product["id"]
        for product in products
        if product["name"] == "Salkım Domates"
    )

    response = client.post(
        "/api/v1/recommendations",
        json={"basket_product_ids": [tomato_id], "limit": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recommendations"]

    recommendation = data["recommendations"][0]
    assert recommendation["recommended_product_id"] != tomato_id
    assert recommendation["recommended_product_id"] not in data["basket_product_ids"]
    assert "confidence" in recommendation
    assert "lift" in recommendation
    assert "support" in recommendation
    assert "score" in recommendation
    assert recommendation["context_message"]
    assert len(data["recommendations"]) <= 5
    scores = [item["score"] for item in data["recommendations"]]
    assert scores == sorted(scores, reverse=True)
    expected_score = round(
        0.45 * recommendation["confidence"]
        + 0.35 * recommendation["lift"]
        + 0.20 * recommendation["support"],
        6,
    )
    assert recommendation["score"] == expected_score
    assert recommendation["co_occurrence_count"] > 0


def test_recommendations_reject_unknown_product(client: TestClient) -> None:
    response = client.post(
        "/api/v1/recommendations",
        json={"basket_product_ids": [999999], "limit": 3},
    )

    assert response.status_code == 422


class FakeRecommendationEngine:
    def __init__(self, recommendations: list[Recommendation]) -> None:
        self.recommendations = recommendations
        self.last_limit = object()

    def recommend(
        self,
        basket_product_ids: list[int],
        limit: int | None = 3,
    ) -> list[Recommendation]:
        self.last_limit = limit
        if limit is None:
            return self.recommendations
        return self.recommendations[:limit]


def make_recommendation(
    product_id: int,
    confidence: float,
    lift: float,
    support: float,
) -> Recommendation:
    return Recommendation(
        source_product_id=1,
        source_product_name="Kaynak Ürün",
        recommended_product_id=product_id,
        recommended_product_name=f"Öneri {product_id}",
        recommended_product_price=10.0,
        recommended_product_category="Test",
        recommended_product_emoji="🛒",
        co_occurrence_count=2,
        support=support,
        confidence=confidence,
        lift=lift,
        context_message="Test kuralı",
    )


def test_recommendation_service_scores_all_engine_candidates_without_prefilter_limit() -> None:
    weaker_first_candidates = [
        make_recommendation(product_id, confidence=0.95, lift=1.0, support=0.1)
        for product_id in range(2, 12)
    ]
    late_high_score_candidate = make_recommendation(
        product_id=99,
        confidence=0.70,
        lift=3.0,
        support=0.4,
    )
    fake_engine = FakeRecommendationEngine(
        [*weaker_first_candidates, late_high_score_candidate]
    )
    service = RecommendationService(fake_engine)

    recommendations = service.get_recommendations([1], limit=1)

    assert fake_engine.last_limit is None
    assert recommendations[0].recommended_product_id == 99
    assert recommendations[0].score == round(
        0.45 * 0.70 + 0.35 * 3.0 + 0.20 * 0.4,
        6,
    )


class FakeProductRepository:
    def get_products_by_ids(self, product_ids: list[int]) -> list[dict]:
        return [{"id": product_id} for product_id in product_ids]


class FakeRuleRepository:
    def __init__(self, rules_by_antecedent: dict[int, list[dict]]) -> None:
        self.rules_by_antecedent = rules_by_antecedent

    def get_rules_by_antecedents(
        self,
        antecedent_product_ids: list[int],
    ) -> list[dict]:
        self.batch_call_count = getattr(self, "batch_call_count", 0) + 1
        return [
            rule
            for product_id in antecedent_product_ids
            for rule in self.rules_by_antecedent.get(product_id, [])
        ]


def make_rule(
    antecedent_product_id: int,
    consequent_product_id: int,
    confidence: float,
    lift: float,
    support: float,
) -> dict:
    return {
        "antecedent_product_id": antecedent_product_id,
        "antecedent_name": f"Kaynak {antecedent_product_id}",
        "consequent_product_id": consequent_product_id,
        "consequent_name": f"Öneri {consequent_product_id}",
        "consequent_price": 10.0,
        "consequent_category": "Test",
        "consequent_emoji": "🛒",
        "co_occurrence_count": 3,
        "support": support,
        "confidence": confidence,
        "lift": lift,
        "context_message": "Test kuralı",
    }


def test_engine_keeps_only_strongest_recommendation_for_each_basket_product() -> None:
    engine = RecommendationEngine(
        product_repository=FakeProductRepository(),
        rule_repository=FakeRuleRepository(
            {
                1: [
                    make_rule(1, 2, confidence=0.95, lift=1.0, support=0.1),
                    make_rule(1, 3, confidence=0.70, lift=3.0, support=0.4),
                    make_rule(1, 4, confidence=0.80, lift=1.5, support=0.2),
                ],
                5: [
                    make_rule(5, 6, confidence=0.90, lift=1.2, support=0.1),
                    make_rule(5, 7, confidence=0.65, lift=2.5, support=0.3),
                ],
            }
        ),
        min_confidence=0.0,
        min_lift=0.0,
    )

    recommendations = engine.recommend([1, 5], limit=None)

    assert [item.source_product_id for item in recommendations] == [1, 5]
    assert [item.recommended_product_id for item in recommendations] == [3, 7]
    assert len(recommendations) == 2



def test_engine_uses_single_batch_rule_query_for_basket() -> None:
    rule_repository = FakeRuleRepository(
        {
            1: [make_rule(1, 7, confidence=0.92, lift=3.1, support=0.2)],
            24: [make_rule(24, 30, confidence=0.90, lift=2.8, support=0.16)],
            15: [make_rule(15, 17, confidence=0.88, lift=2.6, support=0.16)],
        }
    )
    engine = RecommendationEngine(
        product_repository=FakeProductRepository(),
        rule_repository=rule_repository,
        min_confidence=0.0,
        min_lift=0.0,
    )

    recommendations = engine.recommend([1, 24, 15], limit=None)

    assert len(recommendations) == 3
    assert rule_repository.batch_call_count == 1


def test_demo_recommendation_scenarios_use_dynamic_rules(client: TestClient, products: list[dict]) -> None:
    product_ids = {product["name"]: product["id"] for product in products}
    expected_pairs = {
        "Salkım Domates": "Ezine Peyniri",
        "Sucuk": "Ekmek",
        "Kraker": "Bisküvi",
        "Kuruyemiş Karışık": "Soğuk Çay",
        "Patates Cipsi": "Kola",
    }

    for basket_product_name, expected_recommendation in expected_pairs.items():
        response = client.post(
            "/api/v1/recommendations",
            json={"basket_product_ids": [product_ids[basket_product_name]], "limit": 5},
        )

        assert response.status_code == 200
        recommendations = response.json()["recommendations"]
        assert recommendations
        assert recommendations[0]["recommended_product_name"] == expected_recommendation


def test_rule_miner_uses_lower_professional_support_threshold() -> None:
    miner = AssociationRuleMiner(
        product_repository=None,
        order_repository=None,
        rule_repository=None,
    )

    assert miner.min_support == 0.03
    assert miner._passes_thresholds(
        support=0.04,
        confidence=0.60,
        lift=1.10,
    )
    assert not miner._passes_thresholds(
        support=0.02,
        confidence=0.90,
        lift=2.00,
    )
