# Public PDF test set

Eight unchanged PDFs, 18 pages, 1.07 MB. Downloaded on 2 October 2026.
The files are in [the local cache](../../../../../.cache/public-pdfs/pdfs/).
[manifest.toml](manifest.toml) records source URLs, licences, attributions,
SHA-256 hashes, page counts, text-layer checks, and expected page groups.
The cache is ignored by Git; the manifest and this guide belong in Git.

## Contents

| ID                                                  | Document                                | Pages | What it tests                                           |
| --------------------------------------------------- | --------------------------------------- | ----: | ------------------------------------------------------- |
| [01](../../../../../.cache/public-pdfs/pdfs/01.pdf) | Vendor invoice                          |     2 | Invoice fields and continuation pages                   |
| [02](../../../../../.cache/public-pdfs/pdfs/02.pdf) | Scanned purchase order                  |     1 | Image-only OCR, tables, delivery date versus issue date |
| [03](../../../../../.cache/public-pdfs/pdfs/03.pdf) | Insurance claim packet                  |     9 | Six document groups, including two adjacent invoices    |
| [04](../../../../../.cache/public-pdfs/pdfs/04.pdf) | Sample credit card statement            |     1 | Financial tables and an incomplete date                 |
| [05](../../../../../.cache/public-pdfs/pdfs/05.pdf) | Mortgage statement guide                |     2 | Multiple columns and a sample statement inside a guide  |
| [06](../../../../../.cache/public-pdfs/pdfs/06.pdf) | Wikipedia article from an Epson scanner |     1 | Dense scanned text and a contents box                   |
| [07](../../../../../.cache/public-pdfs/pdfs/07.pdf) | Skewed equipment brochure               |     1 | Small text, bullets, columns, and deskewing             |
| [08](../../../../../.cache/public-pdfs/pdfs/08.pdf) | French text with accents                |     1 | Accents, ligatures, and language selection              |

Files 02, 06, 07, and 08 have no extractable text. The other files contain
selectable text. All 18 pages rendered successfully. The page images and contact
sheets are in `.cache/public-pdfs/previews/`.

## Sources and rights

- **[DocJev](https://github.com/jerryjliu/docjev/tree/c7abe276a970605feb9cb8b27513365b6c10726e/datasets):** 01–03 are fictional examples, including a simulated scan. Content and labels are CC0; fonts and marks have separate rights. The upstream manifest supplies the split labels.
- **[CFPB](https://www.consumerfinance.gov/privacy/website-privacy-policy/#legal-notices):** 04–05 are official educational publications. CFPB-created content is public domain under its published policy; official marks retain protection.
- **[OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF/blob/3f5553cf19e5b10e714667a82a502c3b9c48d144/REUSE.toml):** 06–08 are OCR fixtures. Files 06 and 07 use CC BY-SA 3.0; 08 uses CC BY-SA 4.0. The manifest includes the upstream attributions. Preserve them when sharing files or derivatives.

GitHub URLs use fixed revisions. The source notices and the DocJev manifest are
also cached under `.cache/public-pdfs/source-notes/`. No PDF bytes were changed.
Neutral local filenames avoid giving the model a category through the filename.

## Use in the next test

Use a separate test storage directory. Copy PDFs into its inbox; keep the cache
as the original source. Do not pass expected groups, labels, or this manifest to
the model. To restore a missing cache file, download its `source_url` to its
`file` name and check the recorded SHA-256 before use.

For file 03, the expected page groups are **1–2, 3, 4–5, 6–7, 8, 9**:
claim form, incident report, repair estimate, invoice, invoice, correspondence.
The two invoices must stay separate. The other seven PDFs each form one group.
These are source labels or inspection results, not PaperMan results.

Use test owner names from the documents only when testing a known-owner match.
With the current demo owner names, unfamiliar recipients should remain Unknown.
File 04 uses `XX` for the statement year; do not invent a full date from it.
File 05 is a guide, not a real mortgage bill. File 06 contains only one PDF page,
although its printed footer says “1 of 9”. File 08 needs French (`fra`) OCR data
for a fair Tesseract test.

This is a small test set, not a measure of production accuracy. It mixes public
samples, synthetic documents, and scan fixtures. It does not cover German mail,
handwriting, blank backs, photographs, or real household ownership. The PDFs
have not yet been processed through PaperMan or Gemma 4.
