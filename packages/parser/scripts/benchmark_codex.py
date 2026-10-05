"""Compare Codex models using rendered PDF pages and the parser's existing model prompts."""

import argparse
import asyncio
import json
import os
import subprocess
from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Catalog,
    InferenceSettings,
    ProcessingStage,
    ProcessingUsage,
    Record,
)
from paperman_parser.pdf import select_pages
from paperman_parser.prompt import Prompt
from scripts.evaluate import (
    EnrichedGroup,
    FrozenFiles,
    GroundTruth,
    Prediction,
    digest,
    save,
)
from scripts.score import score


class RecordedEndpointInference(EndpointInference):
    def __init__(
        self,
        settings: InferenceSettings,
        output: Path,
        api_key: str,
        image_max_edge: int | None = None,
        record_usage: Callable[[ProcessingUsage], None] | None = None,
    ) -> None:
        super().__init__(settings, api_key, record_usage)
        self.output = output
        self.request_count = 0
        self.image_max_edge = image_max_edge

    async def _request[T: BaseModel](
        self,
        output: type[T],
        prompt: Prompt,
        validate: Callable[[T], None] | None = None,
        *,
        stage: ProcessingStage,
        source_pages: list[int],
    ) -> T:
        if self.image_max_edge is not None:
            images: list[bytes] = []
            for content in prompt.images:
                with Image.open(BytesIO(content)) as page:
                    page.thumbnail(
                        (self.image_max_edge, self.image_max_edge),
                        resample=Image.Resampling.LANCZOS,
                    )
                    buffer = BytesIO()
                    page.save(buffer, format="PNG")
                    images.append(buffer.getvalue())
            prompt = replace(prompt, images=images)
        self.request_count += 1
        request = self.output / f"{self.request_count:02}-{output.__name__}"
        request.mkdir(parents=True)
        (request / "instructions.txt").write_text(prompt.instructions + "\n")
        (request / "prompt.txt").write_text(prompt.text + "\n")
        (request / "schema.json").write_text(
            json.dumps(output.model_json_schema(mode="serialization"), indent=2) + "\n"
        )
        hashes = {}
        for number, content in enumerate(prompt.images, 1):
            path = request / f"page-{number:04}.png"
            path.write_bytes(content)
            hashes[path.name] = digest(path)
        (request / "images.json").write_text(json.dumps(hashes, indent=2) + "\n")
        try:
            result = await super()._request(
                output, prompt, validate, stage=stage, source_pages=source_pages
            )
        except Exception as error:
            (request / "error.txt").write_text(f"{type(error).__name__}: {error}\n")
            raise
        (request / "response.json").write_text(result.model_dump_json(indent=2) + "\n")
        return result


