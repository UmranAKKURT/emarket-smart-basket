from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from src.analytics_repository import AnalyticsRepository
from src.analytics_service import AnalyticsService
from src.auth_dependencies import get_current_user, require_admin, require_admin_csrf
from src.auth_repository import AuthRepository
from src.auth_service import AuthService
from src.db_helper import EMarketDBHelper
from src.engine import RecommendationEngine
from src.exception_handlers import register_exception_handlers
from src.logging_config import configure_logging
from src.order_service import OrderService
from src.recommendation_service import RecommendationService
from src.repository import (
    AssociationRuleRepository,
    OrderRepository,
    ProductRepository,
)
from src.request_logging import register_request_logging
from src.rule_miner import AssociationRuleMiner
from src.security import Security
from src.settings import Settings
from src.validation import (
    MAX_ANALYTICS_DAYS,
    MAX_PAGE_LIMIT,
    MAX_RULE_LIMIT,
    MAX_TOP_PRODUCT_LIMIT,
    MIN_ANALYTICS_DAYS,
    MIN_IDENTIFIER,
    MIN_PAGE_LIMIT,
    MIN_PAGE_OFFSET,
    MIN_RULE_LIMIT,
    MIN_TOP_PRODUCT_LIMIT,
)
from src.schemas import (
    APIInfoResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminLogoutResponse,
    AdminMeResponse,
    AdminUserResponse,
    AnalyticsDashboardResponse,
    AnalyticsSummaryResponse,
    AssociationRulePageResponse,
    CategorySalesResponse,
    CategoryListResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    DailySalesResponse,
    ErrorResponse,
    HealthResponse,
    OrderDetailResponse,
    OrderHistoryResponse,
    ProductResponse,
    RecommendationListResponse,
    RecommendationRequest,
    RecommendationResponse,
    RuleRebuildResponse,
    StrongRuleResponse,
    TopProductPairResponse,
    TopProductResponse,
)


logger = logging.getLogger("emarket.api")


class ApplicationContainer:
    """
    Uygulamanın bağımlılıklarını oluşturan ve birbirine bağlayan sınıf.

    API endpointleri sınıfları doğrudan oluşturmaz.
    Tüm bağımlılıklar bu container üzerinden alınır.
    """

    def __init__(
        self,
        db_helper: EMarketDBHelper | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.db_helper = db_helper or EMarketDBHelper()
        self.settings = settings or Settings.from_env()
        self.security = Security()
        self.auth_repository = AuthRepository(self.db_helper)
        self.auth_service = AuthService(
            self.auth_repository,
            self.security,
            self.settings,
        )

        self.product_repository = ProductRepository(self.db_helper)
        self.order_repository = OrderRepository(self.db_helper)
        self.rule_repository = AssociationRuleRepository(self.db_helper)
        self.analytics_repository = AnalyticsRepository(self.db_helper)
        self.analytics_service = AnalyticsService(self.analytics_repository)
        self.order_service = OrderService(
            product_repository=self.product_repository,
            order_repository=self.order_repository,
        )

        self.rule_miner = AssociationRuleMiner(
            product_repository=self.product_repository,
            order_repository=self.order_repository,
            rule_repository=self.rule_repository,
            min_support=0.13,
            min_confidence=0.50,
            min_lift=1.00,
        )

        self.recommendation_engine = RecommendationEngine(
            product_repository=self.product_repository,
            rule_repository=self.rule_repository,
            min_confidence=0.50,
            min_lift=1.00,
        )
        self.recommendation_service = RecommendationService(
            self.recommendation_engine
        )

    def initialize(self) -> None:
        """
        Uygulama açılırken gerekli başlangıç işlemlerini gerçekleştirir.

        Association rule tablosu boşsa geçmiş siparişlerden kuralları üretir.
        """

        if self.rule_repository.count_rules() == 0:
            self.rule_miner.mine_and_save_rules(clear_existing=True)


def get_container(request: Request) -> ApplicationContainer:
    """
    FastAPI uygulamasında tutulan dependency container'ı döndürür.
    """

    return request.app.state.container


ContainerDependency = Annotated[
    ApplicationContainer,
    Depends(get_container),
]


router = APIRouter(
    prefix="/api/v1",
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Standart sunucu hata yanıtı.",
        }
    },
)


