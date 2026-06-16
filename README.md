# RECAP Extractor

Local pipeline that searches CourtListener/RECAP for legal documents, downloads them, and extracts structured legal data using AI (DeepSeek V4 Flash via OpenRouter).

## Quick Start

```bash
cp .env.example .env            # add OPENROUTER_API_KEY
npm install
npx playwright install chromium
npm run crawler
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run all 150 tests |
| `npm start` | Start the API server |
| `npm run recap-pipeline` | RECAP API pipeline — search, download PDFs, extract legal JSON |
| `npm run crawler` | Playwright browser crawl — navigate public CourtListener pages, cache HTML, no API |

### RECAP Pipeline

Searches the CourtListener **API** for RECAP documents, downloads PDFs/plain text, and extracts structured legal JSON via DeepSeek.

```bash
npm run recap-pipeline                    # "motion to compel", 10 docs
npm run recap-pipeline -- "discovery" 3   # custom search, 3 docs
```

Output shows each document's **extraction source**:

| Source | Meaning |
|---|---|
| `courtlistener_plain_text` | CourtListener provided full document text |
| `pdf_embedded_text` | Text extracted from downloaded PDF |
| `qwen_vl_ocr` | OCR via Qwen-VL from page images |
| `metadata_only` | No body text available — metadata/description only |

If all documents show `metadata_only`, the pipeline found RECAP documents but none had downloadable body text (PACER-only docs).

### Crawler Demo

Launches a browser to navigate public CourtListener **web pages**, caches HTML locally, and extracts page metadata. No API calls, no PDF downloads. Bounded to 20 pages max, polite 10-20s delay between pages.

Requires Playwright with Chromium installed:

```bash
npx playwright install chromium
```

```bash
npm run crawler                           # "motion to compel", 20 pages
npm run crawler -- --query="discovery"    # custom query
```

Output lands in `data/crawler-demo/run-{timestamp}/`:

## How It Works

```
Search Terms → CourtListener RECAP type=rd → available doc gate →
Fetch PDF/plain_text → choose best body source → embedded PDF text extraction →
PDF-to-image rendering → Qwen-VL OCR → legal annotation →
DeepSeek legal extraction → confidence cap if metadata-only → review flags → manifest
```

The pipeline takes search terms, finds matching RECAP **documents** (not just cases), only enqueues those with available PDFs or text, selects the best body source, extracts structured legal JSON, and caps confidence when only metadata is available.

## API

```bash
# Create an import job
curl -X POST http://localhost:3000/api/recap-import/jobs \
  -H "Content-Type: application/json" \
  -d '{"searchTerms": "motion to compel", "targetCount": 10}'

# Check status
curl http://localhost:3000/api/recap-import/jobs/job_1

# Process next document
curl -X POST http://localhost:3000/api/recap-import/jobs/job_1/process
```

## Architecture

See [projectplan/doc.md](projectplan/doc.md) for the full architecture contract.

### Agents

| Agent | Job |
|---|---|
| `recapSearch` | Searches CourtListener RECAP API (`type=rd`) |
| `queue` | Manages job queue (one doc at a time) |
| `metadata` | Normalizes source metadata |
| `caseFolder` | Creates safe local folder paths |
| `fetch` | Downloads PDFs and plain text |
| `documentBodyProcessing` | Selects best body source |
| `textTriage` | Decides if OCR/vision is needed |
| `documentVisionParser` | Qwen-VL page parsing via OpenRouter |
| `reviewFlag` | Flags issues needing human review |
| `legalAnnotation` | Annotates legal entities from text |
| `legalExtraction` | Extracts structured legal JSON via DeepSeek |
| `manifest` | Writes traceability manifests |

## Output Structure

```
data/recap-imports/
  {case-name}__{court}__docket-{id}/
    case_manifest.json
    documents/
      doc-001-{description}/
        source/
          source.pdf               # downloaded PDF (if available)
          source_metadata.json
        parsed/
          parsed.md
          parsed_pages.json
          layout_summary.json
          extraction_source.json   # body source used for extraction
        review/
          review_flags.json
        extracted/
          legal_annotations.json
          extracted_legal.json     # structured legal JSON
        manifest/
          document_manifest.json
```

## Tests

```bash
npm test            # run all tests
npm run test:watch  # watch mode
```

127 tests across 30 test files covering all agents, clients, services, routes, and integration.

## Requirements

- Node.js 20+
- CourtListener API token (free: https://www.courtlistener.com/api/rest/v4/)
- OpenRouter API key with credits (https://openrouter.ai)
