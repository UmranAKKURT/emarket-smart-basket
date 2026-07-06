from fastapi.testclient import TestClient


def test_product_list_returns_catalog_and_supports_filters(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/products")

    assert response.status_code == 200
    products = response.json()
    assert products
    assert {"id", "name", "price", "category", "emoji"} <= products[0].keys()

    selected = products[0]
    category_response = client.get(
        "/api/v1/products",
        params={"category": selected["category"]},
    )
    search_response = client.get(
        "/api/v1/products",
        params={"search": selected["name"]},
    )

    assert category_response.status_code == 200
    assert all(
        product["category"] == selected["category"]
        for product in category_response.json()
    )
    assert selected["id"] in {
        product["id"] for product in search_response.json()
    }


def test_category_list_matches_product_categories(client: TestClient) -> None:
    products = client.get("/api/v1/products").json()
    response = client.get("/api/v1/categories")

    assert response.status_code == 200
    categories = response.json()["categories"]
    assert categories == sorted(categories)
    assert set(categories) == {product["category"] for product in products}


def test_product_detail_and_missing_product(client: TestClient) -> None:
    product = client.get("/api/v1/products").json()[0]

    detail_response = client.get(f"/api/v1/products/{product['id']}")
    missing_response = client.get("/api/v1/products/999999")

    assert detail_response.status_code == 200
    assert detail_response.json() == product
    assert missing_response.status_code == 404
