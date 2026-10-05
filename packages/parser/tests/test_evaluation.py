from pathlib import Path

from pydantic import JsonValue, TypeAdapter

from paperman_parser.models import Analysis, DocumentProposal, Enrichment
from scripts.evaluate import EnrichedGroup, GroundTruth, Prediction, save
from scripts.score import score


def test_scores_include_missing_results_and_detect_false_boundaries(
    tmp_path: Path,
) -> None:
    labels = Path(__file__).resolve().parents[1] / "test-data" / "public-pdfs"
    truth = GroundTruth.model_validate_json((labels / "ground-truth.json").read_text())
    sample = truth.documents[0]
    expected = sample.expected[0]
    prediction = Prediction(
        id=sample.id,
        source_sha256=sample.sha256,
        ocr_languages=sample.ocr_languages,
        pages=[(labels / page.transcript).read_text() for page in sample.pages],
        analysis=Analysis(
            documents=[
                DocumentProposal(
                    pages=expected.pages,
                    owner_id=expected.owner_id,
                    title=expected.title_any[0],
                    document_date=expected.document_date,
                    confidence=1,
                )
            ]
        ),
        enriched=[
            EnrichedGroup(
                pages=expected.pages,
                result=Enrichment(
                    tag_ids=expected.required_tags, summary="Evaluation result"
                ),
            )
        ],
    )
    save(tmp_path / "01.json", prediction)
    score(labels, tmp_path)
    result = TypeAdapter(dict[str, JsonValue]).validate_json(
        (tmp_path / "scores.json").read_text()
    )
    fields = result["fields"]
    assert isinstance(fields, dict)
    assert fields["groups"] == {"correct": 1, "total": 13, "rate": 1 / 13}
    assert fields["owner"] == {"correct": 1, "total": 13, "rate": 1 / 13}
    assert result["boundaries"] == {
        "true_positive": 0,
        "false_positive": 0,
        "false_negative": 5,
    }
    failures = result["failures"]
    assert isinstance(failures, list) and len(failures) == 7

    # A correct field on the wrong group must not count as a correct document.
    first = prediction.analysis
    assert first is not None
    first.documents[0].pages = [1]
    first.documents.append(first.documents[0].model_copy(update={"pages": [2]}))
    save(tmp_path / "01.json", prediction)
    score(labels, tmp_path)
    result = TypeAdapter(dict[str, JsonValue]).validate_json(
        (tmp_path / "scores.json").read_text()
    )
    fields = result["fields"]
    assert isinstance(fields, dict)
    assert fields["owner"] == {"correct": 0, "total": 13, "rate": 0}
    assert result["boundaries"] == {
        "true_positive": 0,
        "false_positive": 1,
        "false_negative": 5,
    }
