# RECAP Extractor

Local pipeline that searches CourtListener/RECAP for legal documents, downloads them, and extracts structured legal data using AI (DeepSeek V4 Flash via OpenRouter).

## Quick Start

```bash
# 1. Install
npm install

# 2. Set up credentials
cp .env.example .env
# Edit .env: add your CourtListener API token and OpenRouter API key

# 3. Run tests
npm test

# 4. Start the API server
npm start
```

## How It Works

```
Search Terms → CourtListener RECAP API → Queue → 
Fetch PDF/Text → OCR Triage → Qwen-VL (if needed) →
Legal Annotation → DeepSeek V4 Extraction → Manifest → 
Local Folder
```

The pipeline takes search terms, finds matching RECAP documents, processes them one at a time, and saves everything into organized local folders with extracted legal JSON.

## API

Start the server, then:

```bash
# Create an import job
curl -X POST http://localhost:3000/api/recap-import/jobs \
  -H "Content-Type: application/json" \
  -d '{"searchTerms": "medical malpractice motion to compel", "targetCount": 10}'

# Check status
curl http://localhost:3000/api/recap-import/jobs/{jobId}

# Process next document
curl -X POST http://localhost:3000/api/recap-import/jobs/{jobId}/process
```

Output is saved to `./data/recap-imports/{case-name}__{court}__docket-{id}/`.

## Architecture

See [projectplan/doc.md](projectplan/doc.md) for the full architecture contract.

### Agents

| Agent | Job |
|---|---|
| `recapSearch` | Searches CourtListener RECAP API |
| `queue` | Manages job queue (one doc at a time) |
| `metadata` | Normalizes source metadata |
| `caseFolder` | Creates safe local folder paths |
| `fetch` | Downloads PDFs and plain text |
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

104 tests across 22 test files covering all agents, clients, services, routes, and integration.

## Requirements

- Node.js 20+
- CourtListener API token (free: https://www.courtlistener.com/api/rest/v4/)
- OpenRouter API key with credits (https://openrouter.ai)
