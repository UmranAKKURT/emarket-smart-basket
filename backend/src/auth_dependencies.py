from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Header, Request


SessionCookie = Annotated[str | None, Cookie(alias="emarket_admin_session")]
CsrfHeader = Annotated[str | None, Header(alias="X-CSRF-Token")]


def get_current_user(request: Request, session_token: SessionCookie = None) -> dict:
    return request.app.state.container.auth_service.authenticate_session(session_token)


def require_admin(request: Request, session_token: SessionCookie = None) -> dict:
    return request.app.state.container.auth_service.require_admin(session_token)


def require_admin_csrf(
    request: Request,
    session_token: SessionCookie = None,
    csrf_token: CsrfHeader = None,
) -> dict:
    return request.app.state.container.auth_service.validate_csrf(session_token, csrf_token)
