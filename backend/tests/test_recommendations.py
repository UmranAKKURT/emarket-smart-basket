from fastapi.testclient import TestClient


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
        0.55 * recommendation["confidence"]
        + 0.30 * recommendation["lift"]
        + 0.15 * recommendation["support"],
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
