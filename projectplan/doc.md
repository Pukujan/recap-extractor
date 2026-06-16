# RECAP Local Importer Architecture Contract + Codex/OpenCode Handoff

Date: 2026-06-15  
Project: Local RECAP Legal Document Pipeline  
Feature: RECAP Import Queue + Local Document Filing + Qwen-VL Parsing + Legal Annotation/Extraction  
Build mode: TDD-first  
Runtime mode: real CourtListener API + real OpenRouter API  
Storage mode: local repo files only  
Frontend mode: simple operator console  

---

## Summary

Build a local RECAP document importer.

The user enters:

```json
{
  "searchTerms": "medical malpractice expert report motion to compel",
  "court": "optional",
  "targetCount": 100,
  "ocrMode": "recap_text_first"
}
```

The backend uses the real CourtListener/RECAP API, creates a queue of matching documents, processes documents **one at a time**, uses existing RECAP text when usable, uses Qwen-VL through OpenRouter when visual parsing/OCR is required, annotates the document aggressively, writes structured legal JSON, flags review issues, and saves everything locally inside the repo.

The frontend must stay simple:

```text
Search input
Target count
OCR mode
Job status
Processed / failed / review-needed counts
Current document
Output folder path
Open folder / copy folder path
```

The frontend must **not** expose:

```text
internal agents
stack file names
source.pdf
parsed.md
layout boxes
OCR boxes
extraction schema
prompt versions
eval details
raw CourtListener payload
backend artifacts
```

The backend does the real work:

```text
CourtListener RECAP search
-> queue document tasks
-> normalize metadata
-> create case folders
-> fetch source text/PDF
-> decide whether OCR/vision parsing is required
-> use Qwen-VL through OpenRouter only when needed or forced
-> annotate aggressively
-> flag human review issues
-> extract strict legal JSON
-> write manifests/eval metadata
-> return folder path/status to frontend
```

---

## Non-Negotiable Architecture Contract

Codex/OpenCode must follow this architecture exactly.

```text
Frontend = simple operator console
Backend = modular agents/services
Queue = one document at a time
Storage = local repo folder only
CourtListener = real API only
OpenRouter = real API only
Qwen-VL = MVP OCR/document vision parser
Folder = actual product output
Manifests = source of traceability
Tests/evals = required per agent
```

Do not turn this into:

```text
a browser crawler
a PACER buying tool
a RECAP extension integration
a full legal research platform
a complex file explorer
a giant autonomous chatbot
a LangGraph rewrite
a Supabase storage system
a remote storage system
a fixture/demo runtime
a frontend agent explainer
```

---

## Runtime Guardrails

Runtime must use real APIs.

Do not add runtime fixture/fallback mode.

Fixtures/mocks are allowed only in automated tests.

### Runtime must not include

```text
RECAP_IMPORT_USE_FIXTURES
fallback search data
mock runtime mode
silent fake documents
demo fallback documents
fallback OpenRouter models
fallback OCR providers
fallback local sample docs
```

### Missing credentials behavior

If `COURTLISTENER_API_TOKEN` is missing, fail clearly:

```json
{
  "error": "COURTLISTENER_API_TOKEN is required for RECAP imports"
}
```

If `OPENROUTER_API_KEY` is missing, fail clearly:

```json
{
  "error": "OPENROUTER_API_KEY is required for Qwen-VL parsing and legal extraction"
}
```

No silent fallback.

No fake results.

No PACER purchase.

No RECAP Fetch/pray-and-pay.

---

## Minimal `.env.example`

Use only env values that are secrets or likely to change per environment.

```env
# CourtListener / RECAP
COURTLISTENER_API_BASE_URL=https://www.courtlistener.com/api/rest/v4
COURTLISTENER_API_TOKEN=replace_me

# Local output
RECAP_IMPORT_OUTPUT_ROOT=./data/recap-imports
RECAP_IMPORT_MAX_TARGET_COUNT=100
RECAP_IMPORT_QUEUE_CONCURRENCY=1

# OCR / Vision parser through OpenRouter
OCR_PROVIDER=qwen_vl
OPENROUTER_API_KEY=replace_me
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
QWEN_VL_MODEL=qwen/qwen3-vl-8b-instruct

# Legal extraction through OpenRouter
LEGAL_EXTRACTION_MODEL=qwen/qwen3.6-35b-a3b-instruct

# Safety: never buy PACER docs
ALLOW_PACER_PURCHASE=false
ALLOW_RECAP_FETCH=false
```

Add this to `.gitignore`:

```gitignore
.env
.env.local
.env.*.local

data/recap-imports/
data/tmp/
data/logs/
data/evals/
```

---

<details>
<summary>1. Strict Product Scope</summary>

## Goal

Create a working MVP that imports legal documents from CourtListener/RECAP into local repo folders.

System behavior:

1. Accept search terms, optional court, target count, and OCR mode.
2. Search CourtListener/RECAP using the real API.
3. Collect up to `targetCount` matching document candidates.
4. Deduplicate candidates.
5. Create an import job.
6. Create document tasks.
7. Process document tasks one at a time.
8. Save each document into a case folder.
9. Preserve source metadata.
10. Use CourtListener plain text when usable.
11. Download source PDF when available.
12. Run Qwen-VL only when OCR/vision parsing is required or forced.
13. Annotate as much useful legal/document information as possible.
14. Flag handwriting, signatures, low-confidence OCR, bad pages, missing source, and uncertain extraction.
15. Save strict extracted JSON.
16. Save manifests and prompt/eval versions.
17. Return only folder path/status to frontend.

## Explicit non-goals

Do not implement:

```text
PACER purchase flow
RECAP browser extension integration
CourtListener upload API
RECAP Fetch/pray-and-pay
webhook alerts
distributed crawler
complex frontend file browser
full ontology graph UI
document editor
human correction UI
billing
new auth system
Supabase storage
remote storage
fixture/demo runtime
fallback API behavior
multi-user permission model
```

</details>

---

<details>
<summary>2. Frontend Contract</summary>

## Route

```text
/recap-import
```

## Frontend must show only

```text
Search terms textarea/input
Target count selector: 10 / 25 / 50 / 100
Optional court filter
OCR mode selector
Start Import Job button
Job status
Target count
Processed count
Failed count
Review-needed count
Current document
Output folder path
Open folder
Copy folder path
```

## Frontend must not show

```text
agent internals
mini-agent names
01_source_stack
02_parsed_stack
03_review_stack
04_extracted_stack
05_manifest_stack
source.pdf
parsed.md
layout_boxes.json
review_flags.json
extracted_legal.json
prompt_eval_versions.json
OCR boxes
bbox details
extraction schema
prompt versions
eval details
raw CourtListener payload
```

## Frontend response shape

```json
{
  "jobId": "job_abc123",
  "status": "running",
  "targetCount": 100,
  "queueConcurrency": 1,
  "processed": 37,
  "failed": 2,
  "reviewNeeded": 8,
  "currentDocument": {
    "sequenceNumber": 38,
    "description": "Expert Affidavit",
    "caseName": "Smith v. Hospital Corp",
    "status": "processing"
  },
  "caseFolders": [
    {
      "caseName": "Smith v. Hospital Corp",
      "courtId": "nysd",
      "docketId": "12345",
      "folderPath": "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/",
      "openUrl": "/api/recap-import/folders/job_abc123/smith-v-hospital-corp__nysd__docket-12345"
    }
  ]
}
```

</details>

---

<details>
<summary>3. Frontend HTML Reference</summary>

