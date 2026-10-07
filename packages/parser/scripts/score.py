"""Score a saved evaluation; no model calls and no changes to the labels."""

import argparse
import json
import re
import unicodedata
from collections import Counter
from collections.abc import Sequence
from pathlib import Path

from paperman_parser.models import Record
from scripts.evaluate import GroundTruth, Prediction


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    text = text.translate(str.maketrans("‘’“”–—", "''\"\"--"))
    text = re.sub(r"[•●▪■]", " ", text)
    return " ".join(text.split())


def distance(expected: Sequence[str], actual: Sequence[str]) -> int:
    """Levenshtein edit count, with common prefix/suffix removed for speed."""
    start = 0
    stop = min(len(expected), len(actual))
    while start < stop and expected[start] == actual[start]:
        start += 1
    expected = expected[start:]
    actual = actual[start:]
    end = 0
    stop = min(len(expected), len(actual))
    while end < stop and expected[-end - 1] == actual[-end - 1]:
        end += 1
    if end:
        expected = expected[:-end]
        actual = actual[:-end]
    if len(expected) < len(actual):
        expected, actual = actual, expected
    row = list(range(len(actual) + 1))
    for i, left in enumerate(expected, 1):
        following = [i]
        for j, right in enumerate(actual, 1):
            following.append(
                min(following[-1] + 1, row[j] + 1, row[j - 1] + (left != right))
            )
        row = following
    return row[-1]


class Count(Record):
    correct: int = 0
    total: int = 0

    @property
    def rate(self) -> float | None:
        return self.correct / self.total if self.total else None


class Detection(Record):
    true_positive: int = 0
    false_positive: int = 0
    false_negative: int = 0

    def add(self, expected: set[str], actual: set[str]) -> None:
        self.true_positive += len(expected & actual)
        self.false_positive += len(actual - expected)
        self.false_negative += len(expected - actual)


class TextScore(Record):
    characters: int = 0
    character_errors: int = 0
    words: int = 0
    word_errors: int = 0
    actual_words: int = 0
    matching_words: int = 0

    def add(self, expected: str, actual: str) -> None:
        reference, result = normalize(expected), normalize(actual)
        reference_words, result_words = reference.split(), result.split()
        self.characters += len(reference)
        self.character_errors += distance(reference, result)
        self.words += len(reference_words)
        self.word_errors += distance(reference_words, result_words)
        self.actual_words += len(result_words)
        self.matching_words += sum(
            (Counter(reference_words) & Counter(result_words)).values()
        )


def score(labels: Path, run: Path) -> None:
    truth = GroundTruth.model_validate_json((labels / "ground-truth.json").read_text())
    fields = {
        name: Count()
        for name in ("packets", "groups", "owner", "date", "title_keywords")
    }
    boundaries, tags = Detection(), Detection()
    text_scores = {"all": TextScore()}
    sample_results: list[dict[str, object]] = []
    failures: list[str] = []

    for sample in truth.documents:
        path = run / f"{sample.id}.json"
        prediction = Prediction(
            id=sample.id,
            source_sha256=sample.sha256,
            ocr_languages=sample.ocr_languages,
            error="Missing result",
        )
        if path.exists():
            prediction = Prediction.model_validate_json(path.read_text())
        if prediction.source_sha256 != sample.sha256:
            raise ValueError(f"Wrong source hash for {sample.id}")
        if prediction.error:
            failures.append(f"{sample.id}: {prediction.error}")
        for group in prediction.enriched:
            if group.error:
                failures.append(f"{sample.id} {group.pages}: {group.error}")

        actual = prediction.analysis.documents if prediction.analysis else []
        expected_groups = [item.pages for item in sample.expected]
        actual_groups = [item.pages for item in actual]
        if sample.complete_documents:
            fields["packets"].total += 1
            fields["packets"].correct += expected_groups == actual_groups
            boundaries.add(
                {str(item.pages[0]) for item in sample.expected[1:]},
                {str(item.pages[0]) for item in actual[1:]},
            )
        group_results: list[dict[str, object]] = []
        for expected in sample.expected:
            matched = next(
                (item for item in actual if item.pages == expected.pages), None
            )
            enrichment = next(
                (
                    item.result
                    for item in prediction.enriched
                    if item.pages == expected.pages
                ),
                None,
            )
            checks = {
                "groups": matched is not None,
                "owner": matched is not None
                and matched.owner_ids == expected.owner_ids,
                "date": matched is not None
                and matched.document_date == expected.document_date,
                "title_keywords": matched is not None
                and any(
                    word in normalize(matched.title) for word in expected.title_any
                ),
            }
            for name, correct in checks.items():
                if name == "groups" and not sample.complete_documents:
                    continue
                fields[name].total += 1
                fields[name].correct += correct
            actual_tags: set[str] = set(enrichment.tag_ids) if enrichment else set()
            tags.add(
                set(expected.required_tags), actual_tags - set(expected.optional_tags)
            )
            group_results.append(
                {
                    "pages": expected.pages,
                    "checks": checks,
                    "expected_owner": expected.owner_ids,
                    "actual_owner": matched.owner_ids if matched else None,
                    "expected_date": str(expected.document_date),
                    "actual_date": str(matched.document_date) if matched else None,
                    "expected_tags": expected.required_tags,
                    "actual_tags": sorted(actual_tags),
                }
            )
        for enrichment in prediction.enriched:
            if enrichment.pages not in expected_groups and enrichment.result:
                tags.false_positive += len(set(enrichment.result.tag_ids))

        for page in sample.pages:
            actual_text = (
                prediction.pages[page.page - 1]
                if page.page <= len(prediction.pages)
                else ""
            )
            text_scores["all"].add((labels / page.transcript).read_text(), actual_text)
        sample_results.append(
            {"id": sample.id, "groups": group_results, "seconds": prediction.seconds}
        )

    result = {
        "fields": {
            name: {**value.model_dump(), "rate": value.rate}
            for name, value in fields.items()
        },
        "boundaries": boundaries.model_dump(),
        "tags": tags.model_dump(),
        "text": {
            kind: {
                **value.model_dump(),
                "cer": value.character_errors / value.characters
                if value.characters
                else None,
                "wer": value.word_errors / value.words if value.words else None,
                "word_coverage": value.matching_words / value.words
                if value.words
                else None,
            }
            for kind, value in text_scores.items()
        },
        "failures": failures,
        "samples": sample_results,
        "policy": "All expected documents remain in the field denominator, including failures. Incomplete source excerpts are excluded from packet, group and boundary scores. OCR is unscored when transcripts are absent. Field scores require an exact page-group match. Title is a frozen keyword rubric, not a semantic quality score. CER/WER include reading-order errors; word coverage ignores order. NFKC, case, curly quotes, dash and whitespace normalization; decorative bullets ignored. Optional tags count neither for nor against the score. No human label review; no held-out set.",
    }
    (run / "scores.json").write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {key: value for key, value in result.items() if key != "samples"}, indent=2
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)

    class Arguments(Record):
        labels: Path
        run: Path

    options = Arguments.model_validate(vars(parser.parse_args()))
    score(options.labels, options.run)
