from typing import Annotated

from fastapi import APIRouter, Depends, Query

from paperman.api_models import (
    ActionResult,
    Dashboard,
    DashboardStatus,
    WorkspaceSettings,
)
from paperman.auth import Auth, Principal
from paperman.models import ModelSettings, now
from paperman.pdf import ocr_available
from paperman.progress import pipeline_overview
from paperman.storage import FileStorage, write_record


def routes(storage: FileStorage, auth: Auth) -> APIRouter:
    router = APIRouter()

    @router.get(
        "/api/workspace",
        operation_id="workspace_settings",
        dependencies=[Depends(auth)],
    )
    def workspace_settings() -> WorkspaceSettings:
        settings = storage.settings()
        return WorkspaceSettings(
            time_format=settings.time_format, demo=settings.provider == "demo"
        )

    @router.get("/api/dashboard", operation_id="dashboard")
    def dashboard(
        principal: Annotated[Principal | None, Depends(auth)],
        status: DashboardStatus = "complete",
        page: Annotated[int, Query(ge=1)] = 1,
    ) -> Dashboard:
        with storage.transaction():
            scans = storage.list_scans()
            documents = storage.list_documents()
        if principal is not None and not principal.admin:
            scans = []
            documents = [doc for doc in documents if principal.can_view(doc)]
        counts, items, unverified = pipeline_overview(scans, documents, status, page)
        is_admin = principal is None or principal.admin
        worker = storage.worker_state() if is_admin else None
        model = storage.settings()
        return Dashboard(
            documents=len(documents),
            pending=sum(scan.status in ("queued", "running") for scan in scans),
            review=sum(scan.status == "review" for scan in scans),
            failed=sum(scan.status == "failed" for scan in scans),
            enrichment_failed=sum(
                doc.enrichment_status == "failed" for doc in documents
            ),
            worker=worker,
            worker_online=bool(
                worker
                and worker.status != "stopped"
                and (now() - worker.heartbeat).total_seconds() < 20
            ),
            ocr_available=is_admin and ocr_available(),
            model_configured=is_admin
            and (model.provider == "demo" or bool(model.base_url and model.model)),
            inbox_path=str(storage.root / "inbox") if is_admin else "",
            counts=counts,
            pipeline_items=items,
            unverified_documents=unverified,
        )

    @router.get(
        "/api/settings",
        operation_id="settings",
        dependencies=[Depends(auth.require_admin)],
    )
    def model_settings() -> ModelSettings:
        return storage.settings()

    @router.put(
        "/api/settings",
        operation_id="save_settings",
        dependencies=[Depends(auth.require_admin)],
    )
    def save_settings(value: ModelSettings) -> ModelSettings:
        with storage.transaction():
            current = storage.settings()
            if "pricing" not in value.model_fields_set:
                if value.model == current.model and value.base_url == current.base_url:
                    value.pricing = current.pricing
            write_record(storage.root / "settings.toml", value)
        return value

    @router.post(
        "/api/search/rebuild",
        operation_id="rebuild_index",
        dependencies=[Depends(auth.require_admin)],
    )
    def rebuild() -> ActionResult:
        with storage.transaction():
            index = storage.rebuild_index()
        return ActionResult(message=f"Indexed {len(index.entries)} documents")

    return router
