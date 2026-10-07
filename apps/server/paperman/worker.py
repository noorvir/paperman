import asyncio
import logging
import time
from functools import partial
from pathlib import Path

from filelock import FileLock
from paperman_parser import Inference
from paperman_parser.demo_inference import DemoInference
from paperman_parser.inference import EndpointInference
from paperman_parser.ocr import LocalOCR
from watchfiles import watch

from paperman.config import Settings
from paperman.models import Event, WorkerState
from paperman.pdf import validate_scan
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, file_hash, write_record
from paperman.usage import record_scan_usage

logger = logging.getLogger(__name__)


async def run_worker(settings: Settings) -> None:
    storage = FileStorage(settings.data_dir)
    lock = FileLock(storage.root / "state" / "worker.lock", timeout=0)
    with lock:
        with storage.transaction():
            for scan in storage.list_scans():
                if scan.status == "running":
                    scan.status = "queued"
                    scan.history.append(
                        Event(stage=scan.phase, message="Resumed after worker restart")
                    )
                    storage.save_scan(scan)
            for document in storage.list_documents():
                if document.enrichment_status == "running":
                    document.enrichment_status = "pending"
                    storage.save_document(document)
        state = WorkerState(status="idle")
        heartbeat = asyncio.create_task(publish_heartbeat(storage, state))
        observed: dict[Path, tuple[int, int, float]] = {}
        try:
            await run_cycle(storage, settings, observed, state)
            wake = storage.root / "state" / "wake"
            wake.touch(exist_ok=True)
            watcher = watch(
                storage.root / "inbox",
                wake,
                yield_on_timeout=True,
                rust_timeout=int(settings.poll_seconds * 1000),
                watch_filter=lambda _change, path: (
                    path.endswith(".pdf") or path.endswith("wake")
                ),
            )
            while True:
                await asyncio.to_thread(next, watcher)
                await run_cycle(storage, settings, observed, state)
        finally:
            heartbeat.cancel()
            try:
                await heartbeat
            except asyncio.CancelledError:
                pass
            write_record(
                storage.root / "state" / "worker.json", WorkerState(status="stopped")
            )


async def publish_heartbeat(storage: FileStorage, state: WorkerState) -> None:
    while True:
        write_record(
            storage.root / "state" / "worker.json",
            WorkerState(status=state.status, message=state.message),
        )
        await asyncio.sleep(3)


async def run_cycle(
    storage: FileStorage,
    settings: Settings,
    observed: dict[Path, tuple[int, int, float]],
    state: WorkerState,
) -> None:
    try:
        state.status = "working"
        state.message = "Checking inbox"
        known = {
            name: scan.content_hash
            for scan in storage.list_scans()
            for name in scan.arrivals
            if scan.status != "complete"
        }
        for path in (storage.root / "inbox").iterdir():
            if not path.is_file() or path.suffix.lower() != ".pdf" or path.is_symlink():
                continue
            stat = path.stat()
            previous = observed.get(path)
            if previous is None or previous[:2] != (stat.st_size, stat.st_mtime_ns):
                observed[path] = (stat.st_size, stat.st_mtime_ns, time.monotonic())
                continue
            if time.monotonic() - previous[2] < settings.settle_seconds:
                continue
            if path.name in known and file_hash(path) == known[path.name]:
                continue
            try:
                await asyncio.to_thread(validate_scan, path)
                storage.ingest(path)
            except (OSError, ValueError):
                logger.exception("Intake failed for %s", path.name)
                state.message = f"Could not ingest {path.name}. Check the worker log"
                state.status = "error"
        observed_keys = list(observed)
        for path in observed_keys:
            if not path.exists():
                del observed[path]
        model = storage.settings()
        inference: Inference
        for scan in storage.list_scans():
            if scan.status == "queued":
                if model.provider == "demo":
                    inference = DemoInference()
                else:
                    inference = EndpointInference(
                        model,
                        settings.model_api_key,
                        record_usage=partial(
                            record_scan_usage,
                            storage,
                            scan.id,
                            processing_run=scan.processing_run,
                        ),
                    )
                state.message = f"Processing {scan.original_name}"
                await process_scan(storage, inference, LocalOCR(), scan)
            current = storage.get_scan(scan.id)
            if current.status == "complete":
                storage.archive(current)
        with storage.transaction():
            storage.rebuild_index()
        for document in storage.list_documents():
            if document.enrichment_status == "pending":
                if model.provider == "demo":
                    inference = DemoInference()
                else:
                    inference = EndpointInference(
                        model,
                        settings.model_api_key,
                        record_usage=partial(
                            record_scan_usage,
                            storage,
                            document.scan_id,
                            processing_run=document.processing_run,
                            page_map=document.source_pages,
                        ),
                    )
                state.message = f"Tagging {document.title}"
                await enrich_document(storage, inference, document)
        if state.status != "error":
            state.status = "idle"
            state.message = "Waiting for scans"
    except Exception:
        logger.exception("Worker cycle failed")
        state.status = "error"
        state.message = "Cannot process storage. Check permissions and the worker log"