Use this as the reference UI. Keep it simple.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RECAP Import Console</title>
  <style>
    :root {
      --bg: #0f1117;
      --panel: #171a23;
      --panel2: #202431;
      --text: #f5f6f8;
      --muted: #aab1bf;
      --line: #343a4a;
      --accent: #8ab4ff;
      --good: #7ee787;
      --warn: #ffd166;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    .page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 28px;
    }

    header { margin-bottom: 20px; }

    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: -0.04em;
    }

    .subtitle {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }

    .grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 18px;
      align-items: start;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(0,0,0,.22);
    }

    h2 {
      margin: 0 0 14px;
      font-size: 16px;
    }

    label {
      display: block;
      margin: 14px 0 6px;
      color: var(--muted);
      font-size: 12px;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      background: #0d0f15;
      color: var(--text);
      border-radius: 10px;
      padding: 10px 11px;
      font: inherit;
    }

    textarea {
      min-height: 82px;
      resize: vertical;
    }

    button {
      width: 100%;
      margin-top: 16px;
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--accent);
      color: #08111f;
      font-weight: 800;
      cursor: pointer;
    }

    .hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
      margin: 12px 0 0;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }

    .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
    }

    .metric strong {
      display: block;
      font-size: 22px;
      margin-bottom: 4px;
    }

    .metric span {
      color: var(--muted);
      font-size: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      background: var(--panel2);
      border-radius: 999px;
      padding: 4px 8px;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .badge.good { color: var(--good); }
    .badge.warn { color: var(--warn); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
    }

    tr:last-child td { border-bottom: 0; }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    .section { margin-top: 18px; }

    .folder-box {
      background: #0d0f15;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
    }

    .folder-path {
      display: block;
      margin: 10px 0 14px;
      padding: 12px;
      background: #080a0f;
      border: 1px solid var(--line);
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #d7deea;
      overflow-x: auto;
      white-space: nowrap;
    }

    .folder-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .folder-actions a {
      display: inline-flex;
      border: 1px solid var(--line);
      background: var(--panel2);
      border-radius: 999px;
      padding: 8px 10px;
      font-size: 13px;
    }

    @media (max-width: 900px) {
      .grid, .status-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <h1>RECAP Import Console</h1>
      <p class="subtitle">
        Search RECAP, queue a target number of documents, process them one at a time,
        and save everything into a properly filed local case folder.
      </p>
    </header>

    <section class="status-grid">
      <div class="metric"><strong>100</strong><span>Target documents</span></div>
      <div class="metric"><strong>1</strong><span>Queue concurrency</span></div>
      <div class="metric"><strong>37</strong><span>Processed</span></div>
      <div class="metric"><strong>8</strong><span>Need review</span></div>
    </section>

    <section class="grid">
      <aside class="card">
        <h2>Search & Import</h2>

        <label>Search terms</label>
        <textarea>medical malpractice expert report motion to compel</textarea>

        <label>Target count</label>
        <select>
          <option>10 documents</option>
          <option>25 documents</option>
          <option>50 documents</option>
          <option selected>100 documents</option>
        </select>

        <label>Court filter</label>
        <input placeholder="Optional: nysd, nyed, ca2" />

        <label>OCR mode</label>
        <select>
          <option selected>Use RECAP text first, OCR only when needed</option>
          <option>Force Qwen-VL parsing for every downloaded PDF</option>
        </select>

        <button>Start Import Job</button>

        <p class="hint">
          The UI only shows the job and the final folder. Backend handles metadata,
          Qwen-VL parsing, annotation, review flags, extracted JSON, and internal filing.
        </p>
      </aside>

      <section>
        <section class="card">
          <h2>Current Job</h2>
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Case</th>
                <th>Status</th>
                <th>Folder</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Doc 001 — Complaint</td>
                <td>Smith v. Hospital Corp</td>
                <td><span class="badge good">complete</span></td>
                <td><a href="#">open folder</a></td>
              </tr>
              <tr>
                <td>Doc 002 — Motion to Compel</td>
                <td>Smith v. Hospital Corp</td>
                <td><span class="badge warn">review needed</span></td>
                <td><a href="#">open folder</a></td>
              </tr>
              <tr>
                <td>Doc 003 — Expert Affidavit</td>
                <td>Smith v. Hospital Corp</td>
                <td><span class="badge">processing</span></td>
                <td><a href="#">open folder</a></td>
              </tr>
              <tr>
                <td>Doc 004–100</td>
                <td>mixed results</td>
                <td><span class="badge">queued</span></td>
                <td>pending</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card section">
          <h2>Output Folder</h2>
          <div class="folder-box">
            <p class="hint" style="margin-top:0;">
              All source files, parsed outputs, review flags, extracted JSON, manifests,
              and metadata are saved inside this local case folder.
            </p>

            <span class="folder-path">
              data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/
            </span>

            <div class="folder-actions">
              <a href="#">Open case folder</a>
              <a href="#">Copy folder path</a>
              <a href="#">Open latest processed document</a>
            </div>
          </div>
        </section>
      </section>
    </section>
  </main>
</body>
</html>
```

</details>

---

<details>
<summary>4. Backend Module Layout</summary>

Recommended structure:

```text
backend/src/modules/recap-import/
  recapImport.routes.js
  recapImport.controller.js
  recapImport.service.js

  agents/
    recapSearch.agent.js
    queue.agent.js
    metadata.agent.js
    caseFolder.agent.js
    fetch.agent.js
    textTriage.agent.js
    documentVisionParser.agent.js
    reviewFlag.agent.js
    legalAnnotation.agent.js
    legalExtraction.agent.js
    manifest.agent.js

  clients/
    courtListener.client.js
    openRouterVision.client.js
    openRouterText.client.js

  repositories/
    recapJob.repository.js
    recapDocumentTask.repository.js
    recapCaseFolder.repository.js

  schemas/
    recapImportJob.schema.js
    recapDocumentTask.schema.js
    recapCandidate.schema.js
    sourceMetadata.schema.js
    textTriage.schema.js
    qwenVisionPage.schema.js
    reviewFlags.schema.js
    legalAnnotations.schema.js
    extractedLegal.schema.js
    manifest.schema.js

  services/
    recapFileStore.service.js
    slug.service.js
    hash.service.js
    jsonWriter.service.js
    evalWriter.service.js
    pdfToImage.service.js
    config.service.js
```

Each agent must be modular:

```text
input DTO -> run() -> output DTO -> write artifacts if responsible -> return status
```

No agent should return loose prose to another backend step.

</details>

---

<details>
<summary>5. Agent Contract Rule</summary>

Every agent must have:

```text
name
purpose
input schema
output schema
side effects
failure behavior
eval/test coverage
version metadata if prompt/model-backed
```

Base agent shape:

```js
export class SomeAgent {
  constructor(deps) {
    this.deps = deps;
  }

  async run(input) {
    // validate input
    // process
    // validate output
    // write artifacts if this agent owns artifacts
    // return strict JSON-compatible output
  }
}
```

Agents must not:

```text
silently mutate unrelated job state
return markdown prose
invent source facts
fetch extra documents unless that is their job
expose internals to frontend
swallow errors without status
skip manifest writing
use fixture data in runtime
fallback to other models/providers silently
```

</details>

---

<details>
<summary>6. Agents to Build</summary>

## 1. RECAP Search Agent

### Purpose

Search CourtListener/RECAP using the user’s search terms and return document candidates.

### Input

```json
{
  "searchTerms": "medical malpractice expert report motion to compel",
  "court": "nysd",
  "targetCount": 100
}
```

### Process

```text
validate COURTLISTENER_API_TOKEN exists
build CourtListener search query
page through results until target count or no more results
dedupe by recapDocumentId / docketEntryId / absoluteUrl
prefer documents with plain text or PDF availability
preserve source metadata
do not trigger PACER purchase
do not use fixtures/fallbacks at runtime
```

### Output

```json
{
  "candidates": [
    {
      "source": "courtlistener",
      "caseName": "Smith v. Hospital Corp",
      "courtId": "nysd",
      "docketId": "12345",
      "docketEntryId": "45678",
      "recapDocumentId": "98765",
      "description": "Motion to Compel",
      "absoluteUrl": "https://www.courtlistener.com/...",
      "plainTextAvailable": true,
      "pdfAvailable": true,
      "raw": {}
    }
  ]
}
```

### Tests/evals

```text
requires COURTLISTENER_API_TOKEN
calls CourtListener client with token auth
returns up to targetCount
dedupes duplicate documents
preserves source IDs
does not call PACER purchase flow
does not use runtime fixtures
handles empty result set
```

---

## 2. Queue Agent

### Purpose

Create and process document tasks one at a time.

### Input

```json
{
  "jobId": "job_abc123",
  "candidates": [],
  "concurrency": 1
}
```

### Process

```text
create document tasks
claim next pending task
mark task running
ensure only one running task per job
mark complete/review_needed/failed
persist retry count
preserve task order
```

### Output

```json
{
  "jobId": "job_abc123",
  "targetCount": 100,
  "queued": 100,
  "processed": 37,
  "reviewNeeded": 8,
  "failed": 2,
  "runningTaskId": "task_038"
}
```

### Task statuses

```text
pending
running
complete
review_needed
failed
skipped_duplicate
```

### Tests/evals

```text
only one task runs at a time
pending tasks remain pending when one is running
failed task records error
review_needed task increments review count
duplicate task is skipped
queue state is persisted locally
```

---

## 3. Metadata Agent

### Purpose

Normalize source metadata into a stable internal shape.

### Input

Raw RECAP candidate.

### Process

Preserve:

```text
source provider
source URL
case name
case name full
court id
court name
docket id
docket number
docket entry id
recap document id
document number
attachment number
document description
date filed
plain text availability
OCR status
PDF availability
download URL/path
raw source payload
```

### Output

```json
{
  "source": "courtlistener",
  "caseName": "Smith v. Hospital Corp",
  "caseNameFull": "Jane Smith v. Hospital Corporation",
  "courtId": "nysd",
  "docketId": "12345",
  "docketNumber": "1:26-cv-12345",
  "docketEntryId": "45678",
  "recapDocumentId": "98765",
  "documentNumber": "42",
  "attachmentNumber": null,
  "description": "Motion to Compel",
  "dateFiled": "2026-06-01",
  "absoluteUrl": "https://www.courtlistener.com/...",
  "plainTextAvailable": true,
  "ocrStatus": "complete",
  "pdfAvailable": true,
  "raw": {}
}
```

### Tests/evals

```text
preserves all known fields
handles missing optional fields
does not drop raw source payload
normalizes IDs as strings
writes source_metadata.json
```

---

## 4. Case Folder Agent

### Purpose

Create stable local case and document folder paths.

### Input

Normalized metadata.

### Process

Case folder format:

```text
data/recap-imports/{safe_case_name}__{court_id}__docket-{docket_id}/
```

Document folder format:

```text
documents/doc-{sequence}-{safe_document_description}/
```

Sanitization rules:

```text
lowercase
spaces -> hyphens
remove slashes
remove unsafe punctuation
collapse repeated hyphens
trim leading/trailing hyphens
truncate long folder names
dedupe conflicts with suffix
```

### Output

```json
{
  "caseFolderPath": "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/",
  "documentFolderPath": "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/documents/doc-001-motion-to-compel/"
}
```

### Tests/evals

```text
creates safe folder names
removes slashes
handles punctuation
dedupes collisions
returns stable path for same input
creates folders locally
```

---

## 5. Fetch Agent

### Purpose

Save source text/PDF when available.

### Input

```json
{
  "metadata": {},
  "folders": {}
}
```

### Process

```text
save CourtListener plain_text if available
download PDF if available
hash downloaded PDF
write download metadata
mark unavailable if no text and no PDF
do not buy PACER documents
do not use fallback documents
```

### Output

```json
{
  "plainTextPath": "source/courtlistener_plain_text.txt",
  "pdfPath": "source/source.pdf",
  "pdfExists": true,
  "plainTextExists": true,
  "sourceUnavailable": false,
  "hashes": {
    "pdfSha256": "..."
  }
}
```

### Tests/evals

```text
saves plain text
downloads PDF when available
does not download when unavailable
marks source unavailable
writes hashes
does not buy PACER docs
does not use fallback documents
```

---

## 6. Text Triage Agent

### Purpose

Decide whether Qwen-VL parsing is required.

### Input

```json
{
  "plainText": "...",
  "plainTextExists": true,
  "pdfExists": true,
  "pageCount": 10,
  "forceOcr": false,
  "ocrStatus": "complete",
  "needsLayoutParsing": false,
  "needsCoordinateReview": false
}
```

### OCR/vision trigger formula

```ts
requiresOcr =
  forceOcr === true ||
  !plainTextExists ||
  plainTextTooShort ||
  plainTextLooksGarbled ||
  pdfExistsButTextMissing ||
  recapOcrStatusIsFailedOrIncomplete ||
  documentNeedsLayoutParsing ||
  documentNeedsCoordinateReview
```

### OCR/vision trigger details

| Trigger | Reason |
|---|---|
| `forceOcr=true` | User explicitly requested visual parsing on every document. |
| No CourtListener `plain_text` | There is no usable text to extract from. |
| Empty or near-empty `plain_text` | Likely scanned PDF or failed text extraction. |
| Text too short for page count | Example: 20-page PDF with only 500 characters. |
| Text looks garbled | Random symbols, broken words, repeated whitespace, extraction noise. |
| PDF exists but text is missing | Source likely needs OCR/vision parsing. |
| RECAP `ocr_status` is failed/incomplete/partial/unavailable | Existing OCR cannot be trusted. |
| Document likely needs layout parsing | Tables, forms, exhibits, charts, structured pages. |
| Coordinate/page review is needed | Signatures, handwriting, seals, stamps, low-confidence areas. |

### MVP thresholds

These should live in code config, not env:

```ts
const MIN_TEXT_CHARS = 1000;
const MIN_CHARS_PER_PAGE = 500;
const MAX_GARBAGE_RATIO = 0.15;
```

### Expected behavior

```ts
function shouldRequireOcr(input) {
  if (input.forceOcr) {
    return { requiresOcr: true, reason: "force_ocr" };
  }

  if (!input.pdfExists && !input.plainText) {
    return {
      requiresOcr: false,
      reason: "source_unavailable",
      sourceUnavailable: true
    };
  }

  if (!input.plainText || input.plainText.trim().length === 0) {
    return { requiresOcr: true, reason: "plain_text_missing" };
  }

  if (input.pageCount && input.plainText.trim().length < input.pageCount * 500) {
    return {
      requiresOcr: true,
      reason: "plain_text_too_short_for_page_count"
    };
  }

  if (looksGarbled(input.plainText)) {
    return { requiresOcr: true, reason: "plain_text_garbled" };
  }

  if (["failed", "unavailable", "incomplete", "partial"].includes(input.ocrStatus)) {
    return {
      requiresOcr: true,
      reason: "recap_ocr_status_not_usable"
    };
  }

  if (input.needsLayoutParsing) {
    return { requiresOcr: true, reason: "layout_parsing_required" };
  }

  if (input.needsCoordinateReview) {
    return { requiresOcr: true, reason: "coordinate_review_required" };
  }

  return { requiresOcr: false, reason: "plain_text_usable" };
}
```

### Output

```json
{
  "requiresOcr": true,
  "reason": "plain_text_too_short_for_page_count",
  "textQuality": "partial",
  "sourceUnavailable": false
}
```

### Tests/evals

```text
returns requiresOcr=false when RECAP plain text is usable
returns requiresOcr=true when forceOcr=true
returns requiresOcr=true when plain text is missing
returns requiresOcr=true when plain text is too short for page count
returns requiresOcr=true when text is garbled
returns requiresOcr=true when RECAP OCR status is failed/incomplete/partial
returns requiresOcr=true when layout parsing is required
returns requiresOcr=true when coordinate review is required
returns requiresOcr=false when neither PDF nor text is available, but marks sourceUnavailable
```

---

## 7. Document Vision Parser Agent

### Purpose

Use Qwen-VL through OpenRouter when visual parsing is required, or normalize existing RECAP text into parsed artifacts.

### Runtime provider

```text
OCR_PROVIDER=qwen_vl
```

No fallback provider in MVP.

If `OCR_PROVIDER` is not `qwen_vl`, fail clearly.

### Input

```json
{
  "provider": "qwen_vl",
  "model": "qwen/qwen3-vl-8b-instruct",
  "documentFolderPath": "data/recap-imports/.../documents/doc-001-complaint/",
  "pdfPath": "source/source.pdf",
  "pageImages": [
    "pages/page-001.png",
    "pages/page-002.png"
  ],
  "plainText": "",
  "requiresOcr": true,
  "reason": "plain_text_missing"
}
```

### Process

```text
validate OPENROUTER_API_KEY exists
validate QWEN_VL_MODEL exists
if requiresOcr=false, create parsed artifacts from existing plain text
if requiresOcr=true, convert PDF pages to images if needed
send one page image at a time to Qwen-VL through OpenRouter
ask for strict JSON only
ask for page-level transcription
ask for layout summary
ask for likely signatures/handwriting/seals/stamps
ask for uncertainty markers
save parsed text and structured page output
mark bboxAvailable=false unless the model returns trustworthy coordinates
```

### Qwen-VL prompt contract

```text
You are a document vision parser for legal filings.

Task:
Read the provided document page image and extract as much useful document text and legal/document structure as possible.

Return strict JSON only.

Do not invent facts.
If text is uncertain, mark it as uncertain.
If handwriting, signature, stamp, seal, table, exhibit label, or unreadable area appears, flag it.
If exact bounding boxes are not available, use page-level flags and set bboxAvailable=false.

Required JSON shape:
{
  "page": number,
  "transcribedText": string,
  "layoutSummary": {
    "hasHeader": boolean,
    "hasFooter": boolean,
    "hasTable": boolean,
    "hasSignatureBlock": boolean,
    "hasHandwriting": boolean,
    "hasSealOrStamp": boolean,
    "hasExhibitLabel": boolean
  },
  "legalHints": {
    "possibleDocumentType": string | null,
    "possibleMotionType": string | null,
    "partyNames": string[],
    "attorneyNames": string[],
    "courtNames": string[],
    "dates": string[],
    "legalTerms": string[]
  },
  "reviewFlags": [
    {
      "flagType": string,
      "severity": "low" | "medium" | "high",
      "page": number,
      "reason": string,
      "confidence": number,
      "bboxAvailable": false,
      "bbox": null
    }
  ],
  "confidence": {
    "text": number,
    "layout": number,
    "legalHints": number
  }
}
```

### Output

```json
{
  "usedOcr": true,
  "provider": "qwen_vl",
  "model": "qwen/qwen3-vl-8b-instruct",
  "bboxAvailable": false,
  "coordinateReviewPrecision": "page_level_only",
  "parsedTextPath": "parsed/parsed.md",
  "parsedPagesPath": "parsed/parsed_pages.json",
  "layoutSummaryPath": "parsed/layout_summary.json",
  "ocrQualityReportPath": "parsed/ocr_quality_report.json",
  "reviewFlagsPath": "review/review_flags.json"
}
```

### Tests/evals

```text
requires OPENROUTER_API_KEY
requires QWEN_VL_MODEL
calls OpenRouterVisionClient when OCR is required
does not call Qwen-VL when RECAP plain text is usable
writes parsed.md
writes parsed_pages.json
writes layout_summary.json
writes ocr_quality_report.json
marks bboxAvailable=false when no coordinates exist
creates page-level review flags
does not use fallback model when Qwen model fails
fails clearly on OpenRouter error
```

---

## 8. Human Review Flag Agent

### Purpose

Flag document/page/coordinate regions that need human review.

For Qwen-VL MVP, review flags are usually page-level, not verified coordinate-level.

### Input

```json
{
  "parsedPages": [],
  "layoutSummary": [],
  "ocrQuality": {},
  "metadata": {}
}
```

### Flag types

```text
handwriting_possible
signature_possible
low_confidence_ocr
missing_page_text
garbled_text
table_parse_uncertain
seal_or_stamp_detected
exhibit_label_uncertain
page_rotation_possible
duplicate_page_possible
source_pdf_missing
source_text_missing
extraction_conflict
legal_date_uncertain
party_name_uncertain
```

### Output

```json
{
  "reviewRequired": true,
  "flags": [
    {
      "flagType": "signature_possible",
      "severity": "medium",
      "page": 7,
      "bboxAvailable": false,
      "bbox": null,
      "reason": "Qwen-VL detected a likely signature block near the end of the page.",
      "confidence": 0.82
    }
  ]
}
```

### Tests/evals

```text
flags low-confidence text
flags possible signature blocks
flags possible handwriting
preserves page
sets bboxAvailable=false for Qwen-VL page-level flags
sets reviewRequired=true when flags exist
sets reviewRequired=false when no flags exist
```

---

## 9. Legal Annotation Agent

### Purpose

Annotate as much useful legal/document information as possible inside backend artifacts.

### Input

```json
{
  "parsedText": "...",
  "metadata": {},
  "reviewFlags": []
}
```

### Must annotate

```text
document type
filing type
motion type
relief requested
procedural posture
parties
party roles
attorneys
judges
court
docket numbers
dates
deadlines
exhibits
affidavits
declarations
expert names
medical providers
hospitals
injuries
claims
defenses
legal standards
cited rules
cited statutes
cited cases
deposition references
discovery demands
discovery deficiencies
orders
sanctions references
settlement references
damages references
causation references
standard of care references
malpractice terms
negligence terms
expert report references
signature blocks
notarization blocks
certificate of service
proof of service
```

### Guardrail

Annotate aggressively, but attach confidence and source references.

Never convert uncertain OCR into certain fact.

### Output

```json
{
  "annotations": [
    {
      "type": "motion_type",
      "value": "motion_to_compel",
      "confidence": 0.91,
      "source": {
        "page": 1,
        "span": "Plaintiff moves to compel..."
      }
    }
  ]
}
```

### Tests/evals

```text
annotates motion to compel
annotates complaint
annotates expert affidavit
preserves confidence
preserves source span/page when available
does not invent missing legal facts
```

---

## 10. Legal Extraction Agent

### Purpose

Convert annotations and parsed text into strict legal JSON using OpenRouter text model.

### Input

```json
{
  "annotations": {},
  "parsed": {},
  "metadata": {},
  "review": {}
}
```

### Output schema

```json
{
  "document": {
    "documentType": "",
    "filingType": "",
    "description": "",
    "court": "",
    "caseName": "",
    "docketNumber": "",
    "recapDocumentId": "",
    "dateFiled": ""
  },
  "parties": [],
  "attorneys": [],
  "judges": [],
  "dates": [],
  "deadlines": [],
  "motions": [],
  "orders": [],
  "claims": [],
  "defenses": [],
  "legalTerms": [],
  "citations": [],
  "exhibits": [],
  "medicalEntities": [],
  "discoveryIssues": [],
  "reviewFlags": [],
  "confidence": {
    "overall": 0,
    "documentType": 0,
    "entities": 0,
    "dates": 0,
    "legalIssues": 0
  }
}
```

### Guardrail

```text
Output strict JSON only.
No markdown.
No prose.
No unsupported facts.
Each extracted fact should include provenance when possible.
No fallback model.
Fail clearly if OpenRouter call fails.
```

### Tests/evals

```text
requires OPENROUTER_API_KEY
requires LEGAL_EXTRACTION_MODEL
returns valid JSON
matches schema
extracts parties/dates/legal terms
includes confidence object
includes review flags
does not return markdown prose
does not invent absent parties
fails clearly on model/API error
```

---

## 11. Manifest Agent

### Purpose

Write traceability files for each job/document/case.

### Must include

```text
job id
document task id
source ids
folder paths
source hashes
parser provider
Qwen-VL model
legal extraction model
prompt version
schema version
eval version
timestamps
status
errors
review required
file references
```

### Output

```json
{
  "jobId": "job_abc123",
  "taskId": "task_001",
  "status": "complete",
  "reviewRequired": false,
  "source": {
    "provider": "courtlistener",
    "recapDocumentId": "98765",
    "docketId": "12345"
  },
  "artifacts": {
    "caseFolderPath": "data/recap-imports/...",
    "documentFolderPath": "data/recap-imports/.../documents/doc-001-complaint/"
  },
  "versions": {
    "visionProvider": "qwen_vl",
    "visionModel": "qwen/qwen3-vl-8b-instruct",
    "legalExtractionModel": "qwen/qwen3.6-35b-a3b-instruct",
    "promptContractVersion": "recap-legal-extraction-v1",
    "schemaVersion": "recap-extracted-legal-json-v1",
    "evalVersion": "recap-import-eval-v1"
  }
}
```

### Tests/evals

```text
writes manifest after success
writes manifest after review-needed
writes error manifest after failure
includes source IDs
includes model/version metadata
includes folder paths
```

</details>

---

<details>
<summary>7. Orchestrator Contract</summary>

`recapImport.service.js` owns orchestration.

Agents own their own small jobs.

The orchestrator wires them together.

```js
export class RecapImportService {
  constructor({
    recapSearchAgent,
    queueAgent,
    metadataAgent,
    caseFolderAgent,
    fetchAgent,
    textTriageAgent,
    documentVisionParserAgent,
    reviewFlagAgent,
    legalAnnotationAgent,
    legalExtractionAgent,
    manifestAgent
  }) {
    Object.assign(this, {
      recapSearchAgent,
      queueAgent,
      metadataAgent,
      caseFolderAgent,
      fetchAgent,
      textTriageAgent,
      documentVisionParserAgent,
      reviewFlagAgent,
      legalAnnotationAgent,
      legalExtractionAgent,
      manifestAgent
    });
  }

  async createJob(input) {
    const job = await this.queueAgent.createJob(input);

    const searchResult = await this.recapSearchAgent.run({
      searchTerms: input.searchTerms,
      court: input.court,
      targetCount: input.targetCount
    });

    await this.queueAgent.enqueueDocuments(job.id, searchResult.candidates);

    return {
      jobId: job.id,
      status: "queued",
      targetCount: input.targetCount,
      queueConcurrency: 1
    };
  }

  async processNextDocument(jobId) {
    const task = await this.queueAgent.claimNext(jobId);

    if (!task) return null;

    try {
      const metadata = await this.metadataAgent.run(task);
      const folders = await this.caseFolderAgent.run({ metadata, task });
      const fetched = await this.fetchAgent.run({ metadata, folders });

      const triage = await this.textTriageAgent.run({
        plainText: fetched.plainText,
        plainTextExists: fetched.plainTextExists,
        pdfExists: fetched.pdfExists,
        pageCount: fetched.pageCount,
        forceOcr: task.ocrMode === "force_ocr",
        ocrStatus: metadata.ocrStatus,
        needsLayoutParsing: task.needsLayoutParsing,
        needsCoordinateReview: task.needsCoordinateReview
      });

      const parsed = await this.documentVisionParserAgent.run({
        triage,
        fetched,
        folders,
        provider: "qwen_vl"
      });

      const review = await this.reviewFlagAgent.run({
        parsed,
        metadata,
        folders
      });

      const annotations = await this.legalAnnotationAgent.run({
        parsed,
        metadata,
        review,
        folders
      });

      const extraction = await this.legalExtractionAgent.run({
        annotations,
        parsed,
        metadata,
        review,
        folders
      });

      await this.manifestAgent.run({
        task,
        metadata,
        folders,
        fetched,
        triage,
        parsed,
        review,
        annotations,
        extraction
      });

      await this.queueAgent.markComplete(task.id, {
        reviewRequired: review.reviewRequired,
        folderPath: folders.caseFolderPath
      });

      return {
        taskId: task.id,
        folderPath: folders.caseFolderPath,
        reviewRequired: review.reviewRequired
      };
    } catch (error) {
      await this.queueAgent.markFailed(task.id, error);
      await this.manifestAgent.runError({ task, error });
      throw error;
    }
  }
}
```

Guardrail:

```text
Only orchestrator decides workflow order.
Individual agents do not call unrelated agents.
Frontend does not call agents directly.
Runtime does not use fixtures.
Runtime does not use fallback providers or fallback models.
```

</details>

---

<details>
<summary>8. Local Storage / Folder Contract</summary>

Frontend shows only the case folder path.

Backend internally writes this shape:

```text
data/recap-imports/
  smith-v-hospital-corp__nysd__docket-12345/
    case_manifest.json
    job_manifest.json
    queue_status.json
    documents/
      doc-001-complaint/
        source/
          source.pdf
          courtlistener_plain_text.txt
          source_metadata.json
          download_metadata.json
        parsed/
          parsed.md
          parsed_pages.json
          layout_summary.json
          layout_boxes.json        # only if verified/usable boxes exist
          ocr_quality_report.json
        review/
          review_flags.json
          handwriting_flags.json
          signature_flags.json
          low_confidence_boxes.json
        extracted/
          legal_annotations.json
          extracted_legal.json
          entities.json
          dates_deadlines.json
          legal_terms.json
          confidence_report.json
        manifest/
          document_manifest.json
          prompt_eval_versions.json
      doc-002-motion-to-compel/
        ...
```

Frontend must receive only:

```json
{
  "folderPath": "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/",
  "openUrl": "/api/recap-import/folders/..."
}
```

</details>

---

<details>
<summary>9. Local Queue / Repository Contract</summary>

Use local repo persistence.

Preferred MVP:

```text
local SQLite queue DB under ./data/recap-imports/queue.sqlite
```

Alternative if repo does not use SQLite:

```text
JSON-backed local queue state under ./data/recap-imports/queue_status.json
```

Do not use Supabase.

Do not use external storage.

Do not require Redis/BullMQ for MVP.

## recap_import_jobs

Fields:

```text
id
search_terms
court_filter
target_count
ocr_mode
status
requested_at
started_at
completed_at
processed_count
failed_count
review_needed_count
output_root
error_message
```

Statuses:

```text
pending
searching
queued
running
complete
partial_complete
failed
cancelled
```

## recap_document_tasks

Fields:

```text
id
job_id
sequence_number
status
case_name
court_id
docket_id
docket_entry_id
recap_document_id
document_description
source_url
folder_path
metadata_path
review_required
retry_count
error_message
started_at
completed_at
```

Statuses:

```text
pending
running
complete
review_needed
failed
skipped_duplicate
```

## recap_case_folders

Fields:

```text
id
job_id
case_name
safe_case_name
court_id
docket_id
folder_path
document_count
review_needed_count
created_at
updated_at
```

</details>

---

<details>
<summary>10. API Contract</summary>

## POST /api/recap-import/jobs

Request:

```json
{
  "searchTerms": "medical malpractice expert report motion to compel",
  "court": "nysd",
  "targetCount": 100,
  "ocrMode": "recap_text_first"
}
```

Validation:

```text
searchTerms required
targetCount defaults to 10
targetCount max 100
ocrMode enum: recap_text_first | force_ocr
court optional
COURTLISTENER_API_TOKEN required
OPENROUTER_API_KEY required
QWEN_VL_MODEL required
LEGAL_EXTRACTION_MODEL required
ALLOW_PACER_PURCHASE must not be true
ALLOW_RECAP_FETCH must not be true
```

Response:

```json
{
  "jobId": "job_abc123",
  "status": "queued",
  "targetCount": 100,
  "queueConcurrency": 1
}
```

## GET /api/recap-import/jobs/:jobId

Response:

```json
{
  "jobId": "job_abc123",
  "status": "running",
  "targetCount": 100,
  "queueConcurrency": 1,
  "processed": 37,
  "failed": 2,
  "reviewNeeded": 8,
  "currentDocument": {
    "sequenceNumber": 38,
    "description": "Expert Affidavit",
    "caseName": "Smith v. Hospital Corp",
    "status": "processing"
  },
  "caseFolders": [
    {
      "caseName": "Smith v. Hospital Corp",
      "courtId": "nysd",
      "docketId": "12345",
      "folderPath": "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/",
      "openUrl": "/api/recap-import/folders/job_abc123/smith-v-hospital-corp__nysd__docket-12345"
    }
  ]
}
```

## GET /api/recap-import/jobs/:jobId/tasks

Response can include task statuses but should not include internal artifact names:

```json
{
  "tasks": [
    {
      "sequenceNumber": 1,
      "documentDescription": "Complaint",
      "caseName": "Smith v. Hospital Corp",
      "status": "complete",
      "reviewRequired": false,
      "folderPath": "data/recap-imports/.../documents/doc-001-complaint/"
    }
  ]
}
```

</details>

---

<details>
<summary>11. Modern Agent Requirements</summary>

Every agent should support:

```text
input/output schema
versioned logic or prompt
test/eval
run trace
source provenance
confidence/uncertainty
retry policy where relevant
idempotency
human review flags where relevant
cost/rate-limit controls
tool boundary
artifact manifest
reprocess ability
local file safety
```

## Required run trace

Each agent run should be traceable:

```json
{
  "agentName": "text-triage-agent",
  "agentVersion": "v1",
  "jobId": "job_abc123",
  "taskId": "task_001",
  "startedAt": "ISO_TIMESTAMP",
  "completedAt": "ISO_TIMESTAMP",
  "durationMs": 122,
  "status": "complete",
  "inputSummary": {},
  "outputSummary": {},
  "error": null
}
```

## Tool boundary guardrail

```text
Search Agent searches only.
Queue Agent queues only.
Metadata Agent normalizes only.
Folder Agent creates paths/folders only.
Fetch Agent fetches source artifacts only.
Triage Agent decides OCR/vision parsing only.
Document Vision Parser Agent parses text/layout only.
Review Flag Agent flags review issues only.
Annotation Agent annotates legal concepts only.
Extraction Agent writes strict legal JSON only.
Manifest Agent writes trace/version metadata only.
```

</details>

---

<details>
<summary>12. Eval Contract</summary>

Every agent must have at least one test or eval.

Use this rule:

```text
Deterministic agent -> unit/contract tests
Qwen-VL/OpenRouter/legal agent -> mocked client tests + golden output checks
Whole pipeline -> integration test with mocked clients
Runtime smoke test -> optional, real API, manually run only
```

Runtime must not use fixtures.

Tests can use mocked clients and static test payloads.

Recommended eval folder:

```text
evals/recap-import/
  search-agent/
    search_dedupe.eval.json
    search_target_count.eval.json

  metadata-agent/
    metadata_normalization.eval.json
    missing_fields.eval.json

  folder-agent/
    folder_slug_safety.eval.json
    duplicate_case_names.eval.json

  text-triage-agent/
    requires_ocr.eval.json
    skip_ocr_when_text_good.eval.json

  document-vision-parser-agent/
    qwen_page_parse.eval.json
    qwen_signature_flag.eval.json
    qwen_page_level_review.eval.json

  review-flag-agent/
    signature_detection.eval.json
    handwriting_flag.eval.json
    low_confidence_ocr.eval.json

  legal-annotation-agent/
    motion_to_compel.eval.json
    expert_affidavit.eval.json
    complaint.eval.json

  legal-extraction-agent/
    strict_json_schema.eval.json
    parties_dates_terms.eval.json
    uncertainty_flags.eval.json

  pipeline/
    recap_three_document_job.eval.json
    recap_hundred_document_queue.eval.json
```

Each eval result should save:

```json
{
  "evalName": "requires_ocr_missing_plain_text",
  "agentName": "text-triage-agent",
  "agentVersion": "v1",
  "inputFixture": {},
  "expectedOutput": {},
  "actualOutput": {},
  "passed": true,
  "promptVersion": null,
  "schemaVersion": "text-triage-v1",
  "timestamp": "ISO_TIMESTAMP"
}
```

</details>

---

<details>
<summary>13. Prompt / Schema / Version Metadata</summary>

Every extraction should save:

```json
{
  "promptContractVersion": "recap-legal-extraction-v1",
  "annotationPromptVersion": "legal-annotation-v1",
  "extractionPromptVersion": "legal-json-extraction-v1",
  "reviewFlagPromptVersion": "human-review-flags-v1",
  "schemaVersion": "recap-extracted-legal-json-v1",
  "evalVersion": "recap-import-eval-v1",
  "visionParser": {
    "provider": "qwen_vl",
    "model": "qwen/qwen3-vl-8b-instruct"
  },
  "legalExtraction": {
    "provider": "openrouter",
    "model": "qwen/qwen3.6-35b-a3b-instruct"
  },
  "createdAt": "ISO_TIMESTAMP"
}
```

Prompt guardrails:

```text
Annotate aggressively.
Preserve uncertainty.
Attach source spans/page refs when possible.
Never invent facts not present in source.
Mark OCR/vision uncertainty.
Mark missing source data.
Return strict JSON only for JSON tasks.
Keep legal output assistive, not authoritative.
Do not use fallback models.
```

</details>

---

<details>
<summary>14. TDD Plan</summary>

Use existing repo test framework.

Add tests before implementation.

Recommended test files:

```text
recapImport.routes.test.js
recapImport.service.test.js
recapSearch.agent.test.js
queue.agent.test.js
metadata.agent.test.js
caseFolder.agent.test.js
fetch.agent.test.js
textTriage.agent.test.js
documentVisionParser.agent.test.js
openRouterVision.client.test.js
openRouterText.client.test.js
reviewFlag.agent.test.js
legalAnnotation.agent.test.js
legalExtraction.agent.test.js
manifest.agent.test.js
recapImport.integration.test.js
recapImport.frontend.test.js
```

## Required route tests

```text
creates import job from search terms
rejects targetCount over 100
defaults targetCount to 10
rejects missing searchTerms
rejects missing COURTLISTENER_API_TOKEN
rejects missing OPENROUTER_API_KEY
rejects when ALLOW_PACER_PURCHASE=true
rejects when ALLOW_RECAP_FETCH=true
returns frontend-safe job status
does not expose internal artifact file names
```

## Required search agent tests

```text
requires COURTLISTENER_API_TOKEN
calls CourtListener client with token auth header
returns up to targetCount
dedupes duplicate documents
preserves source IDs
handles empty result set
does not trigger PACER purchase
does not use runtime fixtures
```

## Required queue agent tests

```text
creates tasks from candidates
processes only one document at a time
marks complete
marks review_needed
marks failed with error
skips duplicate
persists local queue state
```

## Required metadata agent tests

```text
normalizes raw CourtListener fields
preserves raw payload
handles missing optional fields
keeps IDs stable as strings
writes source_metadata.json
```

## Required folder agent tests

```text
creates safe case folder path
removes slashes
removes unsafe punctuation
dedupes collisions
creates document folder path
writes folders locally under RECAP_IMPORT_OUTPUT_ROOT
```

## Required fetch agent tests

```text
saves plain text when available
downloads PDF when available
hashes PDF
marks sourceUnavailable when no PDF/text
does not buy PACER docs
does not use fallback documents
```

## Required text triage tests

```text
returns requiresOcr=false when RECAP plain text is usable
returns requiresOcr=true when forceOcr=true
returns requiresOcr=true when plain text is missing
returns requiresOcr=true when plain text is too short for page count
returns requiresOcr=true when text is garbled
returns requiresOcr=true when RECAP OCR status is failed/incomplete/partial
returns requiresOcr=true when layout parsing is required
returns requiresOcr=true when coordinate review is required
returns sourceUnavailable when neither PDF nor text exists
```

## Required Qwen-VL parser tests

```text
requires OPENROUTER_API_KEY
requires QWEN_VL_MODEL
calls OpenRouterVisionClient when OCR is required
does not call Qwen-VL when RECAP plain text is usable
writes parsed.md
writes parsed_pages.json
writes layout_summary.json
writes ocr_quality_report.json
marks bboxAvailable=false when no coordinates exist
creates page-level review flags
does not use fallback model when Qwen model fails
fails clearly on OpenRouter error
```

## Required review flag tests

```text
flags low-confidence OCR/vision text
flags possible signatures
flags possible handwriting
preserves page
sets bboxAvailable=false for Qwen-VL page-level flags
sets reviewRequired
```

## Required legal annotation tests

```text
annotates motion type
annotates parties
annotates dates
annotates legal terms
includes confidence
does not invent unsupported facts
```

## Required legal extraction tests

```text
requires OPENROUTER_API_KEY
requires LEGAL_EXTRACTION_MODEL
returns strict JSON
matches schema
includes confidence
includes review flags
includes provenance where available
does not return markdown
does not use fallback model
does not invent absent parties
fails clearly on OpenRouter error
```

## Required manifest tests

```text
writes document manifest
writes prompt/eval version metadata
records source IDs
records Qwen-VL model
records legal extraction model
records status
records errors
```

## Required frontend tests

```text
renders search form
renders target count selector
renders OCR mode selector
renders job status metrics
renders output folder path
does not render internal stack names
does not render internal artifact names
does not render mini-agent names
```

## Required integration tests

```text
mock CourtListener client for 3-document job
mock OpenRouter vision client
mock OpenRouter text client
process queue sequentially
create folders
write manifests
return folder-only frontend response

mock 100-document queue
verify only one running task at a time
verify final status counts
```

</details>

---

<details>
<summary>15. Red Test Skeletons</summary>

Adapt imports/paths to existing repo style.

## recapImport.routes.test.js

```js
describe("RECAP Import routes", () => {
  it("creates an import job from search terms", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "test_token",
        OPENROUTER_API_KEY: "test_openrouter",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "qwen/qwen3.6-35b-a3b-instruct",
        ALLOW_PACER_PURCHASE: "false",
        ALLOW_RECAP_FETCH: "false"
      }
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "medical malpractice motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first"
      });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.targetCount).toBe(10);
    expect(res.body.queueConcurrency).toBe(1);
  });

  it("rejects targetCount over 100", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "expert report",
        targetCount: 500,
        ocrMode: "recap_text_first"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetCount/i);
  });

  it("rejects missing CourtListener token", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "",
        OPENROUTER_API_KEY: "test_openrouter",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "qwen/qwen3.6-35b-a3b-instruct"
      }
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/COURTLISTENER_API_TOKEN/i);
  });

  it("rejects missing OpenRouter key", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "test_token",
        OPENROUTER_API_KEY: "",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "qwen/qwen3.6-35b-a3b-instruct"
      }
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/OPENROUTER_API_KEY/i);
  });

  it("returns frontend-safe job status without internal file list", async () => {
    const app = createTestAppWithValidEnv();
    const job = await seedRecapJobWithCompletedFolder();

    const res = await request(app)
      .get(`/api/recap-import/jobs/${job.id}`);

    expect(res.status).toBe(200);
    expect(res.body.caseFolders[0].folderPath).toBeDefined();

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("source.pdf");
    expect(serialized).not.toContain("parsed.md");
    expect(serialized).not.toContain("extracted_legal.json");
    expect(serialized).not.toContain("prompt_eval_versions.json");
    expect(serialized).not.toContain("layout_boxes.json");
  });
});
```

## recapSearch.agent.test.js

```js
describe("RecapSearchAgent", () => {
  it("requires CourtListener token", async () => {
    const agent = createRecapSearchAgent({
      courtListenerClient: mockCourtListenerClient(),
      config: {
        courtListenerToken: ""
      }
    });

    await expect(
      agent.run({
        searchTerms: "motion to compel",
        targetCount: 10
      })
    ).rejects.toThrow(/COURTLISTENER_API_TOKEN/i);
  });

  it("returns up to targetCount and dedupes results", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          {
            recapDocumentId: "1",
            docketEntryId: "a",
            caseName: "Smith v Hospital",
            absoluteUrl: "url-1"
          },
          {
            recapDocumentId: "1",
            docketEntryId: "a",
            caseName: "Smith v Hospital",
            absoluteUrl: "url-1"
          },
          {
            recapDocumentId: "2",
            docketEntryId: "b",
            caseName: "Jones v Clinic",
            absoluteUrl: "url-2"
          }
        ]
      })
    };

    const agent = createRecapSearchAgent({
      courtListenerClient,
      config: {
        courtListenerToken: "test"
      }
    });

    const result = await agent.run({
      searchTerms: "motion to compel",
      targetCount: 2
    });

    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map(c => c.recapDocumentId)).size).toBe(2);
  });

  it("does not trigger PACER purchase", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({ results: [] }),
      recapFetch: vi.fn(),
      buyPacerDocument: vi.fn()
    };

    const agent = createRecapSearchAgent({
      courtListenerClient,
      config: {
        courtListenerToken: "test",
        allowPacerPurchase: false,
        allowRecapFetch: false
      }
    });

    await agent.run({
      searchTerms: "expert report",
      targetCount: 10
    });

    expect(courtListenerClient.recapFetch).not.toHaveBeenCalled();
    expect(courtListenerClient.buyPacerDocument).not.toHaveBeenCalled();
  });
});
```

## queue.agent.test.js

```js
describe("QueueAgent", () => {
  it("processes only one document task at a time", async () => {
    const queue = createQueueAgent({ concurrency: 1 });

    await queue.enqueueMany("job_1", [
      { id: "task_1", status: "pending" },
      { id: "task_2", status: "pending" },
      { id: "task_3", status: "pending" }
    ]);

    const running = await queue.claimNext("job_1");

    expect(running.id).toBe("task_1");

    const tasks = await queue.listTasks("job_1");
    expect(tasks.filter(t => t.status === "running")).toHaveLength(1);
    expect(tasks.filter(t => t.status === "pending")).toHaveLength(2);
  });

  it("marks review_needed and increments review count", async () => {
    const queue = createQueueAgent({ concurrency: 1 });

    await queue.enqueueMany("job_1", [
      { id: "task_1", status: "pending" }
    ]);

    const task = await queue.claimNext("job_1");

    await queue.markComplete(task.id, {
      reviewRequired: true,
      folderPath: "data/recap-imports/case"
    });

    const updated = await queue.getTask(task.id);
    expect(updated.status).toBe("review_needed");

    const job = await queue.getJob("job_1");
    expect(job.reviewNeeded).toBe(1);
  });
});
```

## caseFolder.agent.test.js

```js
describe("CaseFolderAgent", () => {
  it("creates safe case folder path", async () => {
    const agent = createCaseFolderAgent({
      root: "data/recap-imports"
    });

    const result = await agent.run({
      metadata: {
        caseName: "Smith / Jones v. New York-Presbyterian Hospital, Inc.",
        courtId: "nysd",
        docketId: "12345",
        description: "Motion to Compel"
      },
      task: {
        sequenceNumber: 1
      }
    });

    expect(result.caseFolderPath).toBe(
      "data/recap-imports/smith-jones-v-new-york-presbyterian-hospital-inc__nysd__docket-12345/"
    );

    expect(result.documentFolderPath).toContain("doc-001-motion-to-compel");
  });
});
```

## textTriage.agent.test.js

```js
describe("TextTriageAgent", () => {
  it("uses RECAP plain text when usable", async () => {
    const agent = createTextTriageAgent();

    const result = await agent.run({
      plainText: "This is a long enough extracted filing text...".repeat(200),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete"
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.reason).toBe("plain_text_usable");
  });

  it("requires OCR when plain text is missing", async () => {
    const agent = createTextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: true,
      pageCount: 4,
      forceOcr: false,
      ocrStatus: null
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_missing");
  });

  it("force OCR overrides usable plain text", async () => {
    const agent = createTextTriageAgent();

    const result = await agent.run({
      plainText: "Usable filing text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: true,
      ocrStatus: "complete"
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("force_ocr");
  });

  it("requires OCR when text is too short for page count", async () => {
    const agent = createTextTriageAgent();

    const result = await agent.run({
      plainText: "short text",
      plainTextExists: true,
      pdfExists: true,
      pageCount: 20,
      forceOcr: false,
      ocrStatus: "complete"
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_too_short_for_page_count");
  });

  it("marks source unavailable when no text and no PDF exist", async () => {
    const agent = createTextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: false,
      pageCount: null,
      forceOcr: false,
      ocrStatus: null
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.sourceUnavailable).toBe(true);
    expect(result.reason).toBe("source_unavailable");
  });
});
```

## documentVisionParser.agent.test.js

```js
describe("DocumentVisionParserAgent", () => {
  it("requires OpenRouter API key", async () => {
    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient: mockOpenRouterVisionClient(),
      config: {
        openRouterApiKey: "",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    await expect(
      agent.run({
        triage: { requiresOcr: true },
        fetched: { pdfExists: true, pageImages: ["page-001.png"] },
        folders: mockFolders()
      })
    ).rejects.toThrow(/OPENROUTER_API_KEY/i);
  });

  it("calls OpenRouterVisionClient when OCR is required", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn().mockResolvedValue({
        page: 1,
        transcribedText: "Plaintiff moves to compel discovery.",
        layoutSummary: {
          hasHeader: true,
          hasFooter: false,
          hasTable: false,
          hasSignatureBlock: false,
          hasHandwriting: false,
          hasSealOrStamp: false,
          hasExhibitLabel: false
        },
        legalHints: {
          possibleDocumentType: "motion",
          possibleMotionType: "motion_to_compel",
          partyNames: ["Plaintiff"],
          attorneyNames: [],
          courtNames: [],
          dates: [],
          legalTerms: ["discovery"]
        },
        reviewFlags: [],
        confidence: {
          text: 0.86,
          layout: 0.8,
          legalHints: 0.72
        }
      })
    };

    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient,
      config: {
        openRouterApiKey: "test",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    const result = await agent.run({
      triage: {
        requiresOcr: true,
        reason: "plain_text_missing"
      },
      fetched: {
        pdfExists: true,
        pageImages: ["pages/page-001.png"]
      },
      folders: mockFolders()
    });

    expect(openRouterVisionClient.parsePageImage).toHaveBeenCalledTimes(1);
    expect(result.usedOcr).toBe(true);
    expect(result.provider).toBe("qwen_vl");
  });

  it("does not call Qwen-VL when RECAP plain text is usable", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn()
    };

    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient,
      config: {
        openRouterApiKey: "test",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    const result = await agent.run({
      triage: {
        requiresOcr: false,
        reason: "plain_text_usable"
      },
      fetched: {
        plainText: "Usable RECAP text ".repeat(500),
        plainTextExists: true
      },
      folders: mockFolders()
    });

    expect(openRouterVisionClient.parsePageImage).not.toHaveBeenCalled();
    expect(result.usedOcr).toBe(false);
  });

  it("marks bboxAvailable=false when model does not return coordinates", async () => {
    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient: mockQwenVlClientWithoutBboxes(),
      config: {
        openRouterApiKey: "test",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    const result = await agent.run(mockOcrRequiredInput());

    expect(result.bboxAvailable).toBe(false);
    expect(result.coordinateReviewPrecision).toBe("page_level_only");
  });

  it("creates page-level signature flag from Qwen-VL response", async () => {
    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient: mockQwenVlClient({
        reviewFlags: [
          {
            flagType: "signature_possible",
            severity: "medium",
            page: 2,
            reason: "Likely signature block detected.",
            confidence: 0.81,
            bboxAvailable: false,
            bbox: null
          }
        ]
      }),
      config: {
        openRouterApiKey: "test",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    const result = await agent.run(mockOcrRequiredInput());

    expect(result.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flagType: "signature_possible",
          page: 2,
          bboxAvailable: false
        })
      ])
    );
  });

  it("fails clearly on OpenRouter error without fallback model", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn().mockRejectedValue(new Error("OpenRouter failed"))
    };

    const agent = createDocumentVisionParserAgent({
      openRouterVisionClient,
      config: {
        openRouterApiKey: "test",
        qwenVlModel: "qwen/qwen3-vl-8b-instruct"
      }
    });

    await expect(agent.run(mockOcrRequiredInput()))
      .rejects
      .toThrow(/OpenRouter failed/i);

    expect(openRouterVisionClient.parsePageImage).toHaveBeenCalledTimes(1);
  });
});
```

## reviewFlag.agent.test.js

```js
describe("ReviewFlagAgent", () => {
  it("flags possible signature blocks as page-level Qwen-VL flags", async () => {
    const agent = createReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        pages: [
          {
            page: 3,
            text: "Respectfully submitted,\n/s/ John Smith\nAttorney for Defendant"
          }
        ],
        provider: "qwen_vl",
        bboxAvailable: false
      },
      metadata: {}
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "signature_possible")).toBe(true);
    expect(result.flags[0].bboxAvailable).toBe(false);
  });
});
```

## legalExtraction.agent.test.js

```js
describe("LegalExtractionAgent", () => {
  it("requires OpenRouter API key", async () => {
    const agent = createLegalExtractionAgent({
      openRouterTextClient: mockOpenRouterTextClient(),
      config: {
        openRouterApiKey: "",
        legalExtractionModel: "qwen/qwen3.6-35b-a3b-instruct"
      }
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] }
      })
    ).rejects.toThrow(/OPENROUTER_API_KEY/i);
  });

  it("returns strict legal extraction JSON", async () => {
    const agent = createLegalExtractionAgent({
      openRouterTextClient: mockStrictJsonTextClient(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "qwen/qwen3.6-35b-a3b-instruct"
      }
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith moves to compel discovery responses by July 1, 2026."
      },
      annotations: {
        annotations: []
      },
      metadata: {
        caseName: "Smith v. Hospital Corp",
        courtId: "nysd",
        docketNumber: "1:26-cv-12345"
      },
      review: {
        reviewRequired: false,
        flags: []
      }
    });

    expect(result.document.caseName).toBe("Smith v. Hospital Corp");
    expect(Array.isArray(result.parties)).toBe(true);
    expect(Array.isArray(result.dates)).toBe(true);
    expect(Array.isArray(result.legalTerms)).toBe(true);
    expect(result.confidence).toBeDefined();
  });

  it("fails clearly on model error without fallback model", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockRejectedValue(new Error("model failed"))
    };

    const agent = createLegalExtractionAgent({
      openRouterTextClient,
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "qwen/qwen3.6-35b-a3b-instruct"
      }
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] }
      })
    ).rejects.toThrow(/model failed/i);

    expect(openRouterTextClient.extractLegalJson).toHaveBeenCalledTimes(1);
  });
});
```

## frontend test skeleton

```js
describe("RECAP Import frontend", () => {
  it("renders simple operator console only", () => {
    render(<RecapImportPage />);

    expect(screen.getByText(/RECAP Import Console/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Search terms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/OCR mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Import Job/i)).toBeInTheDocument();
  });

  it("does not render internal backend artifact names", () => {
    render(<RecapImportPage />);

    expect(screen.queryByText(/source\.pdf/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parsed\.md/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/layout_boxes\.json/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/extracted_legal\.json/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prompt_eval_versions\.json/i)).not.toBeInTheDocument();
  });
});
```

</details>

---

<details>
<summary>16. Implementation Plan</summary>

## Phase 1: Red tests and contracts

1. Add route tests.
2. Add agent contract tests.
3. Add queue tests.
4. Add text triage tests.
5. Add Qwen-VL parser tests.
6. Add frontend-safe response test.
7. Confirm tests fail.

## Phase 2: Config and guardrails

1. Add minimal `.env.example`.
2. Add config service.
3. Validate required credentials.
4. Hard-disable PACER purchase and RECAP Fetch.
5. Reject runtime fixture/fallback mode.

## Phase 3: Backend route + job creation

1. Implement routes.
2. Implement validation.
3. Implement local job repository.
4. Implement local task repository.
5. Return job id.

## Phase 4: CourtListener search + queue

1. Implement CourtListener client.
2. Implement token auth.
3. Implement search agent.
4. Implement queue agent.
5. Enforce concurrency 1.

## Phase 5: Folder + metadata

1. Implement metadata agent.
2. Implement folder agent.
3. Write source metadata.
4. Write initial manifests.

## Phase 6: Fetch + triage

1. Implement fetch agent.
2. Save plain text.
3. Download PDF when available.
4. Implement text triage.
5. Add OCR decision artifacts.

## Phase 7: Qwen-VL parser

1. Implement OpenRouter vision client.
2. Implement PDF-to-image utility.
3. Implement document vision parser agent.
4. Save parsed outputs.
5. Save page-level review flags.
6. No fallback model.

## Phase 8: Review + extraction

1. Implement review flag agent.
2. Implement legal annotation agent.
3. Implement OpenRouter text client.
4. Implement legal extraction agent.
5. Save strict JSON.

## Phase 9: Manifest + eval metadata

1. Implement manifest agent.
2. Save prompt/eval/schema versions.
3. Save run traces.

## Phase 10: Frontend

1. Create `/recap-import`.
2. Add simple form.
3. Add job polling.
4. Show folder path only.
5. Hide internals.

## Phase 11: Integration test

1. Mock 3-document CourtListener job.
2. Mock Qwen-VL parser response.
3. Mock legal extraction response.
4. Process queue sequentially.
5. Confirm folder outputs.
6. Confirm frontend-safe response.

</details>

---

<details>
<summary>17. Acceptance Criteria</summary>

## Functional

- User can submit RECAP search terms.
- User can choose target count up to 100.
- Backend uses real CourtListener API.
- Backend requires CourtListener token.
- Backend requires OpenRouter API key.
- Backend creates import job.
- Backend creates document tasks.
- Queue processes one document at a time.
- Documents are filed into local case folders.
- Each document has metadata.
- Existing RECAP text is used when available.
- Qwen-VL runs only when required or forced.
- Review flags are saved.
- Legal annotations are saved.
- Legal extraction JSON is saved.
- Manifests are saved.
- Frontend shows job status and output folder path.

## Frontend

Frontend shows:

```text
search form
job status
processed/failed/review counts
current document
output folder path
open/copy folder actions
```

Frontend does not show:

```text
internal stack names
internal file names
prompt/eval metadata
OCR boxes
extraction schema
mini-agent details
```

## Tests

All new tests pass.

Minimum required:

```text
route tests
queue tests
folder naming tests
metadata tests
fetch tests
triage tests
Qwen-VL parser tests
OpenRouter client tests
review flag tests
annotation tests
extraction schema tests
manifest tests
frontend tests
integration test with mocked CourtListener + mocked OpenRouter clients
```

</details>

---

<details>
<summary>18. Final Guardrails for Codex/OpenCode</summary>

Do:

```text
write red tests first
keep frontend simple
make agents modular
use strict schemas
process queue one document at a time
preserve source metadata
write manifests
save prompt/eval/schema versions
annotate aggressively in backend artifacts
mark uncertainty honestly
return only folder paths to frontend
save all files locally in repo
use CourtListener API token
use OpenRouter API key
use Qwen-VL as MVP parser
```

Do not:

```text
build a browser crawler
use RECAP extension
buy PACER documents
use RECAP Fetch
use Supabase
use remote storage
show backend internals in frontend
turn agents into autonomous chatbots
skip tests
skip manifests
force OCR on every document by default
invent legal facts
hide source uncertainty
use runtime fixtures
use fallback models
silently fake API results
```

Core principle:

```text
The frontend is the control panel.
The backend agents are the workers.
The queue controls execution.
The folder is the product.
The manifests make it trustworthy.
The tests/evals keep it from drifting.
```

</details>
