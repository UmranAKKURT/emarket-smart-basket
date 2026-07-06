from __future__ import annotations

import logging
from time import perf_counter

from fastapi import FastAPI, Request, Response


logger = logging.getLogger("emarket.http")


def register_request_logging(app: FastAPI) -> None:
    """Hassas veri kaydetmeden istek sonucu ve süresini loglar."""

    @app.middleware("http")
    async def log_request(request: Request, call_next) -> Response:
        started_at = perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (perf_counter() - started_at) * 1000
            logger.exception(
                "request_failed method=%s path=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                duration_ms,
            )
            raise

        duration_ms = (perf_counter() - started_at) * 1000
        logger.info(
            "request_completed method=%s path=%s status=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

