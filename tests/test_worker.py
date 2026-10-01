import os
import subprocess
import sys
import time
from pathlib import Path

from test_pipeline import create_pdf

from paperman.models import Scan
from paperman.storage import FileStorage


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