class CodexInference(EndpointInference):
    """Replace model transport only; inherit the production prompts and stages."""

    def __init__(self, model: str, output: Path) -> None:
        super().__init__(InferenceSettings(model=model, reasoning_effort="high"), "")
        self.output = output
        self.request_count = 0

    async def _request[T: BaseModel](
        self,
        output: type[T],
        prompt: Prompt,
        validate: Callable[[T], None] | None = None,
        *,
        stage: ProcessingStage,
        source_pages: list[int],
    ) -> T:
        self.request_count += 1
        request = self.output / f"{self.request_count:02}-{output.__name__}"
        request.mkdir(parents=True)
        schema = output.model_json_schema(mode="serialization")
        (request / "schema.json").write_text(json.dumps(schema, indent=2) + "\n")
        (request / "instructions.txt").write_text(prompt.instructions + "\n")
        (request / "prompt.txt").write_text(prompt.text + "\n")
        images: list[Path] = []
        for number, image in enumerate(prompt.images, 1):
            path = request / f"page-{number:04}.png"
            path.write_bytes(image)
            images.append(path)
        (request / "images.json").write_text(
            json.dumps({path.name: digest(path) for path in images}, indent=2) + "\n"
        )
        # The client owns authentication. Never read or copy its stored credentials.
        environment = os.environ.copy()
        environment.pop("OPENAI_API_KEY", None)
        environment.pop("CODEX_API_KEY", None)
        feedback = ""
        for attempt in range(3):
            with TemporaryDirectory(prefix="paperman-inference-") as workspace:
                result_path = request / f"response-{attempt}.json"
                command = [
                    "codex",
                    "exec",
                    "--ignore-user-config",
                    "--ephemeral",
                    "--skip-git-repo-check",
                    "-C",
                    workspace,
                    "-s",
                    "read-only",
                    "-m",
                    self.settings.model,
                    "-c",
                    'forced_login_method="chatgpt"',
                    "-c",
                    'model_reasoning_effort="high"',
                    "-c",
                    'web_search="disabled"',
                    "-c",
                    "project_doc_max_bytes=0",
                    "-c",
                    "features.shell_tool=false",
                    "-c",
                    "features.apps=false",
                    "-c",
                    "features.multi_agent=false",
                    "-c",
                    "features.hooks=false",
                    "-c",
                    "features.skip_host_skill_discovery=true",
                    "-c",
                    "suppress_unstable_features_warning=true",
                    "-c",
                    f"model_instructions_file={json.dumps(str(request / 'instructions.txt'))}",
                    "--output-schema",
                    str(request / "schema.json"),
                    "--json",
                    "-o",
                    str(result_path),
                ]
                for image in images:
                    command.extend(["--image", str(image)])
                command.extend(["--", "-"])
                process = await asyncio.create_subprocess_exec(
                    *command,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=environment,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate((prompt.text + feedback).encode()),
                        timeout=300,
                    )
                except TimeoutError:
                    process.kill()
                    await process.communicate()
                    raise ValueError(
                        "Codex request timed out after 300 seconds"
                    ) from None
                (request / f"events-{attempt}.jsonl").write_bytes(stdout)
                (request / f"stderr-{attempt}.txt").write_bytes(stderr)
                if process.returncode:
                    raise ValueError(
                        f"Codex exited with {process.returncode}; see request logs"
                    )
                for line in stdout.splitlines():
                    event = Event.model_validate_json(line)
                    if event.item and event.item.type not in (
                        "agent_message",
                        "reasoning",
                        "error",
                    ):
                        raise ValueError(f"Unexpected model item: {event.item.type}")
                try:
                    result = output.model_validate_json(result_path.read_text())
                    if validate is not None:
                        validate(result)
                    return result
                except ValueError as error:
                    if attempt == 2:
                        raise
                    feedback = f"\nThe previous response failed validation: {error}. Return a corrected response."
        raise RuntimeError("Model request did not complete")


class EventItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str


class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item: EventItem | None = None