@router.post(
    "/auth/admin/login",
    response_model=AdminLoginResponse,
    tags=["Admin Auth"],
)
def admin_login(
    request_body: AdminLoginRequest,
    request: Request,
    response: Response,
    container: ContainerDependency,
) -> AdminLoginResponse:
    result = container.auth_service.login(
        email=str(request_body.email),
        password=request_body.password,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    max_age = container.settings.session_ttl_minutes * 60
    cookie_options = {
        "secure": container.settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
        "max_age": max_age,
    }
    response.set_cookie(
        container.settings.session_cookie_name,
        result["session_token"],
        httponly=True,
        **cookie_options,
    )
    response.set_cookie(
        container.settings.csrf_cookie_name,
        result["csrf_token"],
        httponly=False,
        **cookie_options,
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return AdminLoginResponse(
        message="Admin girişi başarılı.",
        user=AdminUserResponse(**result["user"]),
        expires_at=result["expires_at"],
    )


@router.get(
    "/auth/admin/me",
    response_model=AdminMeResponse,
    tags=["Admin Auth"],
)
def admin_me(
    response: Response,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> AdminMeResponse:
    response.headers["Cache-Control"] = "no-store"
    return AdminMeResponse(
        authenticated=True,
        user=AdminUserResponse(**current_user),
    )


@router.post(
    "/auth/admin/logout",
    response_model=AdminLogoutResponse,
    tags=["Admin Auth"],
)
def admin_logout(
    request: Request,
    response: Response,
    container: ContainerDependency,
    current_user: Annotated[dict, Depends(require_admin_csrf)],
) -> AdminLogoutResponse:
    container.auth_service.logout(
        request.cookies.get(container.settings.session_cookie_name)
    )
    response.delete_cookie(container.settings.session_cookie_name, path="/")
    response.delete_cookie(container.settings.csrf_cookie_name, path="/")
    response.headers["Cache-Control"] = "no-store"
    return AdminLogoutResponse(message="Admin oturumu kapatıldı.")


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
)
def health_check(
    container: ContainerDependency,
) -> HealthResponse:
    """
    Veritabanı ve backend servisinin çalışıp çalışmadığını kontrol eder.
    """

    return HealthResponse(
        status="healthy",
        database_ready=container.db_helper.db_path.exists(),
        product_count=container.product_repository.count_products(),
        order_count=container.order_repository.count_orders(),
        rule_count=container.rule_repository.count_rules(),
    )


@router.get(
    "/products",
    response_model=list[ProductResponse],
    tags=["Products"],
)
def get_products(
    container: ContainerDependency,
    category: Annotated[
        str | None,
        Query(description="Ürünleri kategoriye göre filtreler."),
    ] = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            description="Ürün adı veya kategori içinde arama yapar.",
        ),
    ] = None,
) -> list[ProductResponse]:
    """
    Ürünleri listeler.

    category ve search birlikte gönderilirse önce arama yapılır,
    ardından sonuçlar kategoriye göre filtrelenir.
    """

    if search:
        products = container.product_repository.search_products(search)
    elif category:
        products = container.product_repository.get_products_by_category(
            category
        )
    else:
        products = container.product_repository.get_all_products()

    if search and category:
        products = [
            product
            for product in products
            if product["category"] == category
        ]

    return [
        ProductResponse(**product)
        for product in products
    ]


@router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
def get_product_by_id(
    product_id: int,
    container: ContainerDependency,
) -> ProductResponse:
    """
    Ürün id değerine göre tek bir ürün getirir.
    """

    product = container.product_repository.get_product_by_id(product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail=f"{product_id} id değerine sahip ürün bulunamadı.",
        )

    return ProductResponse(**product)


@router.get(
    "/categories",
    response_model=CategoryListResponse,
    tags=["Products"],
)
def get_categories(
    container: ContainerDependency,
) -> CategoryListResponse:
    """
    Sistemde bulunan ürün kategorilerini getirir.
    """

    categories = container.product_repository.get_categories()

    return CategoryListResponse(categories=categories)


