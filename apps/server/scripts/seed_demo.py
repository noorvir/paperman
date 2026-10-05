"""Create an isolated sample library without replacing existing records."""

import asyncio
import os
import shutil
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from fpdf import FPDF
from paperman_parser.demo_inference import DemoInference
from paperman_parser.models import Analysis, Catalog, CatalogEntry, DocumentProposal

from paperman.filing import file_documents
from paperman.models import Event, ModelSettings
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage, write_record

SAMPLES = [
    (
        "Electricity bill - September",
        "GreenPower | Monthly electricity charges",
        "alex",
    ),
    ("Physiotherapy invoice", "City Physio | Treatment on 24 September", "sam"),
    ("Home insurance renewal", "Harbour Insurance | Cover for the coming year", "alex"),
    ("Studio internet bill", "FibreNet | Business broadband, September", "studio"),
    ("Salary statement - September", "Northwind | Monthly salary statement", "alex"),
    (
        "Dental check-up invoice",
        "Park Dental | Routine examination and cleaning",
        "sam",
    ),
    ("Quarterly tax assessment", "Revenue Office | Third-quarter assessment", "studio"),
    ("Water bill - September", "City Water | Water supply and service charges", "alex"),
    ("Mobile phone bill", "Connect Mobile | Monthly plan and usage", "sam"),
    (
        "Business insurance policy",
        "Harbour Insurance | Professional liability cover",
        "studio",
    ),
    (
        "Savings account statement",
        "Cedar Bank | Quarterly interest and transactions",
        "alex",
    ),
    ("Annual health check", "Oak Medical | Appointment confirmation", "sam"),
    (
        "Office lease agreement",
        "Workshop Properties | Lease renewal for the studio",
        "studio",
    ),
    ("Mortgage statement", "Cedar Bank | Monthly payment and balance", "alex"),
    ("Travel insurance confirmation", "Harbour Insurance | Autumn travel cover", "sam"),
    ("Design software invoice", "Design Tools | Annual team subscription", "studio"),
    ("Car service receipt", "Riverside Garage | Annual inspection and service", "alex"),
    ("Gym membership renewal", "Motion Club | Annual membership notice", "sam"),
    (
        "Equipment purchase invoice",
        "Studio Supply | Monitor and office accessories",
        "studio",
    ),
    ("Electricity bill - August", "GreenPower | August electricity charges", "alex"),
    ("Physiotherapy treatment plan", "City Physio | Follow-up appointments", "sam"),
    (
        "Business bank statement",
        "Cedar Bank | Studio transactions for August",
        "studio",
    ),
    ("Council tax notice", "City Council | Annual property assessment", "alex"),
    ("Library membership letter", "Central Library | Membership confirmation", "sam"),
    ("Workspace cleaning invoice", "Clear Space | Monthly studio cleaning", "studio"),
    ("Home maintenance invoice", "Local Repairs | Boiler inspection", "alex"),
    ("Medical reimbursement", "Health Fund | Claim payment confirmation", "sam"),
    ("Client service agreement", "Northwind | Design services agreement", "studio"),
    ("Gas bill - August", "GreenPower | Gas supply and standing charges", "alex"),
    (
        "Pension contribution statement",
        "Future Fund | Annual contribution summary",
        "sam",
    ),
    ("Office furniture receipt", "Studio Supply | Desk and storage purchase", "studio"),
    ("Bank account confirmation", "Cedar Bank | Account details confirmation", "alex"),
    ("Dental insurance update", "Health Fund | Updated policy benefits", "sam"),
    ("Domain renewal invoice", "Web Registry | Annual domain registration", "studio"),
    (
        "Property insurance schedule",
        "Harbour Insurance | Current cover summary",
        "alex",
    ),
    ("Donation receipt", "Community Garden | Annual contribution", "sam"),
]
OWNERS = {
    "alex": "Alex Morgan",
    "sam": "Sam Morgan",
    "studio": "Morgan Studio",
    "unknown": "Unknown",
}


