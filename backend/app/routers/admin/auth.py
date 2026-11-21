"""Admin login, logout and session check."""

from fastapi import APIRouter, Depends, Request, Response, status

from app.schemas.admin import AdminInfo, LoginRequest
from app.security import COOKIE_NAME, AppSettings, log_in, require_admin

router = APIRouter(prefix="/api/admin", tags=["auth"])


@router.post("/login")
def login(credentials: LoginRequest, request: Request, response: Response, settings: AppSettings) -> AdminInfo:
    """Log the admin in and set the session cookie."""
    # The address keys the in-memory limiter only; it is never stored or logged.
    client = request.client.host if request.client else "unknown"
    cookie_value = log_in(settings, client, credentials.username, credentials.password)
    response.set_cookie(
        COOKIE_NAME,
        cookie_value,
        max_age=settings.admin_session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    return AdminInfo(username=settings.admin_username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, settings: AppSettings) -> None:
    """Clear the session cookie."""
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, secure=settings.cookie_secure, samesite="strict")


@router.get("/me", dependencies=[Depends(require_admin)])
def read_admin(settings: AppSettings) -> AdminInfo:
    """Return who is logged in."""
    return AdminInfo(username=settings.admin_username)
