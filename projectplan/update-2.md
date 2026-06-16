# Handoff: Build Automatic CourtListener/RECAP Litigation Document Harvester

## Goal

Build an automated local-first ingestion pipeline that can retrieve thousands of real litigation documents from CourtListener/RECAP without assuming every search result has a PDF.

The system must:

1. Search CourtListener RECAP filing documents, not case law.
2. Respect API rate limits through a persistent throttled queue.
3. Cache every API response locally.
4. Resume from previous runs without duplicating work.
5. Detect whether a PDF is actually available.
6. Download PDFs only when `is_available === true` and `filepath_local` exists.
7. Save plain text when available.
8. Mark unavailable documents explicitly.
9. Support batch query plans by court, document type, nature of suit, and date window.
10. Be test-driven: write failing tests first, then implement.

This is for local repo storage only. Do not add Supabase, Hades storage, vector DB, or external database unless already present. Save files under a local data directory.

---

## Important Context

CourtListener has multiple search/data modes.

Use RECAP/PACER document search, not opinion search.

Relevant concept:

```txt
type=rd = RECAP filing documents / PACER documents
type=r  = RECAP dockets
type=o  = opinions / case law
```

The prior pasted example was an appellate opinion. That is useful for rule extraction, but it is not the target for this harvester.

This harvester targets litigation filings such as:

```txt
complaint
amended complaint
notice of removal
answer
motion to dismiss
memorandum in support
opposition
reply
motion for summary judgment
statement of material facts
declaration
affidavit
exhibit
motion to compel
discovery letter
protective order
scheduling order
case management order
stipulation
notice of settlement
stipulation of dismissal
order
```

---

## Core Rule

Never assume a PDF exists.

Required decision logic:

```js
if (doc.is_available === true && doc.filepath_local) {
  enqueuePdfDownload(doc);
} else if (doc.plain_text && doc.plain_text.trim().length > 0) {
  savePlainTextOnly(doc);
} else {
  markUnavailable(doc);
}
```

PDF download URL should be derived from:

```js
https://storage.courtlistener.com/${filepath_local}
```

Do not hit this URL unless `filepath_local` exists.

---

## Local Directory Layout

Create this structure if missing:

```txt
data/
  courtlistener/
    queries/
      query-plan.json
      query-state.json
    api-cache/
      search/
      documents/
    metadata/
      recap_documents.jsonl
      unavailable_documents.jsonl
      download_manifest.jsonl
    pdfs/
      {court_id}/
    text/
      {court_id}/
    logs/
      harvester.log
```

Use JSONL for append-friendly local storage.

---

## Environment Variables

Add only these if not already present:

```env
COURTLISTENER_API_TOKEN=
COURTLISTENER_API_BASE_URL=https://www.courtlistener.com
COURTLISTENER_STORAGE_BASE_URL=https://storage.courtlistener.com
COURTLISTENER_DATA_DIR=./data/courtlistener
COURTLISTENER_REQUESTS_PER_MINUTE=4
COURTLISTENER_REQUESTS_PER_HOUR=45
COURTLISTENER_REQUESTS_PER_DAY=100
COURTLISTENER_PDF_DOWNLOAD_CONCURRENCY=2
```

Defaults should be conservative. Do not hardcode aggressive limits.

---

## Query Plan

Create a query-plan generator that expands document buckets across court/date/nature-of-suit slices.

Example default courts:

```js
const DEFAULT_COURTS = [
  "nysd",
  "nyed",
  "cand",
  "ded",
  "txsd",
  "dcd",
  "ilnd"
];
```

Example document buckets:

```js
const DOCUMENT_BUCKETS = {
  pleadings: [
    "complaint",
    "amended complaint",
    "answer",
    "notice of removal"
  ],
  motion_to_dismiss: [
    "motion to dismiss",
    "memorandum in support",
    "opposition",
    "reply"
  ],
  summary_judgment: [
    "motion for summary judgment",
    "statement of material facts",
    "declaration",
    "affidavit"
  ],
  discovery_orders: [
    "motion to compel",
    "discovery letter",
    "protective order",
    "scheduling order",
    "case management order"
  ],
  resolution: [
    "notice of settlement",
    "stipulation of dismissal",
    "order",
    "judgment"
  ]
};
```

Example nature-of-suit buckets:

```js
const NATURE_OF_SUIT_BUCKETS = [
  "Civil Rights",
  "Labor",
  "Contract",
  "Patent",
  "Securities",
  "Personal Injury"
];
```

Query windows should be monthly or quarterly, configurable.

Each query unit should look like:

