"""Application factory: routers, error rendering, security headers and the two built frontends."""

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.errors import AppError, NotFoundError
from app.routers import media, participant
from app.routers.admin import auth as admin_auth
from app.routers.admin import forms as admin_forms
from app.routers.admin import images as admin_images
from app.routers.admin import responses as admin_responses
from app.settings import get_settings
from app.storage.client import get_s3_storage

logger = logging.getLogger(__name__)

# Everything a page may load comes from this origin; inline styles are needed by the UI libraries.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
    "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Make sure the image bucket exists before the first upload."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    get_s3_storage().ensure_bucket()
    yield


def render_app_error(_: Request, error: Exception) -> JSONResponse:
    """Render a domain error as the one error shape the API uses."""
    if not isinstance(error, AppError):
        raise error
    return JSONResponse(
        status_code=error.status, content={"code": error.code, "message": error.message, "details": error.details}
    )


def mount_frontends(app: FastAPI) -> None:
    """Serve the built admin and participant apps when they are present."""
    static_dir = get_settings().static_dir
    admin_dir, participant_dir = static_dir / "admin", static_dir / "participant"

    def page(path: str) -> FileResponse:
        if not (static_dir / path).is_file():
            raise NotFoundError("The frontend has not been built.")
        return FileResponse(static_dir / path, headers={"Cache-Control": "no-cache"})

    if (admin_dir / "assets").is_dir():
        app.mount("/admin/assets", StaticFiles(directory=admin_dir / "assets"), name="admin-assets")
    if (participant_dir / "assets").is_dir():
        app.mount("/p/assets", StaticFiles(directory=participant_dir / "assets"), name="participant-assets")

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse("/admin")

    @app.get("/admin", include_in_schema=False)
    @app.get("/admin/{path:path}", include_in_schema=False)
    def admin_page(path: str = "") -> FileResponse:
        return page("admin/index.html")

    @app.get("/s/{slug}", include_in_schema=False)
    def participant_page(slug: str) -> FileResponse:
        return page("participant/index.html")


def create_app() -> FastAPI:
    """Build the application."""
    app = FastAPI(title="GlanceLab", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_exception_handler(AppError, render_app_error)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response

    for router in (
        admin_auth.router,
        admin_forms.router,
        admin_images.router,
        admin_responses.router,
        participant.router,
        media.router,
    ):
        app.include_router(router)
    mount_frontends(app)
    return app


app = create_app()
