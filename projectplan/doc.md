# RECAP Import Architecture Contract + Codex Handoff

Date: 2026-06-15  
Project: Hades Legal Document Pipeline  
Feature: RECAP Import Queue + Document Filing + OCR/Annotation/Extraction  
Build mode: TDD-first  
Architecture mode: strict modular backend agents, simple frontend operator console  

---

## Summary

Build a RECAP document importer that lets the user search CourtListener/RECAP, request a target number of documents such as 10 or 100, queue those documents **one at a time**, process them through the legal document pipeline, and save everything into properly filed case folders.

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

The frontend must **not** expose internal agents, stack file names, OCR boxes, extraction schemas, prompt versions, or backend artifacts.

The backend does the actual work:

```text
RECAP search
-> queue document tasks
-> normalize metadata
-> create case folders
-> fetch source text/PDF
-> decide whether OCR is required
-> run OCR only when needed or forced
-> annotate aggressively
-> flag human review issues
-> extract strict legal JSON
-> write manifests/eval metadata
-> return folder path/status to frontend
```

---

## Non-Negotiable Architecture Contract

Codex must follow this architecture exactly unless explicitly instructed otherwise.

```text
Frontend = simple operator console
Backend = modular agents/services
Queue = one document at a time
Folder = actual product output
Manifests = source of traceability
Evals/tests = required per agent
```

Do not turn this into:

```text
a browser crawler
a PACER buying tool
a full legal research platform
a complex file explorer
a giant autonomous agent
a LangGraph rewrite
a frontend agent explainer
```

---

<details>
<summary>1. Strict Product Scope</summary>

## Goal

Create a working MVP that imports legal documents from CourtListener/RECAP into Hades and files them into case folders.

User enters:

```json
{
  "searchTerms": "medical malpractice expert report motion to compel",
  "court": "optional",
  "targetCount": 100,
  "ocrMode": "recap_text_first"
}
```

System behavior:

1. Search CourtListener/RECAP.
2. Collect up to `targetCount` matching document candidates.
3. Deduplicate candidates.
4. Create an import job.
5. Create document tasks.
6. Process document tasks one at a time.
7. Save each document into a case folder.
8. Preserve source metadata.
9. Use CourtListener plain text when usable.
10. Download source PDF when available.
11. Run PaddleOCR only when required or forced.
12. Annotate as much as possible inside backend artifacts.
13. Flag handwriting, signatures, low-confidence OCR, bad pages, missing source, and uncertain extraction.
14. Save strict extracted JSON.
15. Save manifests and prompt/eval versions.
16. Return only folder path/status to frontend.

## Explicit non-goals

Do not implement in MVP:

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
public sharing
multi-user permission model beyond existing auth
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

The frontend should consume this kind of API response:

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

## Guardrail

If backend has many internal files, frontend still shows only:

```text
Output folder: data/recap-imports/<case-folder>/
```

</details>

---

<details>
<summary>3. Backend Module Layout</summary>

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
    ocr.agent.js
    reviewFlag.agent.js
    legalAnnotation.agent.js
    legalExtraction.agent.js
    manifest.agent.js

  clients/
    courtListener.client.js
    paddleOcr.client.js

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
```

Each agent must be a modular service with this shape:

```text
input DTO -> run() -> output DTO -> write artifacts if responsible -> return status
```

No agent should return loose prose to another backend step.

</details>

---

<details>
<summary>4. Agent Contract Rule</summary>

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
```

</details>

---

<details>
<summary>5. Agents to Build</summary>

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
build CourtListener search query
page through results until target count or no more results
dedupe by recapDocumentId / docketEntryId / absoluteUrl
prefer documents with plain text or PDF availability
preserve source metadata
do not trigger PACER purchase
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

### Evals/tests

```text
returns up to targetCount
dedupes duplicate documents
preserves source IDs
does not call PACER purchase flow
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

### Evals/tests

```text
only one task runs at a time
pending tasks remain pending when one is running
failed task records error
review_needed task increments review count
duplicate task is skipped
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

### Evals/tests