@router.get(
    "/orders",
    response_model=OrderHistoryResponse,
    tags=["Orders"],
)
def get_order_history(
    container: ContainerDependency,
    user_id: Annotated[int, Query(ge=MIN_IDENTIFIER)],
    limit: Annotated[int, Query(ge=MIN_PAGE_LIMIT, le=MAX_PAGE_LIMIT)] = 20,
    offset: Annotated[int, Query(ge=MIN_PAGE_OFFSET)] = 0,
) -> OrderHistoryResponse:
    history = container.order_service.get_user_orders(
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return OrderHistoryResponse(**history)


@router.get(
    "/orders/{order_id}",
    response_model=OrderDetailResponse,
    tags=["Orders"],
)
def get_order_detail(
    order_id: int,
    container: ContainerDependency,
    user_id: Annotated[int, Query(ge=MIN_IDENTIFIER)],
) -> OrderDetailResponse:
    detail = container.order_service.get_user_order_detail(
        user_id=user_id,
        order_id=order_id,
    )
    return OrderDetailResponse(**detail)


@router.post(
    "/orders",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Orders"],
)
def create_order(
    request_body: CreateOrderRequest,
    background_tasks: BackgroundTasks,
    container: ContainerDependency,
) -> CreateOrderResponse:
    """Siparişi kaydeder ve association rule yenilemeyi arka plana planlar.

    Production ortamında bu işlem Celery, RQ veya ayrı bir job queue ile
    periyodik çalıştırılabilir. Bu demoda FastAPI BackgroundTasks kullanılır.
    """

    summary = container.order_service.create_order(
        user_id=request_body.user_id,
        items=[item.model_dump() for item in request_body.items],
    )
    background_tasks.add_task(
        container.rule_miner.mine_and_save_rules,
        clear_existing=True,
    )

    return CreateOrderResponse(
        **summary,
        rule_rebuild_scheduled=True,
        message="Siparişiniz başarıyla oluşturuldu.",
    )


@router.post(
    "/recommendations",
    response_model=RecommendationListResponse,
    tags=["Recommendations"],
)
def get_recommendations(
    request_body: RecommendationRequest,
    container: ContainerDependency,
) -> RecommendationListResponse:
    """
    Sepette bulunan ürünlere göre en güçlü önerileri oluşturur.
    """

    recommendations = container.recommendation_service.get_recommendations(
        basket_product_ids=request_body.basket_product_ids,
        limit=request_body.limit,
    )

    recommendation_responses = [
        RecommendationResponse(**recommendation.to_dict())
        for recommendation in recommendations
    ]

    return RecommendationListResponse(
        basket_product_ids=request_body.basket_product_ids,
        recommendation_count=len(recommendation_responses),
        recommendations=recommendation_responses,
    )


# Demo yönetim endpointleri production ortamında kimlik doğrulamayla korunmalıdır.
@router.get(
    "/admin/analytics/dashboard",
    response_model=AnalyticsDashboardResponse,
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_analytics_dashboard(
    container: ContainerDependency,
    top_product_limit: Annotated[
        int,
        Query(ge=MIN_TOP_PRODUCT_LIMIT, le=MAX_TOP_PRODUCT_LIMIT),
    ] = 5,
    rule_limit: Annotated[
        int,
        Query(ge=MIN_RULE_LIMIT, le=MAX_RULE_LIMIT),
    ] = 10,
    days: Annotated[
        int,
        Query(ge=MIN_ANALYTICS_DAYS, le=MAX_ANALYTICS_DAYS),
    ] = 30,
    pair_limit: Annotated[
        int,
        Query(ge=MIN_TOP_PRODUCT_LIMIT, le=MAX_TOP_PRODUCT_LIMIT),
    ] = 10,
) -> AnalyticsDashboardResponse:
    return AnalyticsDashboardResponse(
        summary=container.analytics_service.get_dashboard_summary(),
        period_metrics=container.analytics_service.get_dashboard_period_metrics(
            days
        ),
        top_products=container.analytics_service.get_top_products(
            top_product_limit
        ),
        top_product_pairs=container.analytics_service.get_top_product_pairs(
            pair_limit
        ),
        category_sales=container.analytics_service.get_category_sales(),
        daily_sales=container.analytics_service.get_daily_sales(days),
        strongest_rules=container.analytics_service.get_strongest_rules(
            rule_limit
        ),
    )


@router.get(
    "/admin/analytics/dashboard/stream",
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
async def stream_analytics_dashboard(
    container: ContainerDependency,
    days: Annotated[
        int,
        Query(ge=MIN_ANALYTICS_DAYS, le=MAX_ANALYTICS_DAYS),
    ] = 30,
) -> StreamingResponse:
    async def event_stream():
        while True:
            dashboard = AnalyticsDashboardResponse(
                summary=container.analytics_service.get_dashboard_summary(),
                period_metrics=container.analytics_service.get_dashboard_period_metrics(
                    days
                ),
                top_products=container.analytics_service.get_top_products(10),
                top_product_pairs=container.analytics_service.get_top_product_pairs(10),
                category_sales=container.analytics_service.get_category_sales(),
                daily_sales=container.analytics_service.get_daily_sales(days),
                strongest_rules=container.analytics_service.get_strongest_rules(10),
            )
            yield (
                "event: dashboard\n"
                f"data: {json.dumps(dashboard.model_dump(), ensure_ascii=False)}\n\n"
            )
            await asyncio.sleep(5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.get(
    "/admin/analytics/summary",
    response_model=AnalyticsSummaryResponse,
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_analytics_summary(
    container: ContainerDependency,
) -> AnalyticsSummaryResponse:
    return AnalyticsSummaryResponse(
        **container.analytics_service.get_dashboard_summary()
    )


@router.get(
    "/admin/analytics/top-products",
    response_model=list[TopProductResponse],
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_top_products_analytics(
    container: ContainerDependency,
    limit: Annotated[
        int,
        Query(ge=MIN_TOP_PRODUCT_LIMIT, le=MAX_TOP_PRODUCT_LIMIT),
    ] = 5,
) -> list[TopProductResponse]:
    return [
        TopProductResponse(**product)
        for product in container.analytics_service.get_top_products(limit)
    ]


@router.get(
    "/admin/analytics/top-product-pairs",
    response_model=list[TopProductPairResponse],
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_top_product_pairs_analytics(
    container: ContainerDependency,
    limit: Annotated[
        int,
        Query(ge=MIN_TOP_PRODUCT_LIMIT, le=MAX_TOP_PRODUCT_LIMIT),
    ] = 10,
) -> list[TopProductPairResponse]:
    return [
        TopProductPairResponse(**pair)
        for pair in container.analytics_service.get_top_product_pairs(limit)
    ]


@router.get(
    "/admin/analytics/categories",
    response_model=list[CategorySalesResponse],
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_category_sales_analytics(
    container: ContainerDependency,
) -> list[CategorySalesResponse]:
    return [
        CategorySalesResponse(**category)
        for category in container.analytics_service.get_category_sales()
    ]


@router.get(
    "/admin/analytics/daily-sales",
    response_model=list[DailySalesResponse],
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_daily_sales_analytics(
    container: ContainerDependency,
    days: Annotated[
        int,
        Query(ge=MIN_ANALYTICS_DAYS, le=MAX_ANALYTICS_DAYS),
    ] = 30,
) -> list[DailySalesResponse]:
    return [
        DailySalesResponse(**daily_sale)
        for daily_sale in container.analytics_service.get_daily_sales(days)
    ]


@router.get(
    "/admin/analytics/rules",
    response_model=list[StrongRuleResponse],
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_strongest_rules_analytics(
    container: ContainerDependency,
    limit: Annotated[
        int,
        Query(ge=MIN_RULE_LIMIT, le=MAX_RULE_LIMIT),
    ] = 10,
) -> list[StrongRuleResponse]:
    return [
        StrongRuleResponse(**rule)
        for rule in container.analytics_service.get_strongest_rules(limit)
    ]

@router.get(
    "/admin/analytics/rules/page",
    response_model=AssociationRulePageResponse,
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_association_rules_page(
    container: ContainerDependency,
    limit: Annotated[
        int,
        Query(ge=MIN_RULE_LIMIT, le=MAX_RULE_LIMIT),
    ] = 5,
    offset: Annotated[int, Query(ge=MIN_PAGE_OFFSET)] = 0,
    search: Annotated[str | None, Query(max_length=80)] = None,
    sort_by: Literal[
        "confidence",
        "lift",
        "support",
        "created_at",
        "updated_at",
    ] = "confidence",
    sort_direction: Literal["asc", "desc"] = "desc",
    include_inactive: bool = True,
    status_filter: Literal["all", "active", "passive"] = "all",
    min_confidence: Annotated[float | None, Query(ge=0, le=1)] = None,
    min_lift: Annotated[float | None, Query(ge=0)] = None,
    min_support: Annotated[float | None, Query(ge=0, le=1)] = None,
    created_from: Annotated[str | None, Query(max_length=10)] = None,
    created_to: Annotated[str | None, Query(max_length=10)] = None,
    updated_from: Annotated[str | None, Query(max_length=10)] = None,
    updated_to: Annotated[str | None, Query(max_length=10)] = None,
) -> AssociationRulePageResponse:
    return AssociationRulePageResponse(
        **container.analytics_service.get_rules_page(
            limit=limit,
            offset=offset,
            search=search,
            sort_by=sort_by,
            sort_direction=sort_direction,
            include_inactive=include_inactive,
            status_filter=status_filter,
            min_confidence=min_confidence,
            min_lift=min_lift,
            min_support=min_support,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )
    )


@router.get(
    "/admin/analytics/rules/detail/{rule_id}",
    response_model=StrongRuleResponse,
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def get_association_rule_detail(
    container: ContainerDependency,
    rule_id: Annotated[int, Path(ge=MIN_IDENTIFIER)],
) -> StrongRuleResponse:
    return StrongRuleResponse(
        **container.analytics_service.get_rule_detail(rule_id)
    )


@router.get(
    "/admin/analytics/rules/export",
    tags=["Admin Analytics"],
    dependencies=[Depends(require_admin)],
)
def export_association_rules(
    container: ContainerDependency,
    format: Literal["csv", "xlsx"] = "csv",
    search: Annotated[str | None, Query(max_length=80)] = None,
    sort_by: Literal[
        "confidence",
        "lift",
        "support",
        "created_at",
        "updated_at",
    ] = "confidence",
    sort_direction: Literal["asc", "desc"] = "desc",
    status_filter: Literal["all", "active", "passive"] = "all",
    min_confidence: Annotated[float | None, Query(ge=0, le=1)] = None,
    min_lift: Annotated[float | None, Query(ge=0)] = None,
    min_support: Annotated[float | None, Query(ge=0, le=1)] = None,
    created_from: Annotated[str | None, Query(max_length=10)] = None,
    created_to: Annotated[str | None, Query(max_length=10)] = None,
    updated_from: Annotated[str | None, Query(max_length=10)] = None,
    updated_to: Annotated[str | None, Query(max_length=10)] = None,
) -> Response:
    content, media_type, filename = container.analytics_service.export_rules(
        export_format=format,
        search=search,
        sort_by=sort_by,
        sort_direction=sort_direction,
        status_filter=status_filter,
        min_confidence=min_confidence,
        min_lift=min_lift,
        min_support=min_support,
        created_from=created_from,
        created_to=created_to,
        updated_from=updated_from,
        updated_to=updated_to,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post(
    "/admin/rules/rebuild",
    response_model=RuleRebuildResponse,
    tags=["Admin"],
    dependencies=[Depends(require_admin_csrf)],
)
def rebuild_association_rules(
    container: ContainerDependency,
) -> RuleRebuildResponse:
    """
    Sipariş geçmişinden association rule kayıtlarını yeniden üretir.

    Bu endpoint geliştirme ve test amacıyla kullanılacaktır.
    Gerçek production ortamında kimlik doğrulamayla korunmalıdır.
    """

    created_rule_count = container.rule_miner.mine_and_save_rules(
        clear_existing=True
    )

    return RuleRebuildResponse(
        message="Association rule kayıtları başarıyla yeniden üretildi.",
        created_rule_count=created_rule_count,
    )


def create_app(container: ApplicationContainer | None = None) -> FastAPI:
    """
    FastAPI uygulamasını oluşturan application factory.
    """

    container = container or ApplicationContainer()
    configure_logging(container.settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info(
            "application_starting environment=%s",
            container.settings.environment,
        )
        container.initialize()
        app.state.container = container
        logger.info("application_started")
        yield
        logger.info("application_stopped")

    app = FastAPI(
        title="E-Market Smart Basket API",
        description=(
            "SQLite sipariş geçmişinden association rule çıkaran "
            "ve sepete göre dinamik ürün önerileri üreten REST API."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(container.settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    register_request_logging(app)
    app.include_router(router)

    @app.get(
        "/",
        response_model=APIInfoResponse,
        tags=["System"],
    )
    def api_information() -> APIInfoResponse:
        return APIInfoResponse(
            application="E-Market Smart Basket API",
            version="1.0.0",
            documentation="/docs",
        )

    return app