```json
{
  "id": "nysd_pleadings_civil-rights_2024-01",
  "type": "rd",
  "court_id": "nysd",
  "bucket": "pleadings",
  "nature_of_suit": "Civil Rights",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31",
  "status": "pending",
  "next_url": null,
  "completed": false,
  "results_seen": 0,
  "documents_saved": 0,
  "pdfs_queued": 0,
  "pdfs_downloaded": 0,
  "errors": []
}
```

---

## Search Query Builder

Implement a query builder that produces CourtListener search params for RECAP documents.

Target shape:

```txt
/api/rest/v4/search/?type=rd&q=...
```

The `q` should include:

```txt
description terms
court_id
nature of suit if supported
entry date range if supported
is_available:true when only PDFs are requested
```

Make filters configurable because CourtListener field names may vary by endpoint. Do not spread field-name assumptions everywhere. Centralize them in one adapter.

Required adapter file:

```txt
src/courtlistener/courtlistenerSearchAdapter.js
```

It should expose:

```js
buildRecapDocumentSearchUrl(queryUnit)
normalizeSearchResult(rawResult)
extractRecapDocumentFields(rawResult)
```

---

## Normalized Document Shape

Every result should be normalized into this shape:

```js
{
  source: "courtlistener_recap",
  recap_document_id: string | null,
  docket_id: string | null,
  court_id: string | null,
  docket_number: string | null,
  case_name: string | null,
  document_number: string | null,
  attachment_number: string | null,
  description: string | null,
  short_description: string | null,
  document_type: string | null,
  nature_of_suit: string | null,
  entry_date_filed: string | null,
  absolute_url: string | null,
  is_available: boolean,
  filepath_local: string | null,
  plain_text: string | null,
  page_count: number | null,
  sha1: string | null,
  download_url: string | null,
  local_pdf_path: string | null,
  local_text_path: string | null,
  availability_status: "pdf_available" | "text_only" | "metadata_only" | "unavailable"
}
```

`download_url` must only be populated when `filepath_local` exists.

---

## Rate Limiter

Implement a persistent rate limiter, not an in-memory-only delay.

Required behavior:

1. Track API request timestamps in local state.
2. Enforce per-minute, per-hour, and per-day limits.
3. If limit would be exceeded, pause the queue.
4. Save state before and after every API request.
5. Retry 429, 500, 502, 503, 504 with exponential backoff.
6. Do not retry 401/403 forever.
7. Do not make duplicate API requests when cached response already exists.

Required file:

```txt
src/courtlistener/rateLimiter.js
```

Expected API:

```js
await rateLimiter.waitForSlot("courtlistener_api");
await rateLimiter.recordRequest("courtlistener_api");
```

State file:

```txt
data/courtlistener/queries/query-state.json
```

---

## API Cache

Every API request must be cached by deterministic hash of method + URL + params.

Required file:

```txt
src/courtlistener/apiCache.js
```

Expected behavior:

```js
const cached = await apiCache.get(url);
if (cached) return cached;

const response = await fetch(url, headers);
await apiCache.set(url, responseJson);
return responseJson;
```

Do not re-fetch cached pages unless a `--refresh` flag is passed.

---

## PDF Download Queue

PDF downloads should be separate from API discovery.

Required behavior:

1. Read `download_manifest.jsonl`.
2. Skip already-downloaded files.
3. Download only when `download_url` exists.
4. Use low concurrency, default `2`.
5. Save PDF to:

```txt
data/courtlistener/pdfs/{court_id}/{recap_document_id}.pdf
```

6. Save text to:

```txt
data/courtlistener/text/{court_id}/{recap_document_id}.txt
```

7. Write a manifest row with status:

```json
{
  "recap_document_id": "123",
  "download_url": "https://storage.courtlistener.com/recap/...",
  "local_pdf_path": "data/courtlistener/pdfs/nysd/123.pdf",
  "status": "downloaded",
  "attempts": 1,
  "error": null
}
```

If PDF download fails, keep the row and mark:

```json
{
  "status": "failed",
  "attempts": 3,
  "error": "HTTP 403"
}
```

---

## CLI Commands

Add CLI commands:

```bash
npm run courtlistener:plan
npm run courtlistener:harvest
npm run courtlistener:download-pdfs
npm run courtlistener:status
```

Expected usage:

```bash
npm run courtlistener:plan -- --from=2024-01-01 --to=2024-12-31 --courts=nysd,nyed --target=5000

npm run courtlistener:harvest -- --target=5000

npm run courtlistener:download-pdfs

npm run courtlistener:status
```

`status` should show:

```txt
Query units total:
Pending:
Running:
Completed:
API requests today:
Documents discovered:
PDF available:
Text only:
Unavailable:
PDFs downloaded:
PDF download failed:
```

---

## TDD Requirement

