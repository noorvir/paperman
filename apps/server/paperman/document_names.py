import re
import tomllib
from datetime import date

from filelock import FileLock
from paperman_parser.models import Identifier, Record

from paperman.models import Document, Event
from paperman.storage import FileStorage, safe_path, slug, write_record


def document_filename(document_date: date, title: str, timestamp_ms: int) -> str:
    return f"{document_date}-{slug(title).rstrip('-')}-{timestamp_ms}.pdf"


def rename_documents(storage: FileStorage) -> int:
    """Rename filed PDFs and sidecars with the API and worker stopped. Resume on retry."""
    worker_lock = FileLock(storage.root / "state" / "worker.lock", timeout=0)
    with worker_lock, storage.transaction():
        journal = storage.root / "state" / "rename-documents.json"
        if journal.exists():
            plan = RenamePlan.model_validate_json(journal.read_bytes())
        else:
            moves: list[DocumentRename] = []
            reserved = {
                path
                for scan in storage.list_scans()
                for path in scan.filing_paths.values()
            }
            for document in sorted(
                storage.list_documents(include_unpublished=True), key=lambda doc: doc.id
            ):
                source = safe_path(storage.root, document.final_path)
                prefix = f"{document.document_date}-{slug(document.title).rstrip('-')}"
                if re.fullmatch(rf"{re.escape(prefix)}-\d+\.pdf", source.name):
                    continue
                for suffix in (".pdf", ".txt", ".toml"):
                    if not source.with_suffix(suffix).is_file():
                        raise FileNotFoundError(
                            f"Missing document file: {source.with_suffix(suffix)}"
                        )
                timestamp = int(document.scanned_at.timestamp() * 1000)
                while True:
                    filename = document_filename(
                        document.document_date, document.title, timestamp
                    )
                    target = source.with_name(filename)
                    relative = target.relative_to(storage.root).as_posix()
                    copies = [
                        safe_path(storage.root, path).with_name(filename)
                        for path in document.file_paths
                    ]
                    if not any(
                        path.relative_to(storage.root).as_posix() in reserved
                        for path in copies
                    ) and not any(
                        copy.with_suffix(suffix).exists()
                        for copy in copies
                        for suffix in (".pdf", ".txt", ".toml")
                    ):
                        break
                    timestamp += 1
                reserved.add(relative)
                moves.append(
                    DocumentRename(
                        id=document.id, source=document.final_path, target=relative
                    )
                )
            plan = RenamePlan(moves=moves)
            if not moves:
                return 0
            # Persist destinations before moving any member of a PDF/text/metadata set.
            write_record(journal, plan)

        for move in plan.moves:
            source = safe_path(storage.root, move.source)
            target = safe_path(storage.root, move.target)
            metadata = source.with_suffix(".toml")
            if not metadata.exists():
                metadata = target.with_suffix(".toml")
            document = Document.model_validate(tomllib.loads(metadata.read_text()))
            old_copies = [
                safe_path(storage.root, f"documents/{owner}/{source.name}")
                for owner in document.owner_ids
            ]
            if document.id != move.id or document.final_path not in (
                move.source,
                move.target,
            ):
                raise ValueError(f"Document changed during rename: {move.id}")
            for suffix in (".pdf", ".txt", ".toml"):
                old = source.with_suffix(suffix)
                new = target.with_suffix(suffix)
                if old.exists():
                    if new.exists():
                        raise FileExistsError(f"Rename destination is occupied: {new}")
                    old.rename(new)
                elif not new.exists():
                    raise FileNotFoundError(f"Missing document file: {old}")
            if document.final_path != move.target:
                document.final_path = move.target
                document.revision += 1
                document.history.append(
                    Event(stage="rename", message="Updated filename")
                )
                storage.save_document(document)
            for copy in old_copies:
                if copy != source:
                    for suffix in (".pdf", ".txt", ".toml"):
                        copy.with_suffix(suffix).unlink(missing_ok=True)
            try:
                scan = storage.get_scan(document.scan_id)
            except FileNotFoundError:
                continue
            if move.id in scan.filing_paths:
                scan.filing_paths[move.id] = move.target
                storage.save_scan(scan)
        journal.unlink()
        return len(plan.moves)


class DocumentRename(Record):
    id: Identifier
    source: str
    target: str


class RenamePlan(Record):
    moves: list[DocumentRename]