def sample_pdf(path: Path, entries: list[tuple[str, str, str]], issued: date) -> None:
    pdf = FPDF()
    pdf.set_title(path.stem)
    pdf.set_auto_page_break(auto=True, margin=20)
    for index, (title, summary, owner) in enumerate(entries, 1):
        pdf.add_page()
        pdf.set_font("Helvetica", size=10)
        pdf.set_text_color(120)
        pdf.cell(
            0, 12, text="PAPERMAN / SAMPLE DOCUMENT", new_x="LMARGIN", new_y="NEXT"
        )
        pdf.set_draw_color(220)
        pdf.line(10, 28, 200, 28)
        pdf.ln(14)
        pdf.set_text_color(30)
        pdf.set_font("Helvetica", "B", 18)
        pdf.multi_cell(0, 10, text=title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)
        pdf.set_font("Helvetica", size=11)
        for line in [
            f"Title: {title}",
            f"Owner: {OWNERS[owner]}",
            f"Date: {issued - timedelta(days=index)}",
            f"Summary: {summary}",
        ]:
            pdf.multi_cell(0, 8, text=line, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(14)
        pdf.multi_cell(
            0,
            7,
            text="This is a fictional document for the PaperMan demo. All names, organisations, amounts, and references are sample data.\n\nThe PDF contains selectable text so you can test preview, full-text search, document splitting, and filing without a GPU connection.",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        pdf.ln(16)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(
            0,
            8,
            text="Reference: DEMO-2026 / For UI testing only",
            new_x="LMARGIN",
            new_y="NEXT",
        )
    pdf.output(str(path))


async def seed(root: Path) -> None:
    if root.exists() and any(root.iterdir()):
        marker = root / "demo.txt"
        if marker.exists():
            print(f"Demo already exists at {root}. Existing edits were preserved.")
            return
        raise ValueError(
            "Demo destination must be empty. Existing files were preserved."
        )
    store = FileStorage(root)
    catalog = Catalog(
        owners=[CatalogEntry(id=key, name=name) for key, name in OWNERS.items()]
    )
    write_record(store.root / "catalog.toml", catalog)
    write_record(store.root / "settings.toml", ModelSettings(provider="demo"))
    inference = DemoInference()
    for batch in range(14):
        timestamp = datetime(2026, 9, 30, 10, 30, tzinfo=UTC) - timedelta(
            days=batch * 2
        )
        if batch >= 12:
            timestamp = datetime(2026, 10, 1, 8 + batch - 12, 15, tzinfo=UTC)
        entries = SAMPLES[batch * 3 : batch * 3 + 3] if batch < 12 else SAMPLES[:3]
        source = store.root / "inbox" / f"Mail_{timestamp:%Y%m%d_%H%M%S}.pdf"
        sample_pdf(source, entries, timestamp.date())
        os.utime(source, (timestamp.timestamp(), timestamp.timestamp()))
        scan = store.ingest(source)
        shutil.copyfile(source, store.scan_path(scan.id, "searchable.pdf"))
        scan.page_count = len(entries)
        scan.phase = "file"
        scan.proposal = Analysis(
            documents=[
                DocumentProposal(
                    pages=[index],
                    owner_id=owner,
                    title=title,
                    document_date=timestamp.date() - timedelta(days=index),
                    confidence=0.96,
                )
                for index, (title, _, owner) in enumerate(entries, 1)
            ]
        )
        scan.history.extend(
            [
                Event(
                    at=timestamp,
                    stage="ocr",
                    message=f"Searchable PDF created: {len(entries)} pages",
                ),
                Event(
                    at=timestamp,
                    stage="analyze",
                    message="Document groups and owners identified",
                ),
            ]
        )
        if batch < 12:
            scan = file_documents(store, scan)
            store.archive(scan)
        else:
            scan.status = "review" if batch == 12 else "failed"
            scan.phase = "file" if batch == 12 else "analyze"
            scan.history.append(
                Event(
                    stage=scan.phase,
                    message="Check the proposed document groups and owners"
                    if batch == 12
                    else "Demo failure: model connection timed out. Retry to continue.",
                )
            )
            store.save_scan(scan)
        for event in scan.history:
            event.at = timestamp
        store.save_scan(scan)
    for doc in store.list_documents():
        await enrich_document(store, inference, doc)
    store.rebuild_index()
    (store.root / "demo.txt").write_text(
        "Synthetic PaperMan UI data. No external inference calls.\n"
    )
    print(f"Created 36 sample documents and 14 scans in {store.root}")


if __name__ == "__main__":
    asyncio.run(seed(Path(".demo-data")))
