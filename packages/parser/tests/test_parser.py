import asyncio
from io import BytesIO

import pytest
from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

from paperman_parser import parse
from paperman_parser.demo_inference import DemoInference
from paperman_parser.models import Analysis, Catalog, CatalogEntry, DocumentProposal
from paperman_parser.ocr import LocalOCR


def test_parse_pdf_bytes_and_enrich_without_server_state() -> None:
    pdf = FPDF()
    for text in [
        "Title: Electricity invoice\nAlice Smith\nSummary: Electricity charges",
        "Title: Electricity invoice\nContinued charges: 150 EUR",
        "Title: Appointment letter\nUnknown recipient",
    ]:
        pdf.add_page()
        pdf.set_font("Helvetica", size=14)
        pdf.multi_cell(w=180, h=10, text=text)
    source = bytes(pdf.output())
    catalog = Catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    before = catalog.model_dump_json()
    inference = DemoInference()

    first = asyncio.run(
        parse(source, catalog=catalog, ocr=LocalOCR(), inference=inference)
    )
    second = asyncio.run(
        parse(source, catalog=catalog, ocr=LocalOCR(), inference=inference)
    )
    assert first.analysis == second.analysis
    assert catalog.model_dump_json() == before
    assert [item.pages for item in first.analysis.documents] == [[1, 2], [3]]
    assert [item.owner_id for item in first.analysis.documents] == ["alice", "unknown"]
    assert all(item.document_date is None for item in first.analysis.documents)
    assert len(PdfReader(BytesIO(first.content.pdf)).pages) == 3
    assert "Electricity invoice" in first.content.pages[0]
    assert first.content.pages == second.content.pages

    tags = asyncio.run(inference.enrich("\n".join(first.content.pages[:2]), catalog))
    assert set(tags.tag_ids) == {"invoice", "utilities"}


def test_image_scan_gets_searchable_text() -> None:
    image = Image.new("RGB", (1240, 1754), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=42)
    draw.text((100, 150), "ELECTRICITY INVOICE", fill="black", font=font)
    draw.text((100, 250), "Alice Smith", fill="black", font=font)
    draw.text((100, 350), "Total 150 EUR", fill="black", font=font)
    buffer = BytesIO()
    image.save(buffer, "PDF", resolution=150)
    source = buffer.getvalue()
    assert not PdfReader(BytesIO(source)).pages[0].extract_text().strip()

    result = LocalOCR().searchable(source, "eng")
    assert len(result.pages) == 1
    assert "INVOICE" in result.pages[0]
    assert "150" in PdfReader(BytesIO(result.pdf)).pages[0].extract_text()


class InvalidInference(DemoInference):
    async def analyze(self, pages: list[str], catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[DocumentProposal(pages=[1, 1], title="Invoice", confidence=1)]
        )


def test_parse_rejects_incomplete_coverage_from_an_adapter() -> None:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=14)
    pdf.multi_cell(w=180, h=10, text="INVOICE - one page")
    with pytest.raises(ValueError, match="Every page"):
        asyncio.run(
            parse(
                bytes(pdf.output()),
                catalog=Catalog(),
                ocr=LocalOCR(),
                inference=InvalidInference(),
            )
        )
