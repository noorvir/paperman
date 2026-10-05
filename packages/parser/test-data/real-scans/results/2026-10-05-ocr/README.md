# OCR eval — 5 October 2026

Ten real source documents, 15 pages. References are Sol Markdown drafts accepted
by the user after review. All saved text edits and written notes were applied,
including the struck-through amount on document 01, page 3. The 22 review
decisions remain recorded. Original field labels and earlier model scores are
unchanged. No new AI model calls were made for this OCR run.

## Results

| Pages | Character error rate | Word error rate | Word coverage |
| --- | ---: | ---: | ---: |
| All 15 | 38.2% | 57.8% | 61.7% |
| Six with new OCR | 21.4% | 42.3% | 63.9% |
| Nine with existing text | 42.4% | 61.4% | 61.2% |

Lower error rates are better. Coverage counts matching words without regard to
order. This is not a measure of document classification or splitting.

The production pipeline completed without errors. All output PDFs preserve page
counts, and all 15 pages have extractable text. OCRmyPDF 17.13.0 and Tesseract
5.5.3 ran with English for the forms and Portuguese for the receipts. The run took
about 11 seconds. Production `--skip-text` kept the nine existing PDF text layers;
only the six image-only pages received new OCR.

## Score limits

- References follow document block order, with tables read row by row. Markdown
  syntax is removed. Printed characters in struck-through text remain included.
- The existing scorer normalises Unicode, case, quotes, dashes, and whitespace.
  It uses character and word edit distance. Reading-order and word-spacing
  differences count as errors.
- The user accepted Sol drafts with corrections. This was not an independent
  double transcription. Unreadable regions are recorded; editorial markers are
  omitted, but corresponding output regions are not spatially masked. Scores
  are therefore diagnostic, not a clean estimate of character recognition alone.
- Extractable text was verified. Text-layer position, table structure, and blank
  pages were not scored. No input page is blank.

The current OCR output is not yet good enough for reliable unattended search on
this set. The retained text layers also need attention. Do not interpret the
smarter models' good field scores as evidence that the OCR text is equally good.

## Evidence

[ocr-scores.json](ocr-scores.json) has per-page counts and reference hashes.
[run.json](run.json) records tool versions and OCR settings evidence.
[ground-truth.sha256.json](ground-truth.sha256.json) identifies the accepted
reference files. Full text and source content remain outside Git:

- Accepted dataset: `.cache/real-scans/reviewed/2026-10-05/`
- Original Sol drafts and review captures: `.cache/real-scans/transcripts/2026-10-05-sol/`
- Searchable PDFs, predictions, and layer checks: `.cache/real-scans/runs/2026-10-05-ocr-reviewed/`
