import hashlib
import os
import re
import shutil
import tempfile
import tomllib
import unicodedata
from collections.abc import Generator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

import tomli_w
from filelock import FileLock
from pydantic import BaseModel, JsonValue, TypeAdapter

from paperman.models import (
    Catalog,
    Document,
    Event,
    LegacyIndex,
    ModelSettings,
    Scan,
    SearchEntry,
    SearchIndex,
    WorkerState,
)


class Storage(Protocol):
    root: Path

    def transaction(self) -> FileLock: ...
    def scan_path(self, scan_id: str, name: str) -> Path: ...
    def list_scans(self) -> list[Scan]: ...
    def save_scan(self, scan: Scan) -> None: ...
    def get_scan(self, scan_id: str) -> Scan: ...
    def list_documents(self) -> list[Document]: ...
    def save_document(self, document: Document) -> None: ...
    def get_document(self, document_id: str) -> Document: ...
    def catalog(self) -> Catalog: ...
    def settings(self) -> ModelSettings: ...


class FileStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        for directory in ("inbox", "scans", "documents", "state"):
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        with self.transaction():
            if not (self.root / "catalog.toml").exists():
                catalog = Catalog()
                legacy = self.root / "index.json"
                if legacy.exists():
                    from paperman.models import CatalogEntry

                    index = LegacyIndex.model_validate_json(legacy.read_bytes())
                    catalog.tags = [
                        CatalogEntry(id=tag.id, name=tag.name) for tag in index.tags
                    ]
                write_record(self.root / "catalog.toml", catalog)
            if not (self.root / "settings.toml").exists():
                write_record(self.root / "settings.toml", ModelSettings())

    def transaction(self) -> FileLock:
        return FileLock(self.root / "state" / "write.lock", timeout=10)

    def scan_path(self, scan_id: str, name: str) -> Path:
        return safe_path(self.root, f"scans/{scan_id}/{name}")

    def get_scan(self, scan_id: str) -> Scan:
        return Scan.model_validate_json(
            self.scan_path(scan_id, "scan.json").read_bytes()
        )

    def save_scan(self, scan: Scan) -> None:
        write_record(self.scan_path(scan.id, "scan.json"), scan)

    def list_scans(self) -> list[Scan]:
        return sorted(
            [
                Scan.model_validate_json(path.read_bytes())
                for path in (self.root / "scans").glob("*/scan.json")
            ],
            key=lambda scan: scan.scanned_at,
            reverse=True,
        )

    def catalog(self) -> Catalog:
        return Catalog.model_validate(
            tomllib.loads((self.root / "catalog.toml").read_text())
        )

    def settings(self) -> ModelSettings:
        return ModelSettings.model_validate(
            tomllib.loads((self.root / "settings.toml").read_text())
        )

    def list_documents(self) -> list[Document]:
        return [
            Document.model_validate(tomllib.loads(path.read_text()))
            for path in (self.root / "documents").glob("*/*.toml")
        ]

    def get_document(self, document_id: str) -> Document:
        for document in self.list_documents():
            if document.id == document_id:
                return document
        raise FileNotFoundError("Document not found")

    def save_document(self, document: Document) -> None:
        write_record(
            safe_path(self.root, document.final_path).with_suffix(".toml"), document
        )

    def ingest(self, path: Path) -> Scan:
        digest = file_hash(path)
        with self.transaction():
            record_path = self.scan_path(digest, "scan.json")
            if record_path.exists():
                scan = self.get_scan(digest)
                scan.history.append(
                    Event(stage="intake", message=f"Duplicate arrival: {path.name}")
                )
                if path.name not in scan.arrivals:
                    scan.arrivals.append(path.name)
                self.save_scan(scan)
                if file_hash(path) == digest:
                    path.unlink()
                return scan

            scan = Scan(
                id=digest,
                content_hash=digest,
                original_name=path.name,
                scanned_at=datetime.fromtimestamp(path.stat().st_mtime, UTC),
                arrivals=[path.name],
            )
            source = self.scan_path(digest, "original.pdf")
            with atomic_target(source) as temporary:
                shutil.copyfile(path, temporary)
                if file_hash(temporary) != digest or file_hash(path) != digest:
                    raise ValueError(
                        "Scan changed during intake; waiting for upload to finish"
                    )
            scan.history.append(Event(stage="intake", message="Original preserved"))
            self.save_scan(scan)
            return scan

    def archive(self, scan: Scan) -> None:
        for name in scan.arrivals:
            path = safe_path(self.root, f"inbox/{name}")
            if path.is_file() and file_hash(path) == scan.content_hash:
                path.unlink()

    def rebuild_index(self) -> SearchIndex:
        entries: list[SearchEntry] = []
        for document in self.list_documents():
            path = safe_path(self.root, document.final_path).with_suffix(".txt")
            if not path.exists():
                from paperman.pdf import extract_pages

                text = "\n\f\n".join(extract_pages(path.with_suffix(".pdf")))
                with atomic_target(path) as temporary:
                    temporary.write_text(text)
            entries.append(SearchEntry(document_id=document.id, text=path.read_text()))
        index = SearchIndex(entries=entries)
        write_record(self.root / "state" / "search.json", index)
        return index

    def worker_state(self) -> WorkerState | None:
        path = self.root / "state" / "worker.json"
        if not path.exists():
            return None
        return WorkerState.model_validate_json(path.read_bytes())


def safe_path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Invalid storage path")
    return path


def file_hash(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")[:70] or "document"


@contextmanager
def atomic_target(path: Path) -> Generator[Path]:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, filename = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    os.close(descriptor)
    temporary = Path(filename)
    try:
        yield temporary
        with temporary.open("rb") as stream:
            os.fsync(stream.fileno())
        temporary.replace(path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def write_record(path: Path, record: BaseModel) -> None:
    if path.suffix == ".toml":
        values = TypeAdapter(dict[str, JsonValue]).validate_json(
            record.model_dump_json(exclude_none=True)
        )
        content = tomli_w.dumps(values)
    else:
        content = record.model_dump_json(indent=2) + "\n"
    with atomic_target(path) as temporary:
        temporary.write_text(content)