```text
preserves all known fields
handles missing optional fields
does not drop raw source payload
normalizes IDs as strings
```

---

## 4. Case Folder Agent

### Purpose

Create stable case and document folder paths.

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

### Evals/tests

```text
creates safe folder names
removes slashes
handles punctuation
dedupes collisions
returns stable path for same input
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

### Evals/tests

```text
saves plain text
downloads PDF when available
does not download when unavailable
marks source unavailable
writes hashes
```

---

## 6. Text Triage Agent

### Purpose

Decide whether PaddleOCR is required.

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

### OCR trigger formula

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

### OCR trigger details

| Trigger | Reason |
|---|---|
| `forceOcr=true` | User explicitly requested OCR on every document. |
| No CourtListener `plain_text` | There is no usable text to extract from. |
| Empty or near-empty `plain_text` | Likely scanned PDF or failed text extraction. |
| Text too short for page count | Example: 20-page PDF with only 500 characters. |
| Text looks garbled | Random symbols, broken words, repeated whitespace, extraction noise. |
| PDF exists but text is missing | Source likely needs OCR. |
| RECAP `ocr_status` is failed/incomplete/partial/unavailable | Existing OCR cannot be trusted. |
| Document likely needs layout parsing | Tables, forms, exhibits, charts, structured pages. |
| Coordinate review is needed | Signatures, handwriting, seals, stamps, low-confidence areas. |

### MVP thresholds

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

### Evals/tests

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

## 7. OCR Agent

### Purpose

Run PaddleOCR/PaddleOCR-VL when needed, or normalize existing text into parsed artifacts.

### Input

```json
{
  "requiresOcr": true,
  "pdfPath": "source/source.pdf",
  "plainTextPath": "source/courtlistener_plain_text.txt",
  "folders": {}
}
```

### Process

```text
if requiresOcr=true, run PaddleOCR
if requiresOcr=false, create parsed artifacts from existing plain text
split long PDFs by page/chunk
save parsed markdown
save page-level text
save layout boxes when available
save OCR confidence when available
save parser/model/runtime metadata
```

### Output

```json
{
  "parsedTextPath": "parsed/parsed.md",
  "parsedPagesPath": "parsed/parsed_pages.json",
  "layoutBoxesPath": "parsed/layout_boxes.json",
  "ocrQualityReportPath": "parsed/ocr_quality_report.json",
  "parser": "paddleocr-vl",
  "usedOcr": true
}
```

### Evals/tests

```text
uses OCR when triage requires it
skips OCR when text is usable
writes parsed.md
writes parsed_pages.json
writes layout_boxes.json when OCR returns boxes
records parser metadata
```

---

## 8. Human Review Flag Agent

### Purpose

Flag document/page/coordinate regions that need human review.

### Input

```json
{
  "parsedPages": [],
  "layoutBoxes": [],
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
      "bbox": {
        "x": 412,
        "y": 921,
        "w": 280,
        "h": 96
      },
      "reason": "Visual mark near signature block with sparse OCR text",
      "confidence": 0.82
    }
  ]
}
```

### Evals/tests

```text
flags low-confidence OCR boxes
flags possible signature blocks
flags possible handwriting
preserves page and bbox
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

### Evals/tests

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

Convert annotations and parsed text into strict legal JSON.

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

Output must be strict JSON.

No markdown.

No prose.

No unsupported facts.

Each extracted fact should include provenance when possible.

### Evals/tests

```text
returns valid JSON
matches schema
extracts parties/dates/legal terms
includes confidence object
includes review flags
does not return markdown prose
does not invent absent parties
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
parser version
OCR model version
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
    "promptContractVersion": "recap-legal-extraction-v1",
    "schemaVersion": "recap-extracted-legal-json-v1",
    "evalVersion": "recap-import-eval-v1"
  }
}
```

### Evals/tests

```text
writes manifest after success
writes manifest after review-needed
writes error manifest after failure
includes source IDs
includes version metadata
includes folder paths
```

</details>

---

