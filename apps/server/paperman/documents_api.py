from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from paperman.api_models import (
    DocumentDetail,
    DocumentPage,
    TagSelection,
)
from paperman.models import (
    Document,
    Identifier,
    SearchIndex,
)
from paperman.storage import FileStorage, safe_path


def routes(storage: FileStorage) -> APIRouter:
    router = APIRouter()

    @router.get("/api/documents", operation_id="documents")
    def documents(
        q: str = "",
        owner: str = "",
        tag: str = "",
        status: str = "",
        after: date | None = None,
        before: date | None = None,
        sort: Literal["date_desc", "date_asc", "title"] = "date_desc",
        page: Annotated[int, Query(ge=1)] = 1,
    ) -> DocumentPage:
        documents = storage.list_documents()
        index_path = storage.root / "state" / "search.json"
        index = (
            SearchIndex.model_validate_json(index_path.read_bytes())
            if index_path.exists()
            else storage.rebuild_index()
        )
        text = {entry.document_id: entry.text.casefold() for entry in index.entries}
        terms = q.casefold().split()
        items = [
            doc
            for doc in documents
            if (not owner or doc.owner_id == owner)
            and (not tag or tag in effective_tags(doc))
            and (not status or doc.enrichment_status == status)
            and (not after or doc.document_date >= after)
            and (not before or doc.document_date <= before)
            and all(
                term in f"{doc.title} {doc.summary}".casefold() + text.get(doc.id, "")
                for term in terms
            )
        ]
        if sort == "title":
            items.sort(key=lambda doc: (doc.title.casefold(), doc.id))
        else:
            items.sort(
                key=lambda doc: (doc.document_date, doc.id), reverse=sort == "date_desc"
            )
        return DocumentPage(
            items=items[(page - 1) * 25 : page * 25],
            total=len(items),
            page=page,
            pages=max(1, (len(items) + 24) // 25),
        )

    @router.get("/api/documents/{document_id}", operation_id="document")
    def document(document_id: Identifier) -> DocumentDetail:
        doc = storage.get_document(document_id)
        path = safe_path(storage.root, doc.final_path).with_suffix(".txt")
        return DocumentDetail(document=doc, text=path.read_text())

    @router.get("/api/documents/{document_id}/pdf", operation_id="document_pdf")
    def document_pdf(document_id: Identifier) -> FileResponse:
        doc = storage.get_document(document_id)
        return FileResponse(
            safe_path(storage.root, doc.final_path),
            media_type="application/pdf",
            filename=Path(doc.final_path).name,
            content_disposition_type="inline",
        )

    @router.put("/api/documents/{document_id}/tags", operation_id="document_tags")
    def document_tags(document_id: Identifier, value: TagSelection) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            allowed = {tag.id for tag in storage.catalog().tags}
            if not set(value.tag_ids) <= allowed:
                raise ValueError("Select tags from the catalog")
            doc.user_tags = sorted(set(value.tag_ids))
            doc.excluded_tags = sorted(allowed - set(value.tag_ids))
            storage.save_document(doc)
            return doc

    @router.post("/api/documents/{document_id}/enrich", operation_id="enrich_document")
    def enrich(document_id: Identifier) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            if doc.enrichment_status == "running":
                raise HTTPException(409, "Tagging is already running")
            doc.enrichment_status = "pending"
            doc.enrichment_error = ""
            storage.save_document(doc)
            (storage.root / "state" / "wake").touch()
            return doc

    return router


def effective_tags(document: Document) -> set[str]:
    return (set(document.generated_tags) - set(document.excluded_tags)) | set(
        document.user_tags
    )
