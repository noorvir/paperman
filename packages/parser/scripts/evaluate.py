"""Evaluate the standalone parser against frozen, visually reviewed labels."""

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
import subprocess
from datetime import UTC, date, datetime
from pathlib import Path
from time import perf_counter

from pydantic import Field

from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Analysis,
    Catalog,
    Enrichment,
    InferenceSettings,
    Record,
    validate_analysis,
)
from paperman_parser.ocr import LocalOCR


class ExpectedDocument(Record):
    pages: list[int]
    owner_id: str
    document_date: date | None
    required_tags: list[str]
    optional_tags: list[str]
    title_any: list[str]
    evidence: str


class ExpectedPage(Record):
    page: int
    transcript: str


class Sample(Record):
    id: str
    sha256: str
    ocr_languages: str
    pages: list[ExpectedPage]
    expected: list[ExpectedDocument]


class GroundTruth(Record):
    version: int
    reviewed_on: date
    reviewer: str
    method: str
    scope: str
    documents: list[Sample]


class FrozenFiles(Record):
    version: int
    created_on: date
    files: dict[str, str]


class EnrichedGroup(Record):
    pages: list[int]
    result: Enrichment | None = None
    error: str = ""
    seconds: float = 0


class Prediction(Record):
    id: str
    source_sha256: str
    ocr_languages: str
    pages: list[str] = Field(default_factory=list)
    analysis: Analysis | None = None
    enriched: list[EnrichedGroup] = Field(default_factory=list)
    error: str = ""
    seconds: dict[str, float] = Field(default_factory=dict)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path: Path, value: Record) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(value.model_dump_json(indent=2) + "\n")
    temporary.replace(path)


async def evaluate(
    labels: Path, pdfs: Path, output: Path, settings: InferenceSettings
) -> None:
    frozen = FrozenFiles.model_validate_json(
        (labels / "ground-truth.sha256.json").read_text()
    )
    for filename, expected_hash in frozen.files.items():
        if digest(labels / filename) != expected_hash:
            raise ValueError(f"Frozen annotation changed: {filename}")

    truth = GroundTruth.model_validate_json((labels / "ground-truth.json").read_text())
    catalog = Catalog.model_validate_json((labels / "catalog.json").read_text())
    for sample in truth.documents:
        if digest(pdfs / f"{sample.id}.pdf") != sample.sha256:
            raise ValueError(f"Source PDF changed: {sample.id}")

    # A run directory is never reused. Keep failed runs as evidence too.
    output.mkdir(parents=True, exist_ok=False)
    package = Path(__file__).resolve().parents[1]
    metadata = {
        "started_at": datetime.now(UTC).isoformat(),
        "settings": settings.model_dump(mode="json"),
        "revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=package, text=True
        ).strip(),
        "parser_sha256": {
            str(path.relative_to(package)): digest(path)
            for path in sorted((package / "paperman_parser").glob("*.py"))
        },
        "frozen_sha256": digest(labels / "ground-truth.sha256.json"),
        "annotations": frozen.model_dump(mode="json"),
        "versions": {
            name: importlib.metadata.version(name)
            for name in ("pydantic", "pydantic-ai-slim", "pypdf", "ocrmypdf")
        },
        "tesseract": subprocess.check_output(["tesseract", "--version"], text=True),
        "tessdata": {
            path.name: digest(path)
            for path in sorted(
                Path(os.environ["TESSDATA_PREFIX"]).glob("*.traineddata")
            )
        },
    }
    (output / "run.json").write_text(json.dumps(metadata, indent=2) + "\n")
    inference = EndpointInference(
        settings, os.environ.get("PAPERMAN_MODEL_API_KEY", "local")
    )
    ocr = LocalOCR()

    for sample in truth.documents:
        prediction = Prediction(
            id=sample.id,
            source_sha256=sample.sha256,
            ocr_languages=sample.ocr_languages,
        )
        result_path = output / f"{sample.id}.json"
        started = perf_counter()
        phase = "ocr"
        stage_started = started
        print(f"{sample.id}: OCR", flush=True)
        try:
            content = await asyncio.to_thread(
                ocr.searchable,
                (pdfs / f"{sample.id}.pdf").read_bytes(),
                sample.ocr_languages,
            )
            prediction.seconds[phase] = perf_counter() - stage_started
            prediction.pages = content.pages
            (output / f"{sample.id}.pdf").write_bytes(content.pdf)
            save(result_path, prediction)

            phase = "analyze"
            stage_started = perf_counter()
            print(f"{sample.id}: split and fields", flush=True)
            prediction.analysis = await inference.analyze(content.pages, catalog)
            validate_analysis(prediction.analysis, len(content.pages), catalog)
            prediction.seconds[phase] = perf_counter() - stage_started
            save(result_path, prediction)

            phase = "enrich"
            stage_started = perf_counter()
            for group in prediction.analysis.documents:
                result = EnrichedGroup(pages=group.pages)
                group_started = perf_counter()
                try:
                    text = "\n\n".join(content.pages[page - 1] for page in group.pages)
                    result.result = await inference.enrich(text, catalog)
                except Exception as error:
                    result.error = f"{type(error).__name__}: {error}"
                result.seconds = perf_counter() - group_started
                prediction.enriched.append(result)
                save(result_path, prediction)
            prediction.seconds[phase] = perf_counter() - stage_started
        except Exception as error:
            prediction.seconds[phase] = perf_counter() - stage_started
            prediction.error = f"{phase}: {type(error).__name__}: {error}"
        prediction.seconds["total"] = perf_counter() - started
        save(result_path, prediction)
        print(
            f"{sample.id}: {prediction.seconds['total']:.1f}s {prediction.error or 'done'}",
            flush=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--pdfs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--settings", type=Path, required=True)
    args = parser.parse_args()

    # Validate the CLI namespace at its boundary; argparse does not expose typed fields.
    class Arguments(Record):
        labels: Path
        pdfs: Path
        output: Path
        settings: Path

    options = Arguments.model_validate(vars(args))
    settings = InferenceSettings.model_validate_json(options.settings.read_text())
    asyncio.run(evaluate(options.labels, options.pdfs, options.output, settings))


if __name__ == "__main__":
    main()
