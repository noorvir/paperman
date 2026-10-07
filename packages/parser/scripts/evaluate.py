"""Evaluate the standalone parser against frozen, visually reviewed labels."""

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
import subprocess
from datetime import UTC, date, datetime
from functools import partial
from pathlib import Path
from time import perf_counter

from pydantic import Field

from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Analysis,
    Catalog,
    Enrichment,
    InferenceSettings,
    Ownership,
    ProcessingUsage,
    Record,
    validate_analysis,
)
from paperman_parser.ocr import LocalOCR
from paperman_parser.pdf import select_pages


class ExpectedDocument(Ownership):
    pages: list[int]
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
    complete_documents: bool = True


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
    processing: list[ProcessingUsage] = Field(default_factory=list)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path: Path, value: Record) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(value.model_dump_json(indent=2) + "\n")
    temporary.replace(path)


def record_prediction_usage(
    prediction: Prediction,
    path: Path,
    call: ProcessingUsage,
    *,
    page_map: list[int] | None = None,
) -> None:
    if page_map is not None:
        call.source_pages = [page_map[number - 1] for number in call.source_pages]
    prediction.processing.append(call)
    save(path, prediction)


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
        "model_input": "rendered PDF page images only; OCR text retained for scoring",
        "revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=package, text=True
        ).strip(),
        "poppler": subprocess.check_output(
            ["pdftoppm", "-v"], stderr=subprocess.STDOUT, text=True
        ).strip(),
        "parser_sha256": {
            str(path.relative_to(package)): digest(path)
            for path in sorted((package / "paperman_parser").rglob("*.py"))
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
    ocr = LocalOCR()

    for sample in truth.documents:
        prediction = Prediction(
            id=sample.id,
            source_sha256=sample.sha256,
            ocr_languages=sample.ocr_languages,
        )
        result_path = output / f"{sample.id}.json"
        inference = EndpointInference(
            settings,
            os.environ.get("PAPERMAN_MODEL_API_KEY", "local"),
            partial(record_prediction_usage, prediction, result_path),
        )
        started = perf_counter()
        phase = "analyze"
        stage_started = started
        print(f"{sample.id}: split, orientation, and fields", flush=True)
        try:
            source = (pdfs / f"{sample.id}.pdf").read_bytes()
            prediction.analysis = await inference.analyze(source, catalog)
            prediction.seconds[phase] = perf_counter() - stage_started
            save(result_path, prediction)

            phase = "ocr"
            stage_started = perf_counter()
            print(f"{sample.id}: OCR", flush=True)
            content = await asyncio.to_thread(
                ocr.searchable,
                source,
                sample.ocr_languages,
                rotations=prediction.analysis.page_rotations,
            )
            prediction.seconds[phase] = perf_counter() - stage_started
            prediction.pages = content.pages
            validate_analysis(prediction.analysis, len(content.pages), catalog)
            (output / f"{sample.id}.pdf").write_bytes(content.pdf)
            save(result_path, prediction)

            phase = "enrich"
            stage_started = perf_counter()
            for group in prediction.analysis.documents:
                inference.record_usage = partial(
                    record_prediction_usage,
                    prediction,
                    result_path,
                    page_map=group.pages,
                )
                result = EnrichedGroup(pages=group.pages)
                group_started = perf_counter()
                try:
                    document = await asyncio.to_thread(
                        select_pages, content.pdf, group.pages
                    )
                    result.result = await inference.enrich(document, catalog)
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
