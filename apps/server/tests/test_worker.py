import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

from test_pipeline import create_pdf

from paperman.config import Settings
from paperman.models import Inbox, Scan, WorkerState, personal_inbox_id
from paperman.storage import FileStorage
from paperman.worker import run_cycle


def test_worker_intake_keeps_same_file_in_separate_inboxes(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    personal = Inbox(id=personal_inbox_id("alice"), account_id="alice", name="Alice")
    store.save_inbox(personal)
    shared_file = store.inbox_path("shared") / "mail.pdf"
    create_pdf(shared_file)
    store.ingest(shared_file)
    personal_file = store.inbox_path(personal.id) / "mail.pdf"
    personal_file.write_bytes(shared_file.read_bytes())
    settings = Settings(data_dir=tmp_path, settle_seconds=0)
    observed: dict[Path, tuple[int, int, float]] = {}
    state = WorkerState(status="idle")

    asyncio.run(run_cycle(store, settings, observed, state))
    asyncio.run(run_cycle(store, settings, observed, state))

    scans = store.list_scans()
    assert len(scans) == 2
    assert {scan.inbox_id for scan in scans} == {"shared", personal.id}
    assert len({scan.id for scan in scans}) == 2
    assert all(scan.status == "failed" for scan in scans)
    assert all(
        scan.history[-1].message.startswith("Configure the model") for scan in scans
    )
    assert shared_file.exists() and personal_file.exists()


def test_daemon_waits_for_upload_and_recovers_after_restart(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    (tmp_path / "inbox" / "unfinished.pdf").write_bytes(b"%PDF-1.7\npartial upload")
    source = tmp_path / "fixture.pdf"
    create_pdf(source)
    payload = source.read_bytes()
    env = {
        **os.environ,
        "PAPERMAN_DATA_DIR": str(tmp_path),
        # Poll slower than the heartbeat to catch status writes starving intake.
        "PAPERMAN_POLL_SECONDS": "4",
        "PAPERMAN_SETTLE_SECONDS": "1",
        "PYDANTIC_AI_NO_BANNER": "1",
    }
    command = [sys.executable, "-c", "from paperman.cli import main; main()", "worker"]
    worker = subprocess.Popen(
        command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        incoming = tmp_path / "inbox" / "upload.pdf"
        with incoming.open("wb") as output:
            output.write(payload[:50])
            output.flush()
            time.sleep(0.5)
            assert store.list_scans() == []
            output.write(payload[50:])
        scan = wait_for_failure(store)
        assert scan.phase == "analyze"
        assert scan.history[-1].message.startswith("Configure the model")
        assert incoming.exists()
        assert (tmp_path / "inbox" / "unfinished.pdf").exists()
        assert len(store.list_scans()) == 1
        assert store.worker_state() is not None
    finally:
        worker.terminate()
        worker.wait(timeout=10)

    scan.status = "running"
    store.save_scan(scan)
    worker = subprocess.Popen(
        command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        resumed = wait_for_failure(store, previous_attempt=scan.attempts)
        assert resumed.attempts > scan.attempts
        assert len(store.list_scans()) == 1
        assert any(
            event.message == "Resumed after worker restart" for event in resumed.history
        )
    finally:
        worker.terminate()
        worker.wait(timeout=10)


def wait_for_failure(store: FileStorage, previous_attempt: int = 0) -> Scan:
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        scans = store.list_scans()
        if (
            scans
            and scans[0].status == "failed"
            and scans[0].attempts > previous_attempt
        ):
            return scans[0]
        time.sleep(0.2)
    raise AssertionError("Worker did not produce a visible failure within 25 seconds")
