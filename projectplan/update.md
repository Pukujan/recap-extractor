````md
# RECAP Importer Red Tests Pack

These are the actual red tests Codex/OpenCode should add **before implementation**.

Assumptions:
- Test runner: Vitest
- Backend HTTP tests: Supertest
- Frontend tests: React Testing Library
- Adjust import paths only if your repo structure differs.
- These tests should fail red first because the modules/routes/agents do not exist yet.
- Unit tests must use mocked clients only.
- Runtime must not use fixtures, fallback APIs, fallback docs, fallback models, Supabase, or remote storage.

Model decision:

```env
QWEN_VL_MODEL=qwen/qwen3-vl-8b-instruct
LEGAL_EXTRACTION_MODEL=deepseek/deepseek-v4-flash
```

---

## `backend/src/modules/recap-import/__tests__/config.service.test.js`

```js
import { describe, expect, it } from "vitest";
import { loadRecapImportConfig } from "../services/config.service.js";

const validEnv = {
  COURTLISTENER_API_BASE_URL: "https://www.courtlistener.com/api/rest/v4",
  COURTLISTENER_API_TOKEN: "test-courtlistener-token",
  RECAP_IMPORT_OUTPUT_ROOT: "./data/recap-imports",
  RECAP_IMPORT_MAX_TARGET_COUNT: "100",
  RECAP_IMPORT_QUEUE_CONCURRENCY: "1",
  OCR_PROVIDER: "qwen_vl",
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_API_BASE_URL: "https://openrouter.ai/api/v1",
  QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
  LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
  ALLOW_PACER_PURCHASE: "false",
  ALLOW_RECAP_FETCH: "false",
};

describe("recap import config", () => {
  it("loads valid local runtime config", () => {
    const config = loadRecapImportConfig(validEnv);

    expect(config.courtListener.baseUrl).toBe("https://www.courtlistener.com/api/rest/v4");
    expect(config.courtListener.token).toBe("test-courtlistener-token");
    expect(config.outputRoot).toBe("./data/recap-imports");
    expect(config.maxTargetCount).toBe(100);
    expect(config.queueConcurrency).toBe(1);
    expect(config.ocr.provider).toBe("qwen_vl");
    expect(config.ocr.qwenVlModel).toBe("qwen/qwen3-vl-8b-instruct");
    expect(config.legalExtraction.model).toBe("deepseek/deepseek-v4-flash");
    expect(config.safety.allowPacerPurchase).toBe(false);
    expect(config.safety.allowRecapFetch).toBe(false);
  });

  it("requires COURTLISTENER_API_TOKEN", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        COURTLISTENER_API_TOKEN: "",
      })
    ).toThrow(/COURTLISTENER_API_TOKEN/i);
  });

  it("requires OPENROUTER_API_KEY", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        OPENROUTER_API_KEY: "",
      })
    ).toThrow(/OPENROUTER_API_KEY/i);
  });

  it("requires QWEN_VL_MODEL", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        QWEN_VL_MODEL: "",
      })
    ).toThrow(/QWEN_VL_MODEL/i);
  });

  it("requires LEGAL_EXTRACTION_MODEL", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        LEGAL_EXTRACTION_MODEL: "",
      })
    ).toThrow(/LEGAL_EXTRACTION_MODEL/i);
  });

  it("rejects OCR provider other than qwen_vl for MVP", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        OCR_PROVIDER: "paddleocr",
      })
    ).toThrow(/OCR_PROVIDER.*qwen_vl/i);
  });

  it("rejects PACER purchase enabled", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        ALLOW_PACER_PURCHASE: "true",
      })
    ).toThrow(/PACER purchase.*disabled/i);
  });

  it("rejects RECAP Fetch enabled", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        ALLOW_RECAP_FETCH: "true",
      })
    ).toThrow(/RECAP Fetch.*disabled/i);
  });

  it("rejects runtime fixture mode", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        RECAP_IMPORT_USE_FIXTURES: "true",
      })
    ).toThrow(/fixtures.*tests only/i);
  });

  it("defaults queue concurrency to 1 even if omitted", () => {
    const { RECAP_IMPORT_QUEUE_CONCURRENCY, ...env } = validEnv;
    const config = loadRecapImportConfig(env);

    expect(config.queueConcurrency).toBe(1);
  });

  it("rejects queue concurrency greater than 1 for MVP", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        RECAP_IMPORT_QUEUE_CONCURRENCY: "3",
      })
    ).toThrow(/queue concurrency.*1/i);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/clients/courtListener.client.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { CourtListenerClient } from "../../clients/courtListener.client.js";

describe("CourtListenerClient", () => {
  it("uses CourtListener token auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
    });

    await client.searchRecap({
      searchTerms: "motion to compel",
      court: "nysd",
      page: 1,
      pageSize: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/search/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Token abc123",
        }),
      })
    );
  });

  it("builds search URL with query, court, page, and RECAP/PACER result type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
    });

    await client.searchRecap({
      searchTerms: "expert report",
      court: "nysd",
      page: 2,
      pageSize: 20,
    });

    const url = fetchMock.mock.calls[0][0];

    expect(url).toContain("/search/");
    expect(decodeURIComponent(url)).toContain("expert report");
    expect(url).toContain("nysd");
    expect(url).toMatch(/page=2|offset=/);
  });

  it("throws clear error on non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "bad-token",
      fetchImpl: fetchMock,
    });

    await expect(
      client.searchRecap({
        searchTerms: "motion",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toThrow(/CourtListener.*401/i);
  });

  it("does not expose PACER purchase or RECAP Fetch methods in MVP client", () => {
    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: vi.fn(),
    });

    expect(client.buyPacerDocument).toBeUndefined();
    expect(client.recapFetch).toBeUndefined();
    expect(client.prayAndPay).toBeUndefined();
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/clients/openRouterVision.client.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { OpenRouterVisionClient } from "../../clients/openRouterVision.client.js";

describe("OpenRouterVisionClient", () => {
  it("uses Qwen-VL model and sends image payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                page: 1,
                transcribedText: "Plaintiff moves to compel discovery.",
                layoutSummary: {
                  hasHeader: true,
                  hasFooter: false,
                  hasTable: false,
                  hasSignatureBlock: false,
                  hasHandwriting: false,
                  hasSealOrStamp: false,
                  hasExhibitLabel: false,
                },
                legalHints: {
                  possibleDocumentType: "motion",
                  possibleMotionType: "motion_to_compel",
                  partyNames: ["Plaintiff"],
                  attorneyNames: [],
                  courtNames: [],
                  dates: [],
                  legalTerms: ["discovery"],
                },
                reviewFlags: [],
                confidence: {
                  text: 0.86,
                  layout: 0.8,
                  legalHints: 0.72,
                },
              }),
            },
          },
        ],
      }),
    });

    const client = new OpenRouterVisionClient({
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct",
      fetchImpl: fetchMock,
    });

    const result = await client.parsePageImage({
      imageBase64: "abc123",
      prompt: "Return strict JSON",
    });

    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer openrouter-key");
    expect(body.model).toBe("qwen/qwen3-vl-8b-instruct");
    expect(body.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({ type: "image_url" }),
      ])
    );
    expect(result.page).toBe(1);
    expect(result.transcribedText).toContain("compel");
  });

  it("parses JSON even when model wraps content as string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"page":1,"transcribedText":"Text","layoutSummary":{},"legalHints":{},"reviewFlags":[],"confidence":{"text":0.8,"layout":0.7,"legalHints":0.5}}',
            },
          },
        ],
      }),
    });

    const client = new OpenRouterVisionClient({
      apiKey: "key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct",
      fetchImpl: fetchMock,
    });

    const result = await client.parsePageImage({
      imageBase64: "abc",
      prompt: "Return strict JSON",
    });

    expect(result.page).toBe(1);
    expect(result.transcribedText).toBe("Text");
  });

  it("rejects markdown-wrapped JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```json\n{\"page\":1}\n```",
            },
          },
        ],
      }),
    });

    const client = new OpenRouterVisionClient({
      apiKey: "key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct",
      fetchImpl: fetchMock,
    });

    await expect(
      client.parsePageImage({
        imageBase64: "abc",
        prompt: "Return strict JSON",
      })
    ).rejects.toThrow(/strict JSON/i);
  });

  it("throws clear error on OpenRouter failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => "Payment required",
    });

    const client = new OpenRouterVisionClient({
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct",
      fetchImpl: fetchMock,
    });

    await expect(
      client.parsePageImage({
        imageBase64: "abc",
        prompt: "Return JSON",
      })
    ).rejects.toThrow(/OpenRouter vision.*402/i);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/clients/openRouterText.client.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { OpenRouterTextClient } from "../../clients/openRouterText.client.js";

