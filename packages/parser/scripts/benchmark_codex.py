"""Compare Codex models using saved OCR and the parser's existing model prompts."""

import argparse
import asyncio
import json
import os
import subprocess
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter

from pydantic import BaseModel, ConfigDict

from paperman_parser.inference import EndpointInference
from paperman_parser.models import Catalog, InferenceSettings, Record
from scripts.evaluate import EnrichedGroup, FrozenFiles, Prediction, digest, save
from scripts.score import score


class CodexInference(EndpointInference):
    """Replace model transport only; inherit the production prompts and stages."""

    def __init__(self, model: str, output: Path) -> None:
        super().__init__(InferenceSettings(model=model, reasoning_effort="high"), "")
        self.output = output
        self.request_count = 0

    async def _request[T: BaseModel](
        self,
        output: type[T],
        instructions: str,
        prompt: str,
        validate: Callable[[T], None] | None = None,
    ) -> T:
        self.request_count += 1
        request = self.output / f"{self.request_count:02}-{output.__name__}"
        request.mkdir(parents=True)
        schema = output.model_json_schema(mode="serialization")
        (request / "schema.json").write_text(json.dumps(schema, indent=2) + "\n")
        (request / "instructions.txt").write_text(instructions + "\n")
        (request / "prompt.txt").write_text(prompt + "\n")
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
                    "-",
                ]
                process = await asyncio.create_subprocess_exec(
                    *command,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=environment,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate((prompt + feedback).encode()), timeout=300
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


async def benchmark(labels: Path, source: Path, output: Path, model: str) -> None:
    frozen = FrozenFiles.model_validate_json(
        (labels / "ground-truth.sha256.json").read_text()
    )
    for filename, expected in frozen.files.items():
        if digest(labels / filename) != expected:
            raise ValueError(f"Frozen annotation changed: {filename}")
    catalog = Catalog.model_validate_json((labels / "catalog.json").read_text())
    sources = [path for path in sorted(source.glob("*.json")) if path.stem.isdecimal()]
    if not sources:
        raise ValueError("No saved OCR predictions in source directory")
    output.mkdir(parents=True, exist_ok=False)
    package = Path(__file__).resolve().parents[1]
    metadata = {
        "started_at": datetime.now(UTC).isoformat(),
        "model": model,
        "reasoning_effort": "high",
        "transport": "codex exec",
        "auth": "existing ChatGPT login; no API key",
        "codex_version": subprocess.check_output(
            ["codex", "--version"], text=True
        ).strip(),
        "source_run": str(source),
        "source_sha256": {path.name: digest(path) for path in sources},
        "frozen_sha256": digest(labels / "ground-truth.sha256.json"),
        "annotations": frozen.model_dump(mode="json"),
        "parser_sha256": {
            str(path.relative_to(package)): digest(path)
            for path in sorted((package / "paperman_parser").glob("*.py"))
        },
        "runner_sha256": digest(Path(__file__)),
        "scorer_sha256": digest(package / "scripts/score.py"),
        "notes": "Reuse OCR pages only, not previous model output or labels. Same production stage prompts. No tools, repository access, or answer labels in model input. Temperature uses Codex default. Up to two schema/domain validation retries. Four independent PDFs at a time.",
    }
    (output / "run.json").write_text(json.dumps(metadata, indent=2) + "\n")
    semaphore = asyncio.Semaphore(4)

    async def run_sample(path: Path) -> None:
        async with semaphore:
            cached = Prediction.model_validate_json(path.read_text())
            prediction = Prediction(
                id=cached.id,
                source_sha256=cached.source_sha256,
                ocr_languages=cached.ocr_languages,
                pages=cached.pages,
            )
            inference = CodexInference(model, output / "requests" / cached.id)
            started = perf_counter()
            print(f"{cached.id}: starting", flush=True)
            try:
                prediction.analysis = await inference.analyze(prediction.pages, catalog)
                prediction.seconds["analyze"] = perf_counter() - started
                save(output / path.name, prediction)
                for group in prediction.analysis.documents:
                    group_started = perf_counter()
                    text = "\n\n".join(
                        prediction.pages[page - 1] for page in group.pages
                    )
                    enrichment = await inference.enrich(text, catalog)
                    prediction.enriched.append(
                        EnrichedGroup(
                            pages=group.pages,
                            result=enrichment,
                            seconds=perf_counter() - group_started,
                        )
                    )
                    save(output / path.name, prediction)
            except Exception as error:
                prediction.error = f"{type(error).__name__}: {error}"
            prediction.seconds["total"] = perf_counter() - started
            save(output / path.name, prediction)
            print(
                f"{cached.id}: {prediction.seconds['total']:.1f}s {prediction.error or 'done'}",
                flush=True,
            )

    await asyncio.gather(*(run_sample(path) for path in sources))
    score(labels, output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", choices=["gpt-6-luna", "gpt-6-sol"], required=True)

    class Arguments(Record):
        labels: Path
        source: Path
        output: Path
        model: str

    args = Arguments.model_validate(vars(parser.parse_args()))
    asyncio.run(
        benchmark(
            args.labels.resolve(),
            args.source.resolve(),
            args.output.resolve(),
            args.model,
        )
    )
