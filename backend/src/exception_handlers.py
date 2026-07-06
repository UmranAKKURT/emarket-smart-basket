from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.analytics_service import AnalyticsServiceError, InvalidAnalyticsParameterError
from src.auth_service import (
    AccountLockedError,
    AuthServiceError,
    CsrfValidationError,
    ForbiddenError,
    InactiveAccountError,
    InvalidCredentialsError,
    UnauthorizedError,
    WeakPasswordError,
)
from src.engine import BasketValidationError, RecommendationEngineError
from src.order_service import (
    InvalidOrderError,
    OrderNotFoundError,
    OrderServiceError,
    ProductNotFoundError,
)
from src.repository import RepositoryError
from src.rule_miner import RuleMiningError
from src.schemas import ErrorResponse


logger = logging.getLogger("emarket.errors")
DetailResolver = Callable[[Exception], str]


@dataclass(frozen=True)
class ExceptionMapping:
    exception_type: type[Exception]
    status_code: int
    detail: str | DetailResolver | None = None
    authenticate_with_cookie: bool = False


EXCEPTION_MAPPINGS = (
    ExceptionMapping(InvalidCredentialsError, 401, authenticate_with_cookie=True),
    ExceptionMapping(UnauthorizedError, 401, authenticate_with_cookie=True),
    ExceptionMapping(ForbiddenError, 403),
    ExceptionMapping(CsrfValidationError, 403),
    ExceptionMapping(AccountLockedError, 429),
    ExceptionMapping(InactiveAccountError, 403, "Hesap aktif değil."),
    ExceptionMapping(WeakPasswordError, 422),
    ExceptionMapping(
        AuthServiceError,
        500,
        "Kimlik doğrulama işlemi tamamlanamadı.",
    ),
    ExceptionMapping(InvalidAnalyticsParameterError, 422),
    ExceptionMapping(AnalyticsServiceError, 500),
    ExceptionMapping(OrderNotFoundError, 404),
    ExceptionMapping(InvalidOrderError, 422),
    ExceptionMapping(ProductNotFoundError, 404),
    ExceptionMapping(OrderServiceError, 500),
    ExceptionMapping(BasketValidationError, 422),
    ExceptionMapping(RecommendationEngineError, 500),
    ExceptionMapping(RuleMiningError, 500),
    ExceptionMapping(RepositoryError, 500),
)


def _error_response(
    status_code: int,
    detail: Any,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(ErrorResponse(detail=detail).model_dump()),
        headers=headers,
    )


def _resolve_detail(mapping: ExceptionMapping, exception: Exception) -> str:
    if callable(mapping.detail):
        return mapping.detail(exception)
    return mapping.detail if isinstance(mapping.detail, str) else str(exception)


def _build_service_exception_handler(mapping: ExceptionMapping):
    async def handler(request: Request, exception: Exception) -> JSONResponse:
        detail = _resolve_detail(mapping, exception)
        log_context = (
            type(exception).__name__,
            request.method,
            request.url.path,
            mapping.status_code,
        )
        if mapping.status_code >= 500:
            logger.error(
                "handled_exception type=%s method=%s path=%s status=%s",
                *log_context,
                exc_info=(
                    type(exception),
                    exception,
                    exception.__traceback__,
                ),
            )
        else:
            logger.warning(
                "handled_exception type=%s method=%s path=%s status=%s",
                *log_context,
            )
        headers = (
            {"WWW-Authenticate": "Cookie"}
            if mapping.authenticate_with_cookie
            else None
        )
        return _error_response(mapping.status_code, detail, headers)

    return handler


def register_exception_handlers(app: FastAPI) -> None:
    """Servis ve framework hatalarını tek merkezde HTTP yanıtına dönüştürür."""

    for mapping in EXCEPTION_MAPPINGS:
        app.add_exception_handler(
            mapping.exception_type,
            _build_service_exception_handler(mapping),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request,
        exception: HTTPException,
    ) -> JSONResponse:
        logger.warning(
            "http_exception method=%s path=%s status=%s",
            request.method,
            request.url.path,
            exception.status_code,
        )
        return _error_response(
            exception.status_code,
            exception.detail,
            exception.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exception: RequestValidationError,
    ) -> JSONResponse:
        logger.warning(
            "validation_failed method=%s path=%s error_count=%s",
            request.method,
            request.url.path,
            len(exception.errors()),
        )
        return _error_response(422, exception.errors())

    @app.exception_handler(Exception)
    async def unexpected_exception_handler(
        request: Request,
        exception: Exception,
    ) -> JSONResponse:
        logger.error(
            "unhandled_exception type=%s method=%s path=%s status=500",
            type(exception).__name__,
            request.method,
            request.url.path,
            exc_info=(
                type(exception),
                exception,
                exception.__traceback__,
            ),
        )
        return _error_response(
            500,
            "Beklenmeyen bir sunucu hatası oluştu.",
        )
