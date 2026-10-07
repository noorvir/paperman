from collections.abc import Sequence

from paperman_parser.models import ProcessingUsage
from paperman_parser.usage import allocate_usage

from paperman.models import ScanUsage
from paperman.storage import Storage


def record_scan_usage(
    storage: Storage,
    scan_id: str,
    call: ProcessingUsage,
    *,
    processing_run: int,
    page_map: Sequence[int] | None = None,
) -> None:
    if page_map is not None:
        call = call.model_copy(
            update={
                "source_pages": [page_map[number - 1] for number in call.source_pages]
            }
        )
    with storage.transaction():
        scan = storage.get_scan(scan_id)
        if not any(saved.id == call.id for saved in scan.processing):
            scan.processing.append(
                ScanUsage.model_validate(
                    call.model_dump() | {"processing_run": processing_run}
                )
            )
            storage.save_scan(scan)

        documents = [
            doc
            for doc in storage.list_documents()
            if doc.scan_id == scan_id and doc.processing_run == processing_run
        ]
        calls = [
            saved for saved in scan.processing if saved.processing_run == processing_run
        ]
        retained_pages = [page for doc in documents for page in doc.source_pages]
        for document in documents:
            document.processing = allocate_usage(
                calls, document.source_pages, retained_pages
            )
            storage.save_document(document)
