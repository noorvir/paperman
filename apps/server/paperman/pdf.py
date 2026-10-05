import shutil
from pathlib import Path

from paperman_parser.ocr import OCR
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

from paperman.storage import atomic_target


def prepare_pdf(source: Path, target: Path, ocr: OCR, languages: str) -> int:
    content = ocr.searchable(source.read_bytes(), languages)
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


def ocr_available() -> bool:
    return shutil.which("tesseract") is not None


def validate_scan(path: Path) -> None:
    try:
        reader = PdfReader(path)
        if not reader.is_encrypted and not reader.pages:
            raise ValueError("This PDF has no pages")
    except PyPdfError as error:
        raise ValueError("The PDF is incomplete or unreadable") from error