Write failing tests first. Do not implement until these tests fail for the expected reason.

Use the repo’s existing test framework. If none exists, use Vitest.

---

## Red Tests

### 1. Does not download PDF when unavailable

```js
it("does not enqueue PDF download when is_available is false even if result has metadata", async () => {
  const result = {
    id: "rd_1",
    is_available: false,
    filepath_local: null,
    plain_text: null,
    description: "Complaint"
  };

  const normalized = normalizeSearchResult(result);
  const decision = decideDocumentStorage(normalized);

  expect(decision.action).toBe("mark_unavailable");
  expect(decision.download_url).toBeNull();
});
```

---

### 2. Downloads only when filepath_local exists

```js
it("enqueues PDF download only when is_available true and filepath_local exists", async () => {
  const result = {
    id: "rd_2",
    is_available: true,
    filepath_local: "recap/gov.uscourts.nysd.123/gov.uscourts.nysd.123.1.0.pdf",
    plain_text: "Complaint text",
    court_id: "nysd"
  };

  const normalized = normalizeSearchResult(result);
  const decision = decideDocumentStorage(normalized);

  expect(decision.action).toBe("enqueue_pdf_download");
  expect(decision.download_url).toBe(
    "https://storage.courtlistener.com/recap/gov.uscourts.nysd.123/gov.uscourts.nysd.123.1.0.pdf"
  );
});
```

---

### 3. Saves text-only documents

```js
it("saves plain text when PDF is unavailable but plain_text exists", async () => {
  const result = {
    id: "rd_3",
    is_available: false,
    filepath_local: null,
    plain_text: "This is usable filing text.",
    court_id: "nysd"
  };

  const normalized = normalizeSearchResult(result);
  const decision = decideDocumentStorage(normalized);

  expect(decision.action).toBe("save_text_only");
  expect(decision.text).toContain("usable filing text");
});
```

---

### 4. Builds only RECAP document search, not opinion search

```js
it("builds search URLs using type=rd and never type=o", () => {
  const queryUnit = {
    court_id: "nysd",
    bucket: "pleadings",
    terms: ["complaint", "amended complaint"],
    date_from: "2024-01-01",
    date_to: "2024-01-31"
  };

  const url = buildRecapDocumentSearchUrl(queryUnit);

  expect(url).toContain("type=rd");
  expect(url).not.toContain("type=o");
});
```

---

### 5. Query plan expands courts, buckets, and dates

```js
it("generates query units across courts, document buckets, and monthly date windows", () => {
  const plan = generateQueryPlan({
    courts: ["nysd", "nyed"],
    buckets: {
      pleadings: ["complaint"],
      discovery: ["motion to compel"]
    },
    from: "2024-01-01",
    to: "2024-02-29"
  });

  expect(plan.length).toBe(8);
  expect(plan[0]).toMatchObject({
    type: "rd",
    status: "pending",
    completed: false
  });
});
```

Explanation: 2 courts × 2 buckets × 2 months = 8.

---

### 6. API cache prevents duplicate calls

```js
it("returns cached API response without calling fetch again", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [{ id: "rd_1" }] })
  });

  const url = "https://www.courtlistener.com/api/rest/v4/search/?type=rd&q=complaint";

  const first = await cachedFetch(url, { fetchImpl: fetchMock });
  const second = await cachedFetch(url, { fetchImpl: fetchMock });

  expect(first).toEqual(second);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
```

---

### 7. Rate limiter blocks when daily limit reached

```js
it("does not allow API request when daily limit is reached", async () => {
  const limiter = createRateLimiter({
    perMinute: 4,
    perHour: 45,
    perDay: 2,
    now: () => new Date("2026-06-15T12:00:00Z")
  });

  await limiter.recordRequest("courtlistener_api");
  await limiter.recordRequest("courtlistener_api");

  const allowed = await limiter.canRequest("courtlistener_api");

  expect(allowed).toBe(false);
});
```

---

### 8. Harvester persists cursor/next page state

```js
it("persists next_url so harvesting can resume after interruption", async () => {
  const queryUnit = {
    id: "nysd_pleadings_2024-01",
    status: "running",
    next_url: null
  };

  const apiResponse = {
    next: "https://www.courtlistener.com/api/rest/v4/search/?type=rd&page=2",
    results: [{ id: "rd_1" }]
  };

  const updated = updateQueryUnitAfterPage(queryUnit, apiResponse);

  expect(updated.next_url).toBe(apiResponse.next);
  expect(updated.status).toBe("pending");
  expect(updated.completed).toBe(false);
});
```

---

### 9. Harvester marks query complete when no next page

