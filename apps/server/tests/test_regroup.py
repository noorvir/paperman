import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry, DocumentProposal
from pypdf import PdfReader
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import ScanReview
from paperman.config import Settings
from paperman.models import Scan
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, file_hash, write_record


class InterruptedPublication(FileStorage):
    def save_scan(self, scan: Scan) -> None:
        if scan.filing_revision == 1 and scan.status == "complete":
            raise OSError("Interrupted before publication")
        super().save_scan(scan)


def test_regroup_preserves_active_files_and_recovers_from_interrupted_publication(
    tmp_path: Path,
) -> None:
    store = InterruptedPublication(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    original_hash = file_hash(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    assert scan.proposal is not None
    client.put(
        f"/api/scans/{scan.id}/review", json=scan.proposal.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    documents = sorted(store.list_documents(), key=lambda doc: doc.source_pages)
    retired, retained = documents
    retired.text_override = "Human correction kept in history"
    store.save_document(retired)
    retained.user_tags = ["health"]
    retained.summary = "Human summary"
    retained.summary_edited = True
    store.save_document(retained)
    retained_hash = file_hash(tmp_path / retained.final_path)
    review = ScanReview(
        documents=[
            DocumentProposal(
                pages=[1], owner_ids=["alice"], title="Invoice", confidence=1
            ),
            DocumentProposal(
                pages=[2], owner_ids=["alice"], title="Charges", confidence=1
            ),
            DocumentProposal(pages=[3], title=retained.title, confidence=1),
        ],
        document_revisions={doc.id: doc.revision for doc in documents},
    )
    invalid = review.model_copy(deep=True)
    invalid.documents[0].pages = [1, 2]
    assert (
        client.put(
            f"/api/scans/{scan.id}/review", json=invalid.model_dump(mode="json")
        ).status_code
        == 422
    )
    stale = review.model_copy(update={"document_revisions": {}})
    assert (
        client.put(
            f"/api/scans/{scan.id}/review", json=stale.model_dump(mode="json")
        ).status_code
        == 409
    )
    assert store.get_scan(scan.id).filing_revision == 0

    client.put(
        f"/api/scans/{scan.id}/review", json=review.model_dump(mode="json")
    ).raise_for_status()
    assert (
        client.put(
            f"/api/documents/{retained.id}/tags", json={"tag_ids": []}
        ).status_code
        == 409
    )
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    failed = store.get_scan(scan.id)
    assert failed.status == "failed"
    assert failed.document_ids == [doc.id for doc in documents]
    assert {doc.id for doc in store.list_documents()} == set(failed.document_ids)
    staged = [
        doc
        for doc in store.list_documents(include_unpublished=True)
        if doc.id not in failed.document_ids
    ]
    assert len(staged) == 2
    assert client.get(f"/api/documents/{staged[0].id}").status_code == 404

    restarted = FileStorage(tmp_path)
    client.post(f"/api/scans/{scan.id}/retry").raise_for_status()
    asyncio.run(process_scan(restarted, FixtureInference(), FixtureOCR(), failed))
    complete = restarted.get_scan(scan.id)
    assert complete.status == "complete"
    assert len(complete.document_ids) == 3
    current = sorted(restarted.list_documents(), key=lambda doc: doc.source_pages)
    assert [doc.source_pages for doc in current] == [[1], [2], [3]]
    assert current[2].id == retained.id
    assert current[2].final_path == retained.final_path
    assert current[2].user_tags == ["health"]
    assert current[2].summary == "Human summary"
    assert file_hash(tmp_path / retained.final_path) == retained_hash
    assert all(len(PdfReader(tmp_path / doc.final_path).pages) == 1 for doc in current)
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash
    assert client.get(f"/api/documents/{retired.id}").status_code == 404
    restarted.archive(complete)
    restarted.archive(complete)
    archived = list(store.scan_path(scan.id, "revisions/0/documents").rglob("*.toml"))
    assert len(archived) == 1
    assert retired.text_override in archived[0].read_text()
    assert not (tmp_path / retired.final_path).exists()
    assert len(restarted.rebuild_index().entries) == 3

    # Reapplying the same grouping keeps all published identities and paths.
    review.document_revisions = {doc.id: doc.revision for doc in current}
    client.put(
        f"/api/scans/{scan.id}/review", json=review.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(process_scan(restarted, FixtureInference(), FixtureOCR(), complete))
    assert restarted.get_scan(scan.id).document_ids == complete.document_ids
    assert {doc.final_path for doc in restarted.list_documents()} == {
        doc.final_path for doc in current
    }
