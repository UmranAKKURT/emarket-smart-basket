from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ProductResponse(BaseModel):
    """
    Frontend'e gönderilecek ürün bilgisini temsil eder.
    """

    id: int
    name: str
    price: float
    category: str
    emoji: str

    model_config = ConfigDict(from_attributes=True)


class CategoryListResponse(BaseModel):
    """
    Sistemdeki ürün kategorilerini temsil eder.
    """

    categories: list[str]


class RecommendationRequest(BaseModel):
    """
    Frontend'den öneri motoruna gönderilecek sepet verisi.
    """

    basket_product_ids: list[int] = Field(
        min_length=1,
        description="Sepette bulunan ürünlerin id değerleri.",
        examples=[[1, 7]],
    )

    limit: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Döndürülecek maksimum öneri sayısı.",
    )


class RecommendationResponse(BaseModel):
    """
    Tek bir akıllı sepet önerisini temsil eder.
    """

    source_product_id: int
    source_product_name: str

    recommended_product_id: int
    recommended_product_name: str
    recommended_product_price: float
    recommended_product_category: str
    recommended_product_emoji: str

    support: float
    confidence: float
    lift: float

    context_message: str

    model_config = ConfigDict(from_attributes=True)


class RecommendationListResponse(BaseModel):
    """
    Bir sepete ait öneri sonuçlarını temsil eder.
    """

    basket_product_ids: list[int]
    recommendation_count: int
    recommendations: list[RecommendationResponse]


class RuleRebuildResponse(BaseModel):
    """
    Association rule yeniden üretme işleminin sonucunu temsil eder.
    """

    message: str
    created_rule_count: int


class HealthResponse(BaseModel):
    """
    Backend servisinin durum bilgisini temsil eder.
    """

    status: str
    database_ready: bool
    product_count: int
    order_count: int
    rule_count: int


class APIInfoResponse(BaseModel):
    """
    API'nin ana adresinden dönen temel bilgiyi temsil eder.
    """

    application: str
    version: str
    documentation: str