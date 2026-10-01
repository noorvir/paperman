import subprocess
import sys
from pathlib import Path

from paperman.storage import FileStorage, file_hash


def test_demo_creates_distinct_scans_and_preserves_edits(tmp_path: Path) -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "seed_demo.py"
    command = [sys.executable, str(script)]
    subprocess.run(command, cwd=tmp_path, check=True, capture_output=True)
    store = FileStorage(tmp_path / ".demo-data")
    scans = store.list_scans()
    documents = store.list_documents()
    assert len(scans) == 14
    assert len(documents) == 36
    assert {scan.status for scan in scans} == {"complete", "review", "failed"}
    assert store.settings().provider == "demo"
    for scan in scans:
        assert file_hash(store.scan_path(scan.id, "original.pdf")) == scan.content_hash
    document = documents[0]
    document.user_tags = ["tax"]
    store.save_document(document)

    subprocess.run(command, cwd=tmp_path, check=True, capture_output=True)
    assert len(store.list_documents()) == 36
    assert store.get_document(document.id).user_tags == ["tax"]