const validExtraction = {
  document: {
    documentType: "motion",
    filingType: "motion",
    description: "Motion to compel",
    court: "nysd",
    caseName: "Smith v. Hospital Corp",
    docketNumber: "1:26-cv-12345",
    recapDocumentId: "98765",
    dateFiled: "2026-06-01",
  },
  parties: [],
  attorneys: [],
  judges: [],
  dates: [],
  deadlines: [],
  motions: [],
  orders: [],
  claims: [],
  defenses: [],
  legalTerms: ["discovery"],
  citations: [],
  exhibits: [],
  medicalEntities: [],
  discoveryIssues: [],
  reviewFlags: [],
  confidence: {
    overall: 0.8,
    documentType: 0.75,
    entities: 0.7,
    dates: 0.7,
    legalIssues: 0.72,
  },
};

describe("OpenRouterTextClient", () => {
  it("uses DeepSeek V4 Flash for legal extraction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validExtraction),
            },
          },
        ],
      }),
    });

    const client = new OpenRouterTextClient({
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash",
      fetchImpl: fetchMock,
    });

    const result = await client.extractLegalJson({
      prompt: "Return strict JSON",
      input: "Plaintiff moves to compel discovery.",
      model: "deepseek/deepseek-v4-flash",
    });

    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer openrouter-key");
    expect(body.model).toBe("deepseek/deepseek-v4-flash");
    expect(result.document.caseName).toBe("Smith v. Hospital Corp");
    expect(result.legalTerms).toContain("discovery");
  });

  it("rejects markdown/prose response instead of strict JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Here is the JSON:\n```json\n{}\n```",
            },
          },
        ],
      }),
    });

    const client = new OpenRouterTextClient({
      apiKey: "key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash",
      fetchImpl: fetchMock,
    });

    await expect(
      client.extractLegalJson({
        prompt: "Return strict JSON",
        input: "Text",
        model: "deepseek/deepseek-v4-flash",
      })
    ).rejects.toThrow(/strict JSON/i);
  });

  it("throws clear error on DeepSeek/OpenRouter failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    const client = new OpenRouterTextClient({
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash",
      fetchImpl: fetchMock,
    });

    await expect(
      client.extractLegalJson({
        prompt: "Return strict JSON",
        input: "text",
        model: "deepseek/deepseek-v4-flash",
      })
    ).rejects.toThrow(/OpenRouter text.*429/i);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/recapSearch.agent.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { RecapSearchAgent } from "../../agents/recapSearch.agent.js";

describe("RecapSearchAgent", () => {
  it("requires CourtListener token", async () => {
    const agent = new RecapSearchAgent({
      courtListenerClient: { searchRecap: vi.fn() },
      config: {
        courtListener: { token: "" },
      },
    });

    await expect(
      agent.run({
        searchTerms: "motion to compel",
        targetCount: 10,
      })
    ).rejects.toThrow(/COURTLISTENER_API_TOKEN/i);
  });

  it("calls CourtListener client and returns candidates up to targetCount", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "2", docketEntryId: "b", absoluteUrl: "url-2", caseName: "C v D" },
          { recapDocumentId: "3", docketEntryId: "c", absoluteUrl: "url-3", caseName: "E v F" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
      },
    });

    const result = await agent.run({
      searchTerms: "motion to compel",
      court: "nysd",
      targetCount: 2,
    });

    expect(courtListenerClient.searchRecap).toHaveBeenCalled();
    expect(result.candidates).toHaveLength(2);
  });

  it("dedupes duplicate documents", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "2", docketEntryId: "b", absoluteUrl: "url-2", caseName: "C v D" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
      },
    });

    const result = await agent.run({
      searchTerms: "motion",
      targetCount: 10,
    });

    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map(c => c.recapDocumentId)).size).toBe(2);
  });

  it("does not trigger PACER purchase or RECAP Fetch", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({ results: [], next: null }),
      buyPacerDocument: vi.fn(),
      recapFetch: vi.fn(),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
        safety: {
          allowPacerPurchase: false,
          allowRecapFetch: false,
        },
      },
    });

    await agent.run({
      searchTerms: "expert report",
      targetCount: 10,
    });

    expect(courtListenerClient.buyPacerDocument).not.toHaveBeenCalled();
    expect(courtListenerClient.recapFetch).not.toHaveBeenCalled();
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/queue.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { QueueAgent } from "../../agents/queue.agent.js";