async def benchmark(
    labels: Path,
    source: Path | None,
    pdfs: Path,
    output: Path,
    model: str,
    settings: InferenceSettings | None = None,
    api_key: str = "local",
    image_max_edge: int | None = None,
) -> None:
    if image_max_edge is not None and settings is None:
        raise ValueError("--image-max-edge requires --settings")
    frozen = FrozenFiles.model_validate_json(
        (labels / "ground-truth.sha256.json").read_text()
    )
    for filename, expected in frozen.files.items():
        if digest(labels / filename) != expected:
            raise ValueError(f"Frozen annotation changed: {filename}")
    catalog = Catalog.model_validate_json((labels / "catalog.json").read_text())
    truth = GroundTruth.model_validate_json((labels / "ground-truth.json").read_text())
    sources: list[Prediction] = []
    for sample in truth.documents:
        cached = Prediction(
            id=sample.id,
            source_sha256=sample.sha256,
            ocr_languages=sample.ocr_languages,
        )
        if source is not None:
            cached = Prediction.model_validate_json(
                (source / f"{sample.id}.json").read_text()
            )
        if (
            cached.source_sha256 != sample.sha256
            or digest(pdfs / f"{sample.id}.pdf") != sample.sha256
        ):
            raise ValueError(f"Source PDF changed: {sample.id}")
        sources.append(cached)
    output.mkdir(parents=True, exist_ok=False)
    package = Path(__file__).resolve().parents[1]
    metadata = {
        "started_at": datetime.now(UTC).isoformat(),
        "model": model,
        "settings": settings.model_dump(mode="json")
        if settings
        else {"reasoning_effort": "high"},
        "transport": "compatible endpoint" if settings else "codex exec",
        "auth": "endpoint credential supplied by caller"
        if settings
        else "existing ChatGPT login; no API key",
        "codex_version": subprocess.check_output(
            ["codex", "--version"], text=True
        ).strip(),
        "source_run": str(source) if source is not None else None,
        "ocr": "cached" if source is not None else "not run; inference-only eval",
        "model_input": "rendered PDF page images only",
        "image_max_edge": image_max_edge or 1600,
        "pdf_sha256": {f"{sample.id}.pdf": sample.source_sha256 for sample in sources},
        "source_sha256": {
            f"{sample.id}.json": digest(source / f"{sample.id}.json")
            for sample in sources
        }
        if source
        else {},
        "frozen_sha256": digest(labels / "ground-truth.sha256.json"),
        "annotations": frozen.model_dump(mode="json"),
        "poppler": subprocess.check_output(
            ["pdftoppm", "-v"], stderr=subprocess.STDOUT, text=True
        ).strip(),
        "parser_sha256": {
            str(path.relative_to(package)): digest(path)
            for path in sorted((package / "paperman_parser").rglob("*.py"))
        },
        "runner_sha256": digest(Path(__file__)),
        "scorer_sha256": digest(package / "scripts/score.py"),
        "notes": "Render source PDFs. Cached OCR is used only for scoring, never as model input. No previous model output or labels are sent. Same production stage prompts. No tools, repository access, or answer labels in model input. Temperature uses Codex default or zero for compatible endpoints. Up to two schema/domain validation retries. Four independent PDFs at a time for Codex; one at a time for compatible endpoints.",
    }
    (output / "run.json").write_text(json.dumps(metadata, indent=2) + "\n")
    semaphore = asyncio.Semaphore(1 if settings else 4)

    async def run_sample(cached: Prediction) -> None:
        async with semaphore:
            prediction = Prediction(
                id=cached.id,
                source_sha256=cached.source_sha256,
                ocr_languages=cached.ocr_languages,
                pages=cached.pages,
            )
            request_path = output / "requests" / cached.id
            page_map: list[int] = []

            def record_usage(call: ProcessingUsage) -> None:
                if call.stage == "tagging":
                    call.source_pages = [
                        page_map[number - 1] for number in call.source_pages
                    ]
                prediction.processing.append(call)
                save(output / f"{cached.id}.json", prediction)

            inference = (
                RecordedEndpointInference(
                    settings, request_path, api_key, image_max_edge, record_usage
                )
                if settings
                else CodexInference(model, request_path)
            )
            started = perf_counter()
            print(f"{cached.id}: starting", flush=True)
            try:
                pdf = (pdfs / f"{cached.id}.pdf").read_bytes()
                prediction.analysis = await inference.analyze(pdf, catalog)
                prediction.seconds["analyze"] = perf_counter() - started
                save(output / f"{cached.id}.json", prediction)
                for group in prediction.analysis.documents:
                    page_map = group.pages
                    group_started = perf_counter()
                    document = await asyncio.to_thread(select_pages, pdf, group.pages)
                    enrichment = EnrichedGroup(pages=group.pages)
                    try:
                        enrichment.result = await inference.enrich(document, catalog)
                    except Exception as error:
                        enrichment.error = f"{type(error).__name__}: {error}"
                    enrichment.seconds = perf_counter() - group_started
                    prediction.enriched.append(enrichment)
                    save(output / f"{cached.id}.json", prediction)
            except Exception as error:
                prediction.error = f"{type(error).__name__}: {error}"
            prediction.seconds["total"] = perf_counter() - started
            save(output / f"{cached.id}.json", prediction)
            print(
                f"{cached.id}: {prediction.seconds['total']:.1f}s {prediction.error or 'done'}",
                flush=True,
            )

    await asyncio.gather(*(run_sample(path) for path in sources))
    score(labels, output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--pdfs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--image-max-edge",
        type=int,
        help="Resize endpoint eval images to this longest edge; keep aspect ratio",
    )
    transport = parser.add_mutually_exclusive_group(required=True)
    transport.add_argument("--model", choices=["gpt-6-luna", "gpt-6-sol"])
    transport.add_argument("--settings", type=Path)

    class Arguments(Record):
        labels: Path
        source: Path | None
        pdfs: Path
        output: Path
        model: str | None
        settings: Path | None
        image_max_edge: int | None = Field(default=None, gt=0, le=1600)

    args = Arguments.model_validate(vars(parser.parse_args()))
    settings = (
        InferenceSettings.model_validate_json(args.settings.read_text())
        if args.settings
        else None
    )
    asyncio.run(
        benchmark(
            args.labels.resolve(),
            args.source.resolve() if args.source else None,
            args.pdfs.resolve(),
            args.output.resolve(),
            settings.model if settings else args.model or "",
            settings,
            os.environ.get("PAPERMAN_MODEL_API_KEY", "local"),
            args.image_max_edge,
        )
    )
