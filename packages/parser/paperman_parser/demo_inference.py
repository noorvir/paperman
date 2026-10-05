from io import BytesIO

from pypdf import PdfReader

from paperman_parser.models import Analysis, Catalog, DocumentProposal, Enrichment


class DemoInference:
    """Deterministic local responses for UI demos; never calls a model endpoint."""

    @property
    def version(self) -> str:
        return "demo-v1"

    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        pages = [page.extract_text() for page in PdfReader(BytesIO(source)).pages]
        documents: list[DocumentProposal] = []
        for number, text in enumerate(pages, 1):
            title = next(
                (
                    line.removeprefix("Title: ").strip()
                    for line in text.splitlines()
                    if line.startswith("Title: ")
                ),
                "Sample document",
            )
            owner = next(
                (entry.id for entry in catalog.owners if entry.name in text),
                "unknown",
            )
            if documents and documents[-1].title == title:
                documents[-1].pages.append(number)
            else:
                documents.append(
                    DocumentProposal(
                        pages=[number],
                        owner_id=owner,
                        title=title,
                        confidence=0.95,
                        review_reason="Demo proposal. Check the filing details.",
                    )
                )
        return Analysis(documents=documents)

    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        text = "\n".join(
            page.extract_text() for page in PdfReader(BytesIO(source)).pages
        )
        keywords = {
            "invoice": ("invoice", "bill", "receipt"),
            "utilities": ("electricity", "water", "internet", "gas", "phone"),
            "health": ("physio", "dental", "health", "medical"),
            "insurance": ("insurance",),
            "banking": ("bank", "salary", "savings", "mortgage"),
            "tax": ("tax",),
            "contract": ("agreement", "contract", "lease"),
        }
        tags = [
            entry.id
            for entry in catalog.tags
            if any(
                word in text.lower()
                for word in keywords.get(entry.id, (entry.name.lower(),))
            )
        ]
        summary = next(
            (
                line.removeprefix("Summary: ").strip()
                for line in text.splitlines()
                if line.startswith("Summary: ")
            ),
            "Sample summary from the local demo model. Review the original PDF for document details.",
        )
        suggested_tags = ["Membership"] if "membership" in text.lower() else []
        return Enrichment(tag_ids=tags, summary=summary, suggested_tags=suggested_tags)