describe("QueueAgent", () => {
  it("creates tasks from candidates", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 2,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Complaint" },
      { recapDocumentId: "2", description: "Motion" },
    ]);

    const tasks = await queue.listTasks(job.id);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].sequenceNumber).toBe(1);
    expect(tasks[1].sequenceNumber).toBe(2);
    expect(tasks.every(t => t.status === "pending")).toBe(true);
  });

  it("processes only one document task at a time", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 3,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Doc 1" },
      { recapDocumentId: "2", description: "Doc 2" },
      { recapDocumentId: "3", description: "Doc 3" },
    ]);

    const running = await queue.claimNext(job.id);

    expect(running.recapDocumentId).toBe("1");

    const tasks = await queue.listTasks(job.id);
    expect(tasks.filter(t => t.status === "running")).toHaveLength(1);
    expect(tasks.filter(t => t.status === "pending")).toHaveLength(2);
  });

  it("does not claim a second task while one is running", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 2,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Doc 1" },
      { recapDocumentId: "2", description: "Doc 2" },
    ]);

    await queue.claimNext(job.id);
    const second = await queue.claimNext(job.id);

    expect(second).toBeNull();
  });

  it("marks complete or review_needed based on reviewRequired", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 1,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [{ recapDocumentId: "1", description: "Motion" }]);
    const task = await queue.claimNext(job.id);

    await queue.markComplete(task.id, {
      reviewRequired: true,
      folderPath: "data/recap-imports/case",
    });

    const updated = await queue.getTask(task.id);
    const status = await queue.getJobStatus(job.id);

    expect(updated.status).toBe("review_needed");
    expect(status.reviewNeeded).toBe(1);
  });

  it("marks failed with error message", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 1,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [{ recapDocumentId: "1", description: "Motion" }]);
    const task = await queue.claimNext(job.id);

    await queue.markFailed(task.id, new Error("boom"));

    const updated = await queue.getTask(task.id);
    expect(updated.status).toBe("failed");
    expect(updated.errorMessage).toMatch(/boom/);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/metadata.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { MetadataAgent } from "../../agents/metadata.agent.js";

