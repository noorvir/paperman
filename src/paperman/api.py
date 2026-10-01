import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from paperman import catalog_api, documents_api, scans_api, settings_api
from paperman.config import Settings
from paperman.storage import FileStorage

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    storage = FileStorage(config.data_dir)
    app = FastAPI(title="PaperMan", version="0.1.0")

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

    app.include_router(catalog_api.routes(storage))
    app.include_router(scans_api.routes(storage, config))
    app.include_router(documents_api.routes(storage))
    app.include_router(settings_api.routes(storage))
    return app
