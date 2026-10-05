from io import BytesIO

import pytest
from fpdf import FPDF
from PIL import Image
from pypdf import PdfReader, PdfWriter

from paperman_parser.pdf import render_pdf


def test_render_preserves_page_order_blank_pages_and_rotation() -> None:
    pdf = FPDF()
    colors = [(number * 10, 160, 80) for number in range(11)] + [(255, 255, 255)]
    for red, green, blue in colors:
        pdf.add_page()
        pdf.set_fill_color(red, green, blue)
        pdf.rect(0, 0, pdf.w, pdf.h, style="F")
    reader = PdfReader(BytesIO(bytes(pdf.output())))
    reader.pages[1].rotate(90)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    buffer = BytesIO()
    writer.write(buffer)

    pages = render_pdf(buffer.getvalue())
    assert len(pages) == 12
    for number, (data, color) in enumerate(zip(pages, colors, strict=True)):
        with Image.open(BytesIO(data)) as image:
            assert image.format == "PNG"
            assert image.getpixel((100, 100)) == color
            assert max(image.size) == 1600
            assert (image.width > image.height) == (number == 1)


def test_render_rejects_empty_and_encrypted_documents() -> None:
    writer = PdfWriter()
    empty = BytesIO()
    writer.write(empty)
    with pytest.raises(ValueError, match="no pages"):
        render_pdf(empty.getvalue())

    writer.add_blank_page(width=100, height=100)
    writer.encrypt("test-password")
    encrypted = BytesIO()
    writer.write(encrypted)
    with pytest.raises(ValueError, match="encrypted"):
        render_pdf(encrypted.getvalue())