describe("MetadataAgent", () => {
  it("normalizes and preserves CourtListener source metadata", async () => {
    const writer = createMockJsonWriter();
    const agent = new MetadataAgent({ writer });

    const result = await agent.run({
      source: "courtlistener",
      caseName: "Smith v. Hospital Corp",
      caseNameFull: "Jane Smith v. Hospital Corporation",
      courtId: "nysd",
      docketId: 12345,
      docketNumber: "1:26-cv-12345",
      docketEntryId: 45678,
      recapDocumentId: 98765,
      documentNumber: "42",
      attachmentNumber: null,
      description: "Motion to Compel",
      dateFiled: "2026-06-01",
      absoluteUrl: "https://www.courtlistener.com/docket/12345/",
      plainTextAvailable: true,
      ocrStatus: "complete",
      pdfAvailable: true,
      raw: { original: true },
    });

    expect(result.docketId).toBe("12345");
    expect(result.docketEntryId).toBe("45678");
    expect(result.recapDocumentId).toBe("98765");
    expect(result.raw).toEqual({ original: true });
    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("source_metadata.json"),
      expect.objectContaining({
        caseName: "Smith v. Hospital Corp",
        recapDocumentId: "98765",
      })
    );
  });

  it("handles missing optional fields without dropping raw payload", async () => {
    const writer = createMockJsonWriter();
    const agent = new MetadataAgent({ writer });

    const result = await agent.run({
      source: "courtlistener",
      caseName: "Unknown Case",
      courtId: "nysd",
      docketId: "123",
      raw: { untouched: true },
    });

    expect(result.caseName).toBe("Unknown Case");
    expect(result.raw).toEqual({ untouched: true });
    expect(result.description).toBeNull();
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/caseFolder.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { CaseFolderAgent } from "../../agents/caseFolder.agent.js";

describe("CaseFolderAgent", () => {
  it("creates safe case and document folder paths", async () => {
    const fileStore = createMockFileStore();
    const agent = new CaseFolderAgent({
      outputRoot: "data/recap-imports",
      fileStore,
    });

    const result = await agent.run({
      metadata: {
        caseName: "Smith / Jones v. New York-Presbyterian Hospital, Inc.",
        courtId: "nysd",
        docketId: "12345",
        description: "Motion to Compel / Sanctions",
      },
      task: {
        sequenceNumber: 1,
      },
    });

    expect(result.caseFolderPath).toBe(
      "data/recap-imports/smith-jones-v-new-york-presbyterian-hospital-inc__nysd__docket-12345/"
    );
    expect(result.documentFolderPath).toBe(
      "data/recap-imports/smith-jones-v-new-york-presbyterian-hospital-inc__nysd__docket-12345/documents/doc-001-motion-to-compel-sanctions/"
    );
    expect(fileStore.ensureDir).toHaveBeenCalledWith(result.caseFolderPath);
    expect(fileStore.ensureDir).toHaveBeenCalledWith(result.documentFolderPath);
  });

  it("dedupes folder name collisions", async () => {
    const fileStore = createMockFileStore({
      existsSequence: [true, false],
    });

    const agent = new CaseFolderAgent({
      outputRoot: "data/recap-imports",
      fileStore,
    });

    const result = await agent.run({
      metadata: {
        caseName: "Smith v Hospital",
        courtId: "nysd",
        docketId: "12345",
        description: "Complaint",
      },
      task: {
        sequenceNumber: 1,
      },
    });

    expect(result.caseFolderPath).toContain("__2");
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/fetch.agent.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { FetchAgent } from "../../agents/fetch.agent.js";

describe("FetchAgent", () => {
  it("saves CourtListener plain text when available", async () => {
    const fileStore = createMockFileStore();
    const hashService = { sha256File: vi.fn() };
    const agent = new FetchAgent({ fileStore, hashService, fetchImpl: vi.fn() });

    const result = await agent.run({
      metadata: {
        plainText: "CourtListener extracted text",
        pdfAvailable: false,
      },
      folders: {
        documentFolderPath: "data/recap-imports/case/documents/doc-001/",
      },
    });

    expect(fileStore.writeText).toHaveBeenCalledWith(
      expect.stringContaining("courtlistener_plain_text.txt"),
      "CourtListener extracted text"
    );
    expect(result.plainTextExists).toBe(true);
    expect(result.pdfExists).toBe(false);
  });

  it("downloads and hashes PDF when available", async () => {
    const fileStore = createMockFileStore();
    const hashService = {
      sha256File: vi.fn().mockResolvedValue("hash123"),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    const agent = new FetchAgent({ fileStore, hashService, fetchImpl });

    const result = await agent.run({
      metadata: {
        pdfAvailable: true,
        pdfUrl: "https://www.courtlistener.com/pdf/1.pdf",
      },
      folders: {
        documentFolderPath: "data/recap-imports/case/documents/doc-001/",
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://www.courtlistener.com/pdf/1.pdf");
    expect(fileStore.writeBuffer).toHaveBeenCalledWith(
      expect.stringContaining("source.pdf"),
      expect.any(Buffer)
    );
    expect(result.hashes.pdfSha256).toBe("hash123");
  });

  it("marks source unavailable when no text and no PDF exist", async () => {
    const fileStore = createMockFileStore();
    const agent = new FetchAgent({
      fileStore,
      hashService: {},
      fetchImpl: vi.fn(),
    });

    const result = await agent.run({
      metadata: {
        plainText: "",
        pdfAvailable: false,
      },
      folders: {
        documentFolderPath: "data/recap-imports/case/documents/doc-001/",
      },
    });

    expect(result.sourceUnavailable).toBe(true);
    expect(result.plainTextExists).toBe(false);
    expect(result.pdfExists).toBe(false);
  });

  it("does not use fallback documents", async () => {
    const fileStore = createMockFileStore();
    const agent = new FetchAgent({
      fileStore,
      hashService: {},
      fetchImpl: vi.fn(),
    });

    const result = await agent.run({
      metadata: {
        plainText: "",
        pdfAvailable: false,
        fallbackPdfPath: "tests/fixtures/sample.pdf",
      },
      folders: {
        documentFolderPath: "data/recap-imports/case/documents/doc-001/",
      },
    });

    expect(fileStore.copyFile).not.toHaveBeenCalled();
    expect(result.sourceUnavailable).toBe(true);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/textTriage.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { TextTriageAgent } from "../../agents/textTriage.agent.js";

describe("TextTriageAgent", () => {
  it("uses RECAP plain text when usable", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "This is a long enough extracted filing text. ".repeat(300),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsLayoutParsing: false,
      needsCoordinateReview: false,
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.reason).toBe("plain_text_usable");
  });

  it("requires OCR when forceOcr is true", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: true,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("force_ocr");
  });

  it("requires OCR when plain text is missing", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: true,
      pageCount: 4,
      forceOcr: false,
      ocrStatus: null,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_missing");
  });

  it("requires OCR when text is too short for page count", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "short text",
      plainTextExists: true,
      pdfExists: true,
      pageCount: 20,
      forceOcr: false,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_too_short_for_page_count");
  });

  it("requires OCR when text is garbled", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "@@@@ #### |||| //// \uFFFD \uFFFD \uFFFD ".repeat(100),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_garbled");
  });

  it("requires OCR when RECAP OCR status is failed/incomplete/partial/unavailable", async () => {
    const agent = new TextTriageAgent();

    for (const status of ["failed", "incomplete", "partial", "unavailable"]) {
      const result = await agent.run({
        plainText: "Some text ".repeat(500),
        plainTextExists: true,
        pdfExists: true,
        pageCount: 2,
        forceOcr: false,
        ocrStatus: status,
      });

      expect(result.requiresOcr).toBe(true);
      expect(result.reason).toBe("recap_ocr_status_not_usable");
    }
  });

  it("requires OCR when layout parsing is required", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsLayoutParsing: true,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("layout_parsing_required");
  });

  it("requires OCR when coordinate review is required", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsCoordinateReview: true,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("coordinate_review_required");
  });

  it("marks source unavailable when no text and no PDF exist", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: false,
      pageCount: null,
      forceOcr: false,
      ocrStatus: null,
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.sourceUnavailable).toBe(true);
    expect(result.reason).toBe("source_unavailable");
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/documentVisionParser.agent.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { DocumentVisionParserAgent } from "../../agents/documentVisionParser.agent.js";

const validConfig = {
  openRouterApiKey: "test-openrouter",
  provider: "qwen_vl",
  qwenVlModel: "qwen/qwen3-vl-8b-instruct",
};

function qwenPageResult(overrides = {}) {
  return {
    page: 1,
    transcribedText: "Plaintiff moves to compel discovery.",
    layoutSummary: {
      hasHeader: true,
      hasFooter: false,
      hasTable: false,
      hasSignatureBlock: false,
      hasHandwriting: false,
      hasSealOrStamp: false,
      hasExhibitLabel: false,
    },
    legalHints: {
      possibleDocumentType: "motion",
      possibleMotionType: "motion_to_compel",
      partyNames: ["Plaintiff"],
      attorneyNames: [],
      courtNames: [],
      dates: [],
      legalTerms: ["discovery"],
    },
    reviewFlags: [],
    confidence: {
      text: 0.86,
      layout: 0.8,
      legalHints: 0.72,
    },
    ...overrides,
  };
}

describe("DocumentVisionParserAgent", () => {
  it("requires OPENROUTER_API_KEY", async () => {
    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: { parsePageImage: vi.fn() },
      fileStore: createMockFileStore(),
      pdfToImageService: createMockPdfToImageService(),
      config: {
        ...validConfig,
        openRouterApiKey: "",
      },
    });

    await expect(
      agent.run({
        triage: { requiresOcr: true },
        fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/OPENROUTER_API_KEY/i);
  });

  it("requires QWEN_VL_MODEL", async () => {
    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: { parsePageImage: vi.fn() },
      fileStore: createMockFileStore(),
      pdfToImageService: createMockPdfToImageService(),
      config: {
        ...validConfig,
        qwenVlModel: "",
      },
    });

    await expect(
      agent.run({
        triage: { requiresOcr: true },
        fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/QWEN_VL_MODEL/i);
  });

  it("rejects provider other than qwen_vl", async () => {
    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: { parsePageImage: vi.fn() },
      fileStore: createMockFileStore(),
      pdfToImageService: createMockPdfToImageService(),
      config: {
        ...validConfig,
        provider: "paddleocr",
      },
    });

    await expect(
      agent.run({
        triage: { requiresOcr: true },
        fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/qwen_vl/i);
  });

  it("calls Qwen-VL via OpenRouter when OCR is required", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn().mockResolvedValue(qwenPageResult()),
    };

    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient,
      fileStore: createMockFileStore(),
      pdfToImageService: {
        convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
        imageToBase64: vi.fn().mockResolvedValue("base64-image"),
      },
      config: validConfig,
    });

    const result = await agent.run({
      triage: {
        requiresOcr: true,
        reason: "plain_text_missing",
      },
      fetched: {
        pdfExists: true,
        pdfPath: "source/source.pdf",
      },
      folders: mockFolders(),
    });

    expect(openRouterVisionClient.parsePageImage).toHaveBeenCalledTimes(1);
    expect(result.usedOcr).toBe(true);
    expect(result.provider).toBe("qwen_vl");
    expect(result.model).toBe("qwen/qwen3-vl-8b-instruct");
  });

  it("does not call Qwen-VL when RECAP plain text is usable", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn(),
    };
    const fileStore = createMockFileStore();

    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient,
      fileStore,
      pdfToImageService: createMockPdfToImageService(),
      config: validConfig,
    });

    const result = await agent.run({
      triage: {
        requiresOcr: false,
        reason: "plain_text_usable",
      },
      fetched: {
        plainText: "Usable RECAP text ".repeat(500),
        plainTextExists: true,
      },
      folders: mockFolders(),
    });

    expect(openRouterVisionClient.parsePageImage).not.toHaveBeenCalled();
    expect(result.usedOcr).toBe(false);
    expect(fileStore.writeText).toHaveBeenCalledWith(
      expect.stringContaining("parsed.md"),
      expect.stringContaining("Usable RECAP text")
    );
  });

  it("writes parsed artifacts", async () => {
    const fileStore = createMockFileStore();

    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: {
        parsePageImage: vi.fn().mockResolvedValue(qwenPageResult()),
      },
      fileStore,
      pdfToImageService: {
        convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
        imageToBase64: vi.fn().mockResolvedValue("base64-image"),
      },
      config: validConfig,
    });

    const result = await agent.run({
      triage: { requiresOcr: true, reason: "plain_text_missing" },
      fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
      folders: mockFolders(),
    });

    expect(fileStore.writeText).toHaveBeenCalledWith(
      expect.stringContaining("parsed.md"),
      expect.stringContaining("Plaintiff moves to compel")
    );
    expect(fileStore.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("parsed_pages.json"),
      expect.anything()
    );
    expect(fileStore.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("layout_summary.json"),
      expect.anything()
    );
    expect(result.parsedTextPath).toContain("parsed.md");
  });

  it("marks bboxAvailable=false when no coordinates exist", async () => {
    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: {
        parsePageImage: vi.fn().mockResolvedValue(qwenPageResult()),
      },
      fileStore: createMockFileStore(),
      pdfToImageService: {
        convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
        imageToBase64: vi.fn().mockResolvedValue("base64-image"),
      },
      config: validConfig,
    });

    const result = await agent.run({
      triage: { requiresOcr: true, reason: "plain_text_missing" },
      fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
      folders: mockFolders(),
    });

    expect(result.bboxAvailable).toBe(false);
    expect(result.coordinateReviewPrecision).toBe("page_level_only");
  });

  it("creates page-level signature review flag from Qwen-VL response", async () => {
    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient: {
        parsePageImage: vi.fn().mockResolvedValue(
          qwenPageResult({
            reviewFlags: [
              {
                flagType: "signature_possible",
                severity: "medium",
                page: 1,
                reason: "Likely signature block detected.",
                confidence: 0.81,
                bboxAvailable: false,
                bbox: null,
              },
            ],
          })
        ),
      },
      fileStore: createMockFileStore(),
      pdfToImageService: {
        convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
        imageToBase64: vi.fn().mockResolvedValue("base64-image"),
      },
      config: validConfig,
    });

    const result = await agent.run({
      triage: { requiresOcr: true, reason: "plain_text_missing" },
      fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
      folders: mockFolders(),
    });

    expect(result.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flagType: "signature_possible",
          page: 1,
          bboxAvailable: false,
        }),
      ])
    );
  });

  it("fails clearly on OpenRouter error and does not use fallback model", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn().mockRejectedValue(new Error("OpenRouter failed")),
    };

    const agent = new DocumentVisionParserAgent({
      openRouterVisionClient,
      fileStore: createMockFileStore(),
      pdfToImageService: {
        convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
        imageToBase64: vi.fn().mockResolvedValue("base64-image"),
      },
      config: validConfig,
    });

    await expect(
      agent.run({
        triage: { requiresOcr: true, reason: "plain_text_missing" },
        fetched: { pdfExists: true, pdfPath: "source/source.pdf" },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/OpenRouter failed/i);

    expect(openRouterVisionClient.parsePageImage).toHaveBeenCalledTimes(1);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/reviewFlag.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { ReviewFlagAgent } from "../../agents/reviewFlag.agent.js";

describe("ReviewFlagAgent", () => {
  it("passes through Qwen-VL page-level signature flags", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        reviewFlags: [
          {
            flagType: "signature_possible",
            severity: "medium",
            page: 2,
            reason: "Likely signature block detected.",
            confidence: 0.81,
            bboxAvailable: false,
            bbox: null,
          },
        ],
        pages: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags[0].flagType).toBe("signature_possible");
    expect(result.flags[0].bboxAvailable).toBe(false);
  });

  it("flags possible signature block from text pattern", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        pages: [
          {
            page: 3,
            text: "Respectfully submitted,\n/s/ John Smith\nAttorney for Defendant",
          },
        ],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "signature_possible")).toBe(true);
  });

  it("flags possible handwriting from layout summary", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        layoutSummary: [
          {
            page: 4,
            hasHandwriting: true,
          },
        ],
        pages: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "handwriting_possible")).toBe(true);
  });

  it("flags missing page text", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        pages: [
          { page: 1, text: "" },
          { page: 2, text: "Some text" },
        ],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "missing_page_text")).toBe(true);
  });

  it("sets reviewRequired=false when there are no flags", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        pages: [{ page: 1, text: "Clean page text." }],
        layoutSummary: [{ page: 1, hasSignatureBlock: false, hasHandwriting: false }],
        reviewFlags: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(false);
    expect(result.flags).toEqual([]);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/legalAnnotation.agent.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { LegalAnnotationAgent } from "../../agents/legalAnnotation.agent.js";

describe("LegalAnnotationAgent", () => {
  it("annotates motion to compel with confidence and source span", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith moves to compel discovery responses from Defendant Hospital Corp.",
        pages: [
          {
            page: 1,
            text: "Plaintiff Jane Smith moves to compel discovery responses from Defendant Hospital Corp.",
          },
        ],
      },
      metadata: {
        caseName: "Smith v. Hospital Corp",
      },
      review: {
        reviewRequired: false,
        flags: [],
      },
      folders: mockFolders(),
    });

    expect(result.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "motion_type",
          value: "motion_to_compel",
          confidence: expect.any(Number),
          source: expect.objectContaining({
            page: 1,
          }),
        }),
      ])
    );
  });

  it("annotates parties from parsed text", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith brings this action against Defendant Hospital Corp.",
        pages: [{ page: 1, text: "Plaintiff Jane Smith brings this action against Defendant Hospital Corp." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(result.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "party", value: expect.stringMatching(/Jane Smith|Hospital Corp/) }),
      ])
    );
  });

  it("does not invent absent parties", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "This document discusses discovery.",
        pages: [{ page: 1, text: "This document discusses discovery." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("John Doe");
    expect(serialized).not.toContain("Jane Doe");
  });

  it("writes legal_annotations.json", async () => {
    const writer = createMockJsonWriter();
    const agent = new LegalAnnotationAgent({ writer });

    await agent.run({
      parsed: {
        text: "Plaintiff moves to compel.",
        pages: [{ page: 1, text: "Plaintiff moves to compel." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("legal_annotations.json"),
      expect.any(Object)
    );
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/legalExtraction.agent.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { LegalExtractionAgent } from "../../agents/legalExtraction.agent.js";

const validExtraction = {
  document: {
    documentType: "motion",
    filingType: "motion",
    description: "Motion to compel",
    court: "nysd",
    caseName: "Smith v. Hospital Corp",
    docketNumber: "1:26-cv-12345",
    recapDocumentId: "98765",
    dateFiled: "2026-06-01",
  },
  parties: [],
  attorneys: [],
  judges: [],
  dates: [],
  deadlines: [],
  motions: [],
  orders: [],
  claims: [],
  defenses: [],
  legalTerms: ["discovery"],
  citations: [],
  exhibits: [],
  medicalEntities: [],
  discoveryIssues: [],
  reviewFlags: [],
  confidence: {
    overall: 0.8,
    documentType: 0.75,
    entities: 0.7,
    dates: 0.7,
    legalIssues: 0.72,
  },
};

describe("LegalExtractionAgent", () => {
  it("requires OPENROUTER_API_KEY", async () => {
    const agent = new LegalExtractionAgent({
      openRouterTextClient: { extractLegalJson: vi.fn() },
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/OPENROUTER_API_KEY/i);
  });

  it("requires LEGAL_EXTRACTION_MODEL", async () => {
    const agent = new LegalExtractionAgent({
      openRouterTextClient: { extractLegalJson: vi.fn() },
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "",
      },
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/LEGAL_EXTRACTION_MODEL/i);
  });

  it("uses DeepSeek V4 Flash model for extraction", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockResolvedValue(validExtraction),
    };

    const agent = new LegalExtractionAgent({
      openRouterTextClient,
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith moves to compel discovery responses by July 1, 2026.",
      },
      annotations: {
        annotations: [],
      },
      metadata: {
        caseName: "Smith v. Hospital Corp",
        courtId: "nysd",
        docketNumber: "1:26-cv-12345",
      },
      review: {
        reviewRequired: false,
        flags: [],
      },
      folders: mockFolders(),
    });

    expect(openRouterTextClient.extractLegalJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek/deepseek-v4-flash",
      })
    );

    expect(result.document.caseName).toBe("Smith v. Hospital Corp");
    expect(result.legalTerms).toContain("discovery");
  });

  it("rejects markdown/prose instead of strict JSON object", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockResolvedValue("```json\n{}\n```"),
    };

    const agent = new LegalExtractionAgent({
      openRouterTextClient,
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/strict JSON/i);
  });

  it("rejects extraction missing required schema fields", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockResolvedValue({
        document: {},
      }),
    };

    const agent = new LegalExtractionAgent({
      openRouterTextClient,
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/schema/i);
  });

  it("fails clearly on DeepSeek/OpenRouter error without fallback", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockRejectedValue(new Error("DeepSeek failed")),
    };

    const agent = new LegalExtractionAgent({
      openRouterTextClient,
      writer: createMockJsonWriter(),
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    await expect(
      agent.run({
        parsed: { text: "Plaintiff moves to compel." },
        annotations: { annotations: [] },
        metadata: {},
        review: { reviewRequired: false, flags: [] },
        folders: mockFolders(),
      })
    ).rejects.toThrow(/DeepSeek failed/i);

    expect(openRouterTextClient.extractLegalJson).toHaveBeenCalledTimes(1);
  });

  it("writes extracted_legal.json", async () => {
    const writer = createMockJsonWriter();

    const agent = new LegalExtractionAgent({
      openRouterTextClient: {
        extractLegalJson: vi.fn().mockResolvedValue(validExtraction),
      },
      writer,
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    await agent.run({
      parsed: { text: "Plaintiff moves to compel." },
      annotations: { annotations: [] },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("extracted_legal.json"),
      expect.objectContaining({
        document: expect.any(Object),
        confidence: expect.any(Object),
      })
    );
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/agents/manifest.agent.test.js`

```js
import { describe, expect, it } from "vitest";
import { ManifestAgent } from "../../agents/manifest.agent.js";

describe("ManifestAgent", () => {
  it("writes success manifest with CourtListener, Qwen-VL, and DeepSeek metadata", async () => {
    const writer = createMockJsonWriter();
    const agent = new ManifestAgent({ writer });

    const result = await agent.run({
      task: {
        id: "task_1",
        jobId: "job_1",
      },
      metadata: {
        source: "courtlistener",
        recapDocumentId: "98765",
        docketId: "12345",
      },
      folders: {
        caseFolderPath: "data/recap-imports/smith-v-hospital__nysd__docket-12345/",
        documentFolderPath:
          "data/recap-imports/smith-v-hospital__nysd__docket-12345/documents/doc-001-motion/",
      },
      fetched: {
        hashes: {
          pdfSha256: "abc123",
        },
      },
      parsed: {
        provider: "qwen_vl",
        model: "qwen/qwen3-vl-8b-instruct",
      },
      extraction: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
      },
      review: {
        reviewRequired: false,
        flags: [],
      },
    });

    expect(result.status).toBe("complete");
    expect(result.versions.visionModel).toBe("qwen/qwen3-vl-8b-instruct");
    expect(result.versions.legalExtractionModel).toBe("deepseek/deepseek-v4-flash");

    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("document_manifest.json"),
      expect.objectContaining({
        source: expect.objectContaining({
          provider: "courtlistener",
          recapDocumentId: "98765",
        }),
      })
    );
  });

  it("writes error manifest when task fails", async () => {
    const writer = createMockJsonWriter();
    const agent = new ManifestAgent({ writer });

    const result = await agent.runError({
      task: {
        id: "task_1",
        jobId: "job_1",
      },
      error: new Error("OpenRouter failed"),
      folders: {
        documentFolderPath: "data/recap-imports/case/documents/doc-001/",
      },
    });

    expect(result.status).toBe("failed");
    expect(result.error.message).toMatch(/OpenRouter failed/);

    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("document_manifest.json"),
      expect.objectContaining({
        status: "failed",
      })
    );
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/services/slug.service.test.js`

```js
import { describe, expect, it } from "vitest";
import { slugifyForPath } from "../../services/slug.service.js";

describe("slug.service", () => {
  it("converts unsafe case names into safe slugs", () => {
    expect(
      slugifyForPath("Smith / Jones v. New York-Presbyterian Hospital, Inc.")
    ).toBe("smith-jones-v-new-york-presbyterian-hospital-inc");
  });

  it("collapses repeated hyphens", () => {
    expect(slugifyForPath("Smith --- v. --- Hospital")).toBe("smith-v-hospital");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugifyForPath("/// Smith v Hospital ///")).toBe("smith-v-hospital");
  });

  it("truncates very long names", () => {
    const slug = slugifyForPath("A".repeat(300), { maxLength: 80 });
    expect(slug.length).toBeLessThanOrEqual(80);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/services/hash.service.test.js`

```js
import { describe, expect, it } from "vitest";
import { sha256Buffer } from "../../services/hash.service.js";

describe("hash.service", () => {
  it("returns stable sha256 hash for buffer", () => {
    const hash1 = sha256Buffer(Buffer.from("hello"));
    const hash2 = sha256Buffer(Buffer.from("hello"));

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/services/jsonWriter.service.test.js`

```js
import { describe, expect, it } from "vitest";
import { JsonWriterService } from "../../services/jsonWriter.service.js";

describe("JsonWriterService", () => {
  it("writes pretty JSON", async () => {
    const fsMock = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    };

    const writer = new JsonWriterService({ fs: fsMock });

    await writer.writeJson("data/test/output.json", { a: 1 });

    expect(fsMock.mkdir).toHaveBeenCalledWith("data/test", { recursive: true });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      "data/test/output.json",
      JSON.stringify({ a: 1 }, null, 2),
      "utf8"
    );
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/recapImport.routes.test.js`

```js
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp, createTestAppWithValidEnv } from "./testUtils/createTestApp.js";

describe("RECAP Import routes", () => {
  it("creates an import job from search terms", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "medical malpractice motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.targetCount).toBe(10);
    expect(res.body.queueConcurrency).toBe(1);
  });

  it("rejects missing searchTerms", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/searchTerms/i);
  });

  it("defaults targetCount to 10", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(201);
    expect(res.body.targetCount).toBe(10);
  });

  it("rejects targetCount over 100", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "expert report",
        targetCount: 500,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetCount/i);
  });

  it("rejects missing CourtListener token", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "",
        OPENROUTER_API_KEY: "test-openrouter",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
        ALLOW_PACER_PURCHASE: "false",
        ALLOW_RECAP_FETCH: "false",
      },
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/COURTLISTENER_API_TOKEN/i);
  });

  it("rejects missing OpenRouter key", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "test-courtlistener",
        OPENROUTER_API_KEY: "",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
        ALLOW_PACER_PURCHASE: "false",
        ALLOW_RECAP_FETCH: "false",
      },
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
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
    expect(serialized).not.toContain("review_flags.json");
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/recapImport.service.test.js`

```js
import { describe, expect, it, vi } from "vitest";
import { RecapImportService } from "../recapImport.service.js";

describe("RecapImportService", () => {
  it("creates job, searches RECAP, and enqueues candidates", async () => {
    const queueAgent = {
      createJob: vi.fn().mockResolvedValue({ id: "job_1" }),
      enqueueDocuments: vi.fn().mockResolvedValue(undefined),
    };

    const recapSearchAgent = {
      run: vi.fn().mockResolvedValue({
        candidates: [
          { recapDocumentId: "1", description: "Complaint" },
          { recapDocumentId: "2", description: "Motion" },
        ],
      }),
    };

    const service = new RecapImportService({
      recapSearchAgent,
      queueAgent,
    });

    const result = await service.createJob({
      searchTerms: "motion to compel",
      targetCount: 2,
      ocrMode: "recap_text_first",
    });

    expect(queueAgent.createJob).toHaveBeenCalled();
    expect(recapSearchAgent.run).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerms: "motion to compel",
        targetCount: 2,
      })
    );
    expect(queueAgent.enqueueDocuments).toHaveBeenCalledWith("job_1", expect.any(Array));
    expect(result.jobId).toBe("job_1");
  });

  it("processes next document through all agents in order", async () => {
    const task = { id: "task_1", ocrMode: "recap_text_first" };
    const queueAgent = {
      claimNext: vi.fn().mockResolvedValue(task),
      markComplete: vi.fn(),
      markFailed: vi.fn(),
    };

    const metadataAgent = { run: vi.fn().mockResolvedValue({ ocrStatus: "complete" }) };
    const caseFolderAgent = { run: vi.fn().mockResolvedValue(mockFolders()) };
    const fetchAgent = {
      run: vi.fn().mockResolvedValue({
        plainText: "usable text ".repeat(500),
        plainTextExists: true,
        pdfExists: true,
        pageCount: 1,
      }),
    };
    const textTriageAgent = {
      run: vi.fn().mockResolvedValue({ requiresOcr: false, reason: "plain_text_usable" }),
    };
    const documentVisionParserAgent = {
      run: vi.fn().mockResolvedValue({ text: "parsed", provider: "qwen_vl" }),
    };
    const reviewFlagAgent = {
      run: vi.fn().mockResolvedValue({ reviewRequired: false, flags: [] }),
    };
    const legalAnnotationAgent = {
      run: vi.fn().mockResolvedValue({ annotations: [] }),
    };
    const legalExtractionAgent = {
      run: vi.fn().mockResolvedValue({ document: {}, confidence: {} }),
    };
    const manifestAgent = {
      run: vi.fn(),
      runError: vi.fn(),
    };

    const service = new RecapImportService({
      queueAgent,
      metadataAgent,
      caseFolderAgent,
      fetchAgent,
      textTriageAgent,
      documentVisionParserAgent,
      reviewFlagAgent,
      legalAnnotationAgent,
      legalExtractionAgent,
      manifestAgent,
    });

    const result = await service.processNextDocument("job_1");

    expect(queueAgent.claimNext).toHaveBeenCalledWith("job_1");
    expect(metadataAgent.run).toHaveBeenCalled();
    expect(caseFolderAgent.run).toHaveBeenCalled();
    expect(fetchAgent.run).toHaveBeenCalled();
    expect(textTriageAgent.run).toHaveBeenCalled();
    expect(documentVisionParserAgent.run).toHaveBeenCalled();
    expect(reviewFlagAgent.run).toHaveBeenCalled();
    expect(legalAnnotationAgent.run).toHaveBeenCalled();
    expect(legalExtractionAgent.run).toHaveBeenCalled();
    expect(manifestAgent.run).toHaveBeenCalled();
    expect(queueAgent.markComplete).toHaveBeenCalledWith(
      "task_1",
      expect.objectContaining({ reviewRequired: false })
    );
    expect(result.taskId).toBe("task_1");
  });

  it("marks task failed and writes error manifest on agent error", async () => {
    const task = { id: "task_1", ocrMode: "recap_text_first" };
    const queueAgent = {
      claimNext: vi.fn().mockResolvedValue(task),
      markComplete: vi.fn(),
      markFailed: vi.fn(),
    };
    const metadataAgent = {
      run: vi.fn().mockRejectedValue(new Error("metadata failed")),
    };
    const manifestAgent = {
      runError: vi.fn(),
    };

    const service = new RecapImportService({
      queueAgent,
      metadataAgent,
      manifestAgent,
    });

    await expect(service.processNextDocument("job_1")).rejects.toThrow(/metadata failed/i);

    expect(queueAgent.markFailed).toHaveBeenCalledWith("task_1", expect.any(Error));
    expect(manifestAgent.runError).toHaveBeenCalledWith(
      expect.objectContaining({
        task,
        error: expect.any(Error),
      })
    );
  });
});
```

---

## `backend/src/modules/recap-import/__tests__/integration/recapImport.integration.test.js`

```js
import { describe, expect, it } from "vitest";
import { createRecapImportTestSystem } from "../testUtils/createRecapImportTestSystem.js";

describe("RECAP import integration", () => {
  it("processes a mocked 3-document job sequentially and writes local folders", async () => {
    const system = createRecapImportTestSystem({
      courtListenerClient: mockCourtListenerClientWithDocuments(3),
      openRouterVisionClient: mockOpenRouterVisionClientSuccess(),
      openRouterTextClient: mockDeepSeekExtractionClientSuccess(),
      outputRoot: tempOutputRoot(),
    });

    const job = await system.recapImportService.createJob({
      searchTerms: "motion to compel",
      targetCount: 3,
      ocrMode: "recap_text_first",
    });

    await system.recapImportService.processNextDocument(job.jobId);
    await system.recapImportService.processNextDocument(job.jobId);
    await system.recapImportService.processNextDocument(job.jobId);

    const status = await system.queueAgent.getJobStatus(job.jobId);

    expect(status.processed).toBe(3);
    expect(status.failed).toBe(0);
    expect(status.caseFolders[0].folderPath).toContain("data/recap-imports");
    expect(await system.fileStore.exists(`${status.caseFolders[0].folderPath}/case_manifest.json`)).toBe(true);
  });

  it("never has more than one running task in 100-document queue", async () => {
    const system = createRecapImportTestSystem({
      courtListenerClient: mockCourtListenerClientWithDocuments(100),
      openRouterVisionClient: mockOpenRouterVisionClientSuccess(),
      openRouterTextClient: mockDeepSeekExtractionClientSuccess(),
      outputRoot: tempOutputRoot(),
    });

    const job = await system.recapImportService.createJob({
      searchTerms: "expert report",
      targetCount: 100,
      ocrMode: "recap_text_first",
    });

    await system.queueAgent.claimNext(job.jobId);

    const tasks = await system.queueAgent.listTasks(job.jobId);

    expect(tasks.filter(t => t.status === "running")).toHaveLength(1);
    expect(tasks.filter(t => t.status === "pending")).toHaveLength(99);
  });

  it("returns frontend-safe folder-only response after processing", async () => {
    const system = createRecapImportTestSystem({
      courtListenerClient: mockCourtListenerClientWithDocuments(1),
      openRouterVisionClient: mockOpenRouterVisionClientSuccess(),
      openRouterTextClient: mockDeepSeekExtractionClientSuccess(),
      outputRoot: tempOutputRoot(),
    });

    const job = await system.recapImportService.createJob({
      searchTerms: "complaint",
      targetCount: 1,
      ocrMode: "recap_text_first",
    });

    await system.recapImportService.processNextDocument(job.jobId);

    const response = await system.recapImportController.getJobStatus(job.jobId);
    const serialized = JSON.stringify(response);

    expect(serialized).toContain("folderPath");
    expect(serialized).not.toContain("source.pdf");
    expect(serialized).not.toContain("parsed.md");
    expect(serialized).not.toContain("extracted_legal.json");
    expect(serialized).not.toContain("review_flags.json");
  });
});
```

---

## `frontend/src/pages/__tests__/recapImport.page.test.jsx`

```jsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecapImportPage } from "../RecapImportPage.jsx";

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
    expect(screen.queryByText(/review_flags\.json/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/source_stack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parsed_stack/i)).not.toBeInTheDocument();
  });

  it("starts an import job with search terms and target count", async () => {
    const api = {
      createRecapImportJob: vi.fn().mockResolvedValue({
        jobId: "job_1",
        status: "queued",
        targetCount: 10,
        queueConcurrency: 1,
      }),
      getRecapImportJob: vi.fn().mockResolvedValue({
        jobId: "job_1",
        status: "queued",
        targetCount: 10,
        processed: 0,
        failed: 0,
        reviewNeeded: 0,
        caseFolders: [],
      }),
    };

    render(<RecapImportPage api={api} />);

    fireEvent.change(screen.getByLabelText(/Search terms/i), {
      target: { value: "motion to compel" },
    });

    fireEvent.change(screen.getByLabelText(/Target count/i), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByText(/Start Import Job/i));

    await waitFor(() => {
      expect(api.createRecapImportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          searchTerms: "motion to compel",
          targetCount: 10,
        })
      );
    });
  });

  it("renders output folder path from job status", async () => {
    const api = {
      createRecapImportJob: vi.fn(),
      getRecapImportJob: vi.fn().mockResolvedValue({
        jobId: "job_1",
        status: "running",
        targetCount: 10,
        processed: 3,
        failed: 0,
        reviewNeeded: 1,
        currentDocument: {
          sequenceNumber: 4,
          description: "Motion to Compel",
          caseName: "Smith v. Hospital Corp",
          status: "processing",
        },
        caseFolders: [
          {
            caseName: "Smith v. Hospital Corp",
            folderPath:
              "data/recap-imports/smith-v-hospital-corp__nysd__docket-12345/",
          },
        ],
      }),
    };

    render(<RecapImportPage api={api} initialJobId="job_1" />);

    expect(
      await screen.findByText(/data\/recap-imports\/smith-v-hospital-corp/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/3/)).toBeInTheDocument();
    expect(await screen.findByText(/1/)).toBeInTheDocument();
  });
});
```

---

## Minimal test helper notes Codex/OpenCode must add

These helpers are referenced by the tests and should be created as test-only utilities:

```text
backend/src/modules/recap-import/__tests__/testUtils/
  createTestApp.js
  createRecapImportTestSystem.js
  mocks.js
```

Required mock/helper names:

```js
createInMemoryQueueRepository()
createMockJsonWriter()
createMockFileStore()
createMockPdfToImageService()
mockFolders()
mockCourtListenerClientWithDocuments(count)
mockOpenRouterVisionClientSuccess()
mockDeepSeekExtractionClientSuccess()
tempOutputRoot()
seedRecapJobWithCompletedFolder()
createTestApp()
createTestAppWithValidEnv()
```

These helpers are test-only. They must not create runtime fixture/fallback behavior.

```js
export function mockFolders() {
  return {
    caseFolderPath: "data/recap-imports/smith-v-hospital__nysd__docket-12345/",
    documentFolderPath:
      "data/recap-imports/smith-v-hospital__nysd__docket-12345/documents/doc-001-motion/",
  };
}
```

---

## Red-test acceptance rule

Codex/OpenCode must run the tests after creating them.

Expected first result:

```text
Tests fail because implementation files/classes/routes do not exist yet.
```

Bad first result:

```text
Tests pass without implementation.
Tests call real CourtListener.
Tests call real OpenRouter.
Tests use runtime fixtures.
Tests expose internal artifact names in frontend.
```
````
