from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Protocol

from pypdf import PdfReader


class OCR(Protocol):
    def searchable(self, source: bytes, languages: str) -> SearchableDocument: ...


@dataclass(frozen=True)
class SearchableDocument:
    pdf: bytes
    pages: list[str]


class LocalOCR:
    def searchable(self, source: bytes, languages: str) -> SearchableDocument:
        original = PdfReader(BytesIO(source))
        if original.is_encrypted:
            raise ValueError("This PDF is encrypted. Upload an unlocked copy")
        if not original.pages:
            raise ValueError("This PDF has no pages")

        with TemporaryDirectory(prefix="paperman-ocr-") as directory:
            input_path = Path(directory) / "original.pdf"
            output_path = Path(directory) / "searchable.pdf"
            input_path.write_bytes(source)
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
                    str(input_path),
                    str(output_path),
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=1800,
            )
            if process.returncode != 0:
                detail = process.stderr.strip()[-800:]
                raise ValueError(f"OCR failed: {detail}")

            pdf = output_path.read_bytes()
            result = PdfReader(BytesIO(pdf))
            if len(result.pages) != len(original.pages):
                raise ValueError("OCR changed the page count")
            pages = [page.extract_text() for page in result.pages]
            return SearchableDocument(pdf=pdf, pages=pages)
