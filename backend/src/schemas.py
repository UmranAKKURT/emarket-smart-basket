from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.validation import (
    MAX_ITEM_QUANTITY,
    MAX_RECOMMENDATION_LIMIT,
    MIN_IDENTIFIER,
    MIN_ITEM_QUANTITY,
    MIN_RECOMMENDATION_LIMIT,
)


class ErrorResponse(BaseModel):
    """Tüm HTTP hata yanıtlarının ortak gövdesi."""

    detail: Any


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


class OrderItemRequest(BaseModel):
    product_id: int = Field(ge=MIN_IDENTIFIER)
    quantity: int = Field(ge=MIN_ITEM_QUANTITY, le=MAX_ITEM_QUANTITY)


class CreateOrderRequest(BaseModel):
    user_id: int = Field(ge=MIN_IDENTIFIER)
    items: list[OrderItemRequest] = Field(min_length=1)
    recommendation_event_keys: list[str] = Field(default_factory=list, max_length=50)


class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    emoji: str
    price: float
    quantity: int
    line_total: float


class CreateOrderResponse(BaseModel):
    order_id: int
    user_id: int
    created_at: str
    items: list[OrderItemResponse]
    total_amount: float
    rule_rebuild_scheduled: bool
    message: str


class OrderHistoryItemResponse(BaseModel):
    order_id: int
    user_id: int
    created_at: str
    item_count: int
    total_quantity: int
    total_amount: float


class OrderHistoryResponse(BaseModel):
    user_id: int
    total: int
    limit: int
    offset: int
    orders: list[OrderHistoryItemResponse]


class OrderDetailResponse(BaseModel):
    order_id: int
    user_id: int
    created_at: str
    items: list[OrderItemResponse]
    total_amount: float


class RecommendedProductSummaryResponse(BaseModel):
    product_id: int
    product_name: str
    emoji: str
    recommendation_count: int


class ComparisonResponse(BaseModel):
    status: str
    change_percent: float | None = None


class AnalyticsSummaryResponse(BaseModel):
    total_orders: int
    total_revenue: float
    total_units_sold: int
    average_order_value: float
    unique_customers: int
    total_products: int
    total_categories: int
    total_association_rules: int
    active_rule_count: int
    last_order_at: str | None
    most_recommended_product: RecommendedProductSummaryResponse | None
    comparisons: dict[str, ComparisonResponse] = Field(default_factory=dict)


class TopProductResponse(BaseModel):
    product_id: int
    product_name: str
    emoji: str
    category: str
    total_quantity: int
    total_revenue: float
    order_count: int


class TopProductPairResponse(BaseModel):
    first_product_id: int
    first_product_name: str
    first_product_emoji: str
    second_product_id: int
    second_product_name: str
    second_product_emoji: str
    order_count: int
    combined_quantity: int
    support: float


class DashboardPeriodMetricsResponse(BaseModel):
    selected_period_orders: int
    selected_period_revenue: float
    daily_average_orders: float
    daily_average_revenue: float
    active_day_count: int
    period_day_count: int
    comparisons: dict[str, ComparisonResponse] = Field(default_factory=dict)


class CategorySalesResponse(BaseModel):
    category: str
    total_quantity: int
    total_revenue: float
    order_count: int
    revenue_share: float


class DailySalesResponse(BaseModel):
    date: str
    order_count: int
    total_quantity: int
    total_revenue: float


class StrongRuleResponse(BaseModel):
    rule_id: int
    antecedent_product_id: int
    antecedent_name: str
    antecedent_emoji: str
    consequent_product_id: int
    consequent_name: str
    consequent_emoji: str
    support: float
    confidence: float
    lift: float
    context_message: str
    created_at: str | None = None
    updated_at: str | None = None
    calculation_count: int = 1
    is_active: bool = True
    is_strongest: bool = False


class AssociationRulePageResponse(BaseModel):
    rules: list[StrongRuleResponse]
    total: int
    limit: int
    offset: int
    search: str = ""
    sort_by: str
    sort_direction: str
    status_filter: str = "all"


class AnalyticsDashboardResponse(BaseModel):
    summary: AnalyticsSummaryResponse
    period_metrics: DashboardPeriodMetricsResponse
    recommendation_impact: RecommendationImpactResponse
    top_products: list[TopProductResponse]
    top_product_pairs: list[TopProductPairResponse]
    category_sales: list[CategorySalesResponse]
    daily_sales: list[DailySalesResponse]
    strongest_rules: list[StrongRuleResponse]


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AdminUserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None


class AdminLoginResponse(BaseModel):
    message: str
    user: AdminUserResponse
    expires_at: str


class AdminMeResponse(BaseModel):
    authenticated: bool
    user: AdminUserResponse


class AdminLogoutResponse(BaseModel):
    message: str


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
        default=5,
        ge=MIN_RECOMMENDATION_LIMIT,
        le=MAX_RECOMMENDATION_LIMIT,
        description="Döndürülecek maksimum öneri sayısı.",
    )


class RecommendationResponse(BaseModel):
    """
    Tek bir akıllı sepet önerisini temsil eder.
    """

    source_product_id: int
    source_product_name: str
    rule_id: int

    recommended_product_id: int
    recommended_product_name: str
    recommended_product_price: float
    recommended_product_category: str
    recommended_product_emoji: str
    co_occurrence_count: int = 0

    support: float
    confidence: float
    lift: float
    score: float = 0.0

    context_message: str

    model_config = ConfigDict(from_attributes=True)


class RecommendationListResponse(BaseModel):
    """
    Bir sepete ait öneri sonuçlarını temsil eder.
    """

    basket_product_ids: list[int]
    recommendation_count: int
    recommendations: list[RecommendationResponse]


class RecommendationEventRequest(BaseModel):
    event_key: str = Field(min_length=8, max_length=180)
    session_id: str = Field(min_length=8, max_length=120)
    user_id: int | None = Field(default=None, ge=MIN_IDENTIFIER)
    rule_id: int = Field(ge=MIN_IDENTIFIER)
    source_product_id: int = Field(ge=MIN_IDENTIFIER)
    recommended_product_id: int = Field(ge=MIN_IDENTIFIER)
    event_type: str = Field(pattern="^(impression|add_to_cart|purchase)$")
    order_id: int | None = Field(default=None, ge=MIN_IDENTIFIER)


class RecommendationEventResponse(BaseModel):
    recorded: bool


class RecommendationImpactResponse(BaseModel):
    impressions: int = 0
    add_to_cart: int = 0
    purchases: int = 0
    recommendation_revenue: float = 0.0
    add_to_cart_rate: float = 0.0
    purchase_rate: float = 0.0


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
