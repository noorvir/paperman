import shutil
import subprocess
import sys
from pathlib import Path
from typing import Protocol

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

from paperman.storage import atomic_target


class OCR(Protocol):
    def searchable(self, source: Path, target: Path, languages: str) -> list[str]: ...


class LocalOCR:
    def searchable(self, source: Path, target: Path, languages: str) -> list[str]:
        original = PdfReader(source)
        if original.is_encrypted:
            raise ValueError("This PDF is encrypted. Upload an unlocked copy")
        if not original.pages:
            raise ValueError("This PDF has no pages")
        with atomic_target(target) as temporary:
            process = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "ocrmypdf",
                    "--skip-text",
                    "--rotate-pages",
                    "--output-type",
                    "pdf",
                    "--optimize",
                    "0",
                    "--jobs",
                    "1",
                    "--language",
                    languages,
                    str(source),
                    str(temporary),
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=1800,
            )
            if process.returncode != 0:
                detail = process.stderr.strip()[-800:]
                raise ValueError(f"OCR failed: {detail}")
            result = PdfReader(temporary)
            if len(result.pages) != len(original.pages):
                raise ValueError("OCR changed the page count")
            pages = [page.extract_text() for page in result.pages]
            if not any(text.strip() for text in pages):
                raise ValueError(
                    "OCR found no readable text. Check the scan and OCR language"
                )
        return pages


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
