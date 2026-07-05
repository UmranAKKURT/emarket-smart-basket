from fastapi.testclient import TestClient


def test_health_uses_ready_temporary_database(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["database_ready"] is True
    assert data["product_count"] > 0
    assert data["order_count"] > 0
    assert data["rule_count"] > 0
