import subprocess
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError


def render_pdf(source: bytes) -> list[bytes]:
    """Render visible PDF pages as ordered PNGs with a 2400-pixel longest edge."""
    try:
        reader = PdfReader(BytesIO(source))
        if reader.is_encrypted:
            raise ValueError("This PDF is encrypted. Upload an unlocked copy")
        page_count = len(reader.pages)
    except PyPdfError as error:
        raise ValueError("The PDF is incomplete or unreadable") from error
    if not page_count:
        raise ValueError("This PDF has no pages")

    with TemporaryDirectory(prefix="paperman-render-") as directory:
        root = Path(directory)
        path = root / "source.pdf"
        path.write_bytes(source)
        try:
            process = subprocess.run(
                [
                    "pdftoppm",
                    "-png",
                    "-cropbox",
                    "-scale-to",
                    "2400",
                    str(path),
                    str(root / "page"),
                ],
                capture_output=True,
                check=False,
                timeout=300,
            )
        except FileNotFoundError as error:
            raise ValueError(
                "PDF rendering needs Poppler (pdftoppm) on the worker"
            ) from error
        except subprocess.TimeoutExpired as error:
            raise ValueError(
                "PDF rendering timed out. Check the PDF and retry"
            ) from error
        if process.returncode:
            raise ValueError(
                "Could not render the PDF. Check that its pages can be opened"
            )
        paths = sorted(
            root.glob("page-*.png"),
            key=lambda item: int(item.stem.removeprefix("page-")),
        )
        if len(paths) != page_count:
            raise ValueError("PDF rendering did not produce every page")
        return [page.read_bytes() for page in paths]


def select_pages(source: bytes, pages: list[int]) -> bytes:
    """Return a PDF containing the given one-based source pages, in order."""
    reader = PdfReader(BytesIO(source))
    writer = PdfWriter()
    for number in pages:
        writer.add_page(reader.pages[number - 1])
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def pages_with_text(source: bytes) -> set[int]:
    reader = PdfReader(BytesIO(source))
    return {
        number
        for number, page in enumerate(reader.pages, 1)
        if page.extract_text().strip()
    }
