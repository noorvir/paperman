import shutil
from io import BytesIO
from pathlib import Path

from paperman_parser.models import PageRotation
from paperman_parser.ocr import OCR
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

from paperman.storage import atomic_target


def prepare_pdf(
    source: Path, target: Path, ocr: OCR, languages: str, rotations: list[PageRotation]
) -> int:
    content = ocr.searchable(source.read_bytes(), languages, rotations=rotations)
    with atomic_target(target) as temporary:
        temporary.write_bytes(content.pdf)
    return len(content.pages)


def extract_pages(path: Path) -> list[str]:
    reader = PdfReader(path)
    return [page.extract_text() for page in reader.pages]


def split_pdf(source: Path, target: Path, pages: list[int]) -> str:
    reader = PdfReader(source)
    writer = PdfWriter()
    text: list[str] = []
    for number in pages:
        page = reader.pages[number - 1]
        writer.add_page(page)
        text.append(page.extract_text())
    with atomic_target(target) as temporary:
        writer.write(temporary)
        if len(PdfReader(temporary).pages) != len(pages):
            raise ValueError("Filed PDF has an incorrect page count")
    return "\n\f\n".join(text)


def edit_pages(
    source: Path, current: Path, current_pages: list[int], pages: list[int]
) -> tuple[bytes, str]:
    """Retain saved pages and take newly included pages from the searchable scan."""
    scan = PdfReader(source)
    document = PdfReader(current)
    if not pages or len(pages) != len(set(pages)):
        raise ValueError("Select at least one page, once each")
    if min(pages) < 1 or max(pages) > len(scan.pages):
        raise ValueError("Select pages within the source scan")
    if len(document.pages) != len(current_pages):
        raise ValueError("The saved PDF does not match its source pages")
    positions = {number: index for index, number in enumerate(current_pages)}
    writer = PdfWriter()
    text: list[str] = []
    for number in pages:
        if number in positions:
            page = document.pages[positions[number]]
        else:
            page = scan.pages[number - 1]
        writer.add_page(page)
        text.append(page.extract_text())
    output = BytesIO()
    writer.write(output)
    return output.getvalue(), "\n\f\n".join(text)


def ocr_available() -> bool:
    return shutil.which("tesseract") is not None


def validate_scan(path: Path) -> None:
    try:
        reader = PdfReader(path)
        if not reader.is_encrypted and not reader.pages:
            raise ValueError("This PDF has no pages")
    except PyPdfError as error:
        raise ValueError("The PDF is incomplete or unreadable") from error