```js
it("marks query unit completed when API response has no next page", () => {
  const queryUnit = {
    id: "nysd_pleadings_2024-01",
    status: "running",
    next_url: "some-url",
    completed: false
  };

  const apiResponse = {
    next: null,
    results: [{ id: "rd_1" }]
  };

  const updated = updateQueryUnitAfterPage(queryUnit, apiResponse);

  expect(updated.next_url).toBeNull();
  expect(updated.status).toBe("completed");
  expect(updated.completed).toBe(true);
});
```

---

### 10. PDF downloader skips existing local file

```js
it("skips PDF download when local file already exists", async () => {
  const fileExists = vi.fn().mockResolvedValue(true);
  const fetchMock = vi.fn();

  const job = {
    recap_document_id: "rd_1",
    download_url: "https://storage.courtlistener.com/recap/test.pdf",
    local_pdf_path: "data/courtlistener/pdfs/nysd/rd_1.pdf"
  };

  const result = await downloadPdfJob(job, { fileExists, fetchImpl: fetchMock });

  expect(result.status).toBe("skipped_existing");
  expect(fetchMock).not.toHaveBeenCalled();
});
```

---

### 11. Failed PDF download is recorded, not lost

```js
it("records failed PDF downloads with attempts and error", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    statusText: "Forbidden"
  });

  const job = {
    recap_document_id: "rd_2",
    download_url: "https://storage.courtlistener.com/recap/forbidden.pdf",
    local_pdf_path: "data/courtlistener/pdfs/nysd/rd_2.pdf",
    attempts: 0
  };

  const result = await downloadPdfJob(job, { fetchImpl: fetchMock });

  expect(result.status).toBe("failed");
  expect(result.attempts).toBe(1);
  expect(result.error).toContain("403");
});
```

---

### 12. Status command reports counts from local files

```js
it("computes local harvester status from query state and manifests", async () => {
  const status = computeHarvesterStatus({
    queryUnits: [
      { status: "completed" },
      { status: "pending" }
    ],
    documents: [
      { availability_status: "pdf_available" },
      { availability_status: "text_only" },
      { availability_status: "unavailable" }
    ],
    downloads: [
      { status: "downloaded" },
      { status: "failed" }
    ]
  });

  expect(status.completedQueries).toBe(1);
  expect(status.pendingQueries).toBe(1);
  expect(status.pdfAvailable).toBe(1);
  expect(status.textOnly).toBe(1);
  expect(status.unavailable).toBe(1);
  expect(status.pdfsDownloaded).toBe(1);
  expect(status.pdfDownloadFailed).toBe(1);
});
```

---

## Implementation Files

Add or update:

```txt
src/courtlistener/
  courtlistenerClient.js
  courtlistenerSearchAdapter.js
  queryPlanGenerator.js
  queryStateStore.js
  apiCache.js
  rateLimiter.js
  documentDecision.js
  metadataStore.js
  pdfDownloadQueue.js
  statusReporter.js

scripts/
  courtlistener-plan.js
  courtlistener-harvest.js
  courtlistener-download-pdfs.js
  courtlistener-status.js

tests/courtlistener/
  courtlistenerSearchAdapter.test.js
  queryPlanGenerator.test.js
  apiCache.test.js
  rateLimiter.test.js
  documentDecision.test.js
  pdfDownloadQueue.test.js
  harvesterState.test.js
  statusReporter.test.js
```

---

## Acceptance Criteria

The task is complete only when:

1. All red tests above exist.
2. Tests fail before implementation for the expected missing behavior.
3. Implementation passes all tests.
4. `npm run courtlistener:plan` creates a local query plan.
5. `npm run courtlistener:harvest` discovers RECAP filing documents safely.
6. Harvester does not assume every result has a PDF.
7. Harvester saves metadata for every result.
8. Harvester queues PDFs only when `is_available === true` and `filepath_local` exists.
9. `npm run courtlistener:download-pdfs` downloads queued PDFs with low concurrency.
10. Existing PDFs are skipped.
11. Failed downloads are recorded.
12. Re-running the same commands does not duplicate documents or API requests.
13. `npm run courtlistener:status` shows useful progress counts.
14. No Supabase, no external DB, no vector DB, no Hades UI work.

---

## Non-Goals

Do not implement:

```txt
OCR
LLM extraction
embeddings
Supabase storage
auth
frontend UI
legal ontology extraction
case-law opinion ingestion
PACER paid fetch
NYSCEF scraping
```

This slice is only the automatic RECAP discovery/cache/download foundation.

---

## Current Working Note

This is not expected to instantly download every litigation PDF. RECAP coverage is partial. The correct behavior is to harvest what is available, save what is text-only, and explicitly record what is unavailable. The value of this slice is reliable automated collection, not perfect legal-document coverage.