<details>
<summary>6. Orchestrator Contract</summary>

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
    ocrAgent,
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
      ocrAgent,
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

      const parsed = await this.ocrAgent.run({
        triage,
        fetched,
        folders
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
```

</details>

---

<details>
<summary>7. Storage / Folder Contract</summary>

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
          layout_boxes.json
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
<summary>8. Database / Repository Contract</summary>

## recap_import_jobs

Fields:

```text
id
user_id
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
<summary>9. API Contract</summary>

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
<summary>10. Modern Agent Requirements</summary>

Every agent should support:

```text
input/output schema
versioned logic or prompt
eval/test
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
security/PII guard
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
Triage Agent decides OCR only.
OCR Agent parses text/layout only.
Review Flag Agent flags review issues only.
Annotation Agent annotates legal concepts only.
Extraction Agent writes strict legal JSON only.
Manifest Agent writes trace/version metadata only.
```

</details>

---

<details>
<summary>11. Eval Contract</summary>

Every agent must have at least one test or eval.

Use this rule:

```text
Deterministic agent -> unit/contract tests
OCR/LLM/annotation agent -> eval cases + golden outputs + confidence checks
Whole pipeline -> integration eval
```

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

  ocr-agent/
    scanned_pdf.eval.json
    table_layout.eval.json
    low_confidence_boxes.eval.json

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
<summary>12. Prompt / Schema / Version Metadata</summary>

Every extraction should save:

```json
{
  "promptContractVersion": "recap-legal-extraction-v1",
  "annotationPromptVersion": "legal-annotation-v1",
  "extractionPromptVersion": "legal-json-extraction-v1",
  "reviewFlagPromptVersion": "human-review-flags-v1",
  "schemaVersion": "recap-extracted-legal-json-v1",
  "evalVersion": "recap-import-eval-v1",
  "ocrParser": {
    "name": "paddleocr",
    "model": "paddleocr-vl",
    "version": "configured_runtime_version"
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
Mark OCR uncertainty.
Mark missing source data.
Return strict JSON only for JSON tasks.
Keep legal output assistive, not authoritative.
```

</details>

---

<details>
<summary>13. TDD Plan</summary>

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
ocr.agent.test.js
reviewFlag.agent.test.js
legalAnnotation.agent.test.js
legalExtraction.agent.test.js
manifest.agent.test.js
recapImport.integration.test.js
```

## Required tests

### Route tests

```text
creates import job from search terms
rejects targetCount over 100
defaults targetCount to 10
rejects missing searchTerms
returns frontend-safe job status
does not expose internal artifact file names
```

### Search agent tests

```text
returns up to targetCount
dedupes duplicate documents
preserves source IDs
handles empty result set
does not trigger PACER purchase
```

### Queue agent tests

```text
creates tasks from candidates
processes only one document at a time
marks complete
marks review_needed
marks failed with error
skips duplicate
```

### Metadata agent tests

```text
normalizes raw CourtListener fields
preserves raw payload
handles missing optional fields
keeps IDs stable as strings
```

### Folder agent tests

```text
creates safe case folder path
removes slashes
removes unsafe punctuation
dedupes collisions
creates document folder path
```

### Fetch agent tests

```text
saves plain text when available
downloads PDF when available
hashes PDF
marks sourceUnavailable when no PDF/text
does not buy PACER docs
```

### Text triage tests

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

### OCR agent tests

```text
runs OCR when required
skips OCR when text usable
writes parsed artifacts
records parser version
preserves page-level output
```

### Review flag tests

```text
flags low-confidence OCR boxes
flags possible signatures
flags possible handwriting
preserves bbox
sets reviewRequired
```

### Legal annotation tests

```text
annotates motion type
annotates parties
annotates dates
annotates legal terms
includes confidence
does not invent unsupported facts
```

### Legal extraction tests

```text
returns strict JSON
matches schema
includes confidence
includes review flags
includes provenance where available
does not return markdown
```

### Manifest tests

```text
writes document manifest
writes prompt/eval version metadata
records source IDs
records status
records errors
```

### Integration tests

```text
mock 3-document RECAP job
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
<summary>14. Red Test Skeletons</summary>

Adapt imports/paths to existing repo style.

## recapImport.routes.test.js

```js
describe("RECAP Import routes", () => {
  it("creates an import job from search terms", async () => {
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

  it("returns frontend-safe job status without internal file list", async () => {
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

## reviewFlag.agent.test.js

```js
describe("ReviewFlagAgent", () => {
  it("flags low-confidence OCR boxes", async () => {
    const agent = createReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        pages: [
          {
            page: 1,
            boxes: [
              {
                text: "garbled",
                confidence: 0.31,
                bbox: { x: 10, y: 20, w: 100, h: 40 }
              }
            ]
          }
        ]
      },
      metadata: {}
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags[0].flagType).toBe("low_confidence_ocr");
    expect(result.flags[0].bbox).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });

  it("flags possible signature blocks", async () => {
    const agent = createReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        pages: [
          {
            page: 3,
            text: "Respectfully submitted,\n/s/ John Smith\nAttorney for Defendant"
          }
        ]
      },
      metadata: {}
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "signature_possible")).toBe(true);
  });
});
```

## legalExtraction.agent.test.js

```js
describe("LegalExtractionAgent", () => {
  it("returns strict legal extraction JSON", async () => {
    const agent = createLegalExtractionAgent({
      model: mockStrictJsonModel()
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
});
```

</details>

---

<details>
<summary>15. Implementation Plan</summary>

## Phase 1: Red tests and contracts

1. Add route tests.
2. Add agent contract tests.
3. Add queue tests.
4. Add OCR triage tests.
5. Add frontend-safe response test.
6. Confirm tests fail.

## Phase 2: Backend route + job creation

1. Implement routes.
2. Implement validation.
3. Implement job repository.
4. Implement task repository.
5. Return job id.

## Phase 3: Search + queue

1. Implement CourtListener client interface.
2. Mock CourtListener in tests.
3. Implement search agent.
4. Implement queue agent.
5. Enforce concurrency 1.

## Phase 4: Folder + metadata

1. Implement metadata agent.
2. Implement folder agent.
3. Write source metadata.
4. Write initial manifests.

## Phase 5: Fetch + triage

1. Implement fetch agent.
2. Save plain text.
3. Download PDF when available.
4. Implement text triage.
5. Add OCR decision artifacts.

## Phase 6: OCR adapter

1. Implement OCR agent interface.
2. Mock OCR in tests.
3. Add PaddleOCR runtime adapter.
4. Save parsed outputs.

## Phase 7: Review + extraction

1. Implement review flag agent.
2. Implement legal annotation agent.
3. Implement legal extraction agent.
4. Save strict JSON.

## Phase 8: Manifest + eval metadata

1. Implement manifest agent.
2. Save prompt/eval/schema versions.
3. Save run traces.

## Phase 9: Frontend

1. Create `/recap-import`.
2. Add form.
3. Add job polling.
4. Show folder path only.
5. Hide internals.

## Phase 10: Integration eval

1. Mock 3-document job.
2. Mock 100-document queue.
3. Confirm sequential processing.
4. Confirm folder outputs.
5. Confirm frontend-safe response.

</details>

---

<details>
<summary>16. Acceptance Criteria</summary>

## Functional

- User can submit RECAP search terms.
- User can choose target count up to 100.
- Backend creates import job.
- Backend creates document tasks.
- Queue processes one document at a time.
- Documents are filed into case folders.
- Each document has metadata.
- Existing RECAP text is used when available.
- OCR runs only when required or forced.
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
review flag tests
annotation tests
extraction schema tests
manifest tests
integration test with mocked RECAP + mocked OCR + mocked model
```

</details>

---

<details>
<summary>17. Final Guardrails for Codex</summary>

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
```

Do not:

```text
build a browser crawler
use RECAP extension
buy PACER documents
show backend internals in frontend
turn agents into autonomous chatbots
skip tests
skip manifests
force OCR on every document by default
invent legal facts
hide source uncertainty
```

Core principle:

```text
The frontend is the control panel.
The backend agents are the workers.
The queue controls execution.
The folder is the product.
The manifests make it trustworthy.
The evals keep it from drifting.
```

</details>
