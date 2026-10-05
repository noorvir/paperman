"""Create image-based Markdown transcript drafts without changing eval labels."""

import argparse
import asyncio
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from pydantic import Field

from paperman_parser.models import Record
from paperman_parser.pdf import render_pdf
from paperman_parser.prompt.transcribe import transcribe
from scripts.benchmark_codex import CodexInference
from scripts.evaluate import digest, save


class Transcript(Record):
    markdown: str = Field(min_length=1)
    uncertainties: list[str]


class CodexTranscriber(CodexInference):
    async def transcribe(self, source: bytes) -> list[Transcript]:
        images = await asyncio.to_thread(render_pdf, source)
        pages: list[Transcript] = []
        for number, image in enumerate(images, 1):
            print(f"{self.output.parent.name}: page {number}/{len(images)}", flush=True)
            result = await self._request(
                Transcript, transcribe(image, number, len(images))
            )
            save(self.output.parent / f"page-{number:04}.json", result)
            pages.append(result)
        return pages


async def run(sources: list[Path], output: Path, model: str) -> None:
    if len({source.stem for source in sources}) != len(sources):
        raise ValueError("Input filenames must have unique stems")
    for source in sources:
        if not source.is_file():
            raise ValueError(f"Input PDF not found: {source}")
    output.mkdir(parents=True, exist_ok=False)
    package = Path(__file__).resolve().parents[1]
    prompt_file = package / "paperman_parser" / "prompt" / "transcribe.py"
    metadata = {
        "started_at": datetime.now(UTC).isoformat(),
        "model": model,
        "reasoning_effort": "high",
        "status": "model-generated drafts; not verified OCR ground truth",
        "input": "one rendered page image per request; no OCR text or field labels",
        "rendering": "Poppler; longest edge 2400 pixels",
        "prompt_sha256": digest(prompt_file),
        "runner_sha256": digest(Path(__file__)),
        "transport_sha256": digest(package / "scripts" / "benchmark_codex.py"),
        "revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=package, text=True
        ).strip(),
        "sources": {source.name: digest(source) for source in sources},
    }
    (output / "run.json").write_text(json.dumps(metadata, indent=2) + "\n")
    # The recorded prompt and runner make an uncommitted run reproducible.
    (output / "prompt.py").write_bytes(prompt_file.read_bytes())
    (output / "runner.py").write_bytes(Path(__file__).read_bytes())
    (output / "transport.py").write_bytes(
        (package / "scripts" / "benchmark_codex.py").read_bytes()
    )
    limit = asyncio.Semaphore(3)

    async def document(source: Path) -> str | None:
        async with limit:
            directory = output / source.stem
            directory.mkdir()
            try:
                inference = CodexTranscriber(model, directory / "requests")
                pages = await inference.transcribe(source.read_bytes())
                markdown = "\n\n---\n\n".join(
                    f"<!-- Source page {number} -->\n\n{page.markdown.strip()}"
                    for number, page in enumerate(pages, 1)
                )
                (output / f"{source.stem}.md").write_text(markdown + "\n")
                print(f"{source.stem}: saved {len(pages)} pages", flush=True)
                return None
            except Exception as error:
                message = f"{source.name}: {type(error).__name__}: {error}"
                (directory / "error.txt").write_text(message + "\n")
                print(message, flush=True)
                return message

    results = await asyncio.gather(*(document(source) for source in sources))
    failures = [result for result in results if result is not None]
    completed = {
        **metadata,
        "completed_at": datetime.now(UTC).isoformat(),
        "failures": failures,
    }
    (output / "run.json").write_text(json.dumps(completed, indent=2) + "\n")
    if failures:
        raise ValueError(f"{len(failures)} transcripts failed; see saved error files")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", required=True)

    class Arguments(Record):
        pdfs: list[Path]
        output: Path
        model: str

    args = Arguments.model_validate(vars(parser.parse_args()))
    asyncio.run(
        run(
            [path.resolve() for path in args.pdfs],
            args.output.resolve(),
            args.model,
        )
    )


if __name__ == "__main__":
    main()
