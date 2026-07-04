from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.db_helper import EMarketDBHelper
from src.engine import (
    BasketValidationError,
    RecommendationEngine,
    RecommendationEngineError,
)
from src.repository import (
    AssociationRuleRepository,
    OrderRepository,
    ProductRepository,
    RepositoryError,
)
from src.rule_miner import AssociationRuleMiner, RuleMiningError
from src.schemas import (
    APIInfoResponse,
    CategoryListResponse,
    HealthResponse,
    ProductResponse,
    RecommendationListResponse,
    RecommendationRequest,
    RecommendationResponse,
    RuleRebuildResponse,
)


class ApplicationContainer:
    """
    Uygulamanın bağımlılıklarını oluşturan ve birbirine bağlayan sınıf.

    API endpointleri sınıfları doğrudan oluşturmaz.
    Tüm bağımlılıklar bu container üzerinden alınır.
    """

    def __init__(self) -> None:
        self.db_helper = EMarketDBHelper()

        self.product_repository = ProductRepository(self.db_helper)
        self.order_repository = OrderRepository(self.db_helper)
        self.rule_repository = AssociationRuleRepository(self.db_helper)

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


router = APIRouter(prefix="/api/v1")


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

    recommendations = container.recommendation_engine.recommend(
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


@router.post(
    "/admin/rules/rebuild",
    response_model=RuleRebuildResponse,
    tags=["Admin"],
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


def register_exception_handlers(app: FastAPI) -> None:
    """
    Uygulamadaki özel hata türleri için HTTP yanıtlarını tanımlar.
    """

    @app.exception_handler(BasketValidationError)
    async def basket_validation_exception_handler(
        request: Request,
        exception: BasketValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": str(exception)},
        )

    @app.exception_handler(RecommendationEngineError)
    async def recommendation_exception_handler(
        request: Request,
        exception: RecommendationEngineError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exception)},
        )

    @app.exception_handler(RuleMiningError)
    async def rule_mining_exception_handler(
        request: Request,
        exception: RuleMiningError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exception)},
        )

    @app.exception_handler(RepositoryError)
    async def repository_exception_handler(
        request: Request,
        exception: RepositoryError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exception)},
        )


def create_app() -> FastAPI:
    """
    FastAPI uygulamasını oluşturan application factory.
    """

    container = ApplicationContainer()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        container.initialize()
        app.state.container = container
        yield

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
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
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