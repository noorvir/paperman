import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

from paperman import catalog_api, documents_api, scans_api, settings_api
from paperman.auth import Auth, AuthSettings
from paperman.config import Settings
from paperman.storage import FileStorage

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None, auth_settings: AuthSettings | None = None
) -> FastAPI:
    config = settings or Settings()
    storage = FileStorage(config.data_dir)
    auth = Auth(auth_settings or AuthSettings())
    app = FastAPI(title="PaperMan", version="0.1.0")

    @app.middleware("http")
    async def auth_mode(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers["X-PaperMan-Auth"] = (
            "enabled" if auth.settings.auth_enabled else "disabled"
        )
        if auth.settings.auth_enabled:
            response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.exception_handler(FileNotFoundError)
    async def missing(_request: Request, _error: FileNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "Record not found"})

    @app.exception_handler(ValueError)
    async def invalid(_request: Request, error: ValueError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(error)})

    @app.exception_handler(OSError)
    async def storage_error(_request: Request, error: OSError) -> JSONResponse:
        logger.error("Storage failure", exc_info=error)
        return JSONResponse(
            status_code=503,
            content={"detail": "Storage is unavailable. Check the data directory"},
        )

    app.include_router(catalog_api.routes(storage, auth))
    app.include_router(scans_api.routes(storage, config, auth))
    app.include_router(documents_api.routes(storage, auth))
    app.include_router(settings_api.routes(storage, auth))
    return app
