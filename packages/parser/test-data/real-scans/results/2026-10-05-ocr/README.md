# OCR results — 5 October 2026

Ten documents, 15 pages. References are reviewed Sol drafts with corrections, not independent double transcriptions.

| Pages                   | Character error rate | Word error rate | Word coverage |
| ----------------------- | -------------------: | --------------: | ------------: |
| All 15                  |                38.2% |           57.8% |         61.7% |
| Six with new OCR        |                21.4% |           42.3% |         63.9% |
| Nine with existing text |                42.4% |           61.4% |         61.2% |

OCRmyPDF 17.13.0 and Tesseract 5.5.3 used English for forms and Portuguese for receipts. Processing took about 11 seconds. All pages retained their page count and had extractable text. Existing text layers were preserved; only six image pages received new OCR.

Error rates include reading-order and spacing differences. Coverage ignores word order. Unreadable regions are recorded but not spatially masked in scoring. These scores do not measure text-layer alignment, table structure, splitting, or blank-page detection.

[ocr-scores.json](ocr-scores.json) contains per-page results. [run.json](run.json) records tool versions; [ground-truth.sha256.json](ground-truth.sha256.json) identifies references. Full references and PDFs stay outside Git in `.cache/real-scans/` under the [source datasets' terms](../../README.md#sources).
