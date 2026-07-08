from __future__ import annotations

from dataclasses import replace
from typing import Sequence

from src.engine import Recommendation, RecommendationEngine
from src.validation import MAX_RECOMMENDATION_LIMIT, MIN_RECOMMENDATION_LIMIT


CONFIDENCE_WEIGHT = 0.55
LIFT_WEIGHT = 0.30
SUPPORT_WEIGHT = 0.15
DEFAULT_RECOMMENDATION_LIMIT = 5


class RecommendationService:
    """Sepetin tamamını dikkate alan, metrik ağırlıklı öneri servisidir."""

    def __init__(self, engine: RecommendationEngine) -> None:
        self.engine = engine

    def get_recommendations(
        self,
        basket_product_ids: Sequence[int],
        limit: int = DEFAULT_RECOMMENDATION_LIMIT,
    ) -> list[Recommendation]:
        if not MIN_RECOMMENDATION_LIMIT <= limit <= MAX_RECOMMENDATION_LIMIT:
            raise ValueError(
                f"limit {MIN_RECOMMENDATION_LIMIT} ile "
                f"{MAX_RECOMMENDATION_LIMIT} arasında olmalıdır."
            )

        recommendations = self.engine.recommend(
            basket_product_ids=basket_product_ids,
            limit=MAX_RECOMMENDATION_LIMIT,
        )

        scored_recommendations = [
            replace(
                recommendation,
                score=self.calculate_score(recommendation),
            )
            for recommendation in recommendations
        ]

        return sorted(
            scored_recommendations,
            key=lambda recommendation: (
                recommendation.score,
                recommendation.confidence,
                recommendation.lift,
                recommendation.support,
            ),
            reverse=True,
        )[:limit]

    @staticmethod
    def calculate_score(recommendation: Recommendation) -> float:
        normalized_lift = min(float(recommendation.lift), 3.0) / 3.0
        score = (
            float(recommendation.confidence) * CONFIDENCE_WEIGHT
            + normalized_lift * LIFT_WEIGHT
            + float(recommendation.support) * SUPPORT_WEIGHT
        )
        return round(score, 6)
