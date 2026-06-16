import { vi } from "vitest";
import { RecapImportService } from "../../recapImport.service.js";
import { RecapImportController } from "../../recapImport.controller.js";
import { createInMemoryQueueRepository, createMockFileStore, createMockJsonWriter, mockFolders } from "../testHelpers.js";

export function createRecapImportTestSystem(options = {}) {
  const repo = createInMemoryQueueRepository();
  const fileStore = createMockFileStore();

  const queueAgent = {
    createJob: async (data) => repo.createJob(data),
    enqueueDocuments: async (jobId, candidates) => repo.enqueueDocuments(jobId, candidates),
    claimNext: async (jobId) => repo.claimNext(jobId),
    markComplete: async (taskId, opts) => repo.markComplete(taskId, opts),
    markFailed: async (taskId, error) => repo.markFailed(taskId, error),
    getJobStatus: async (jobId) => repo.getJobStatus(jobId),
    listTasks: async (jobId) => repo.listTasks(jobId),
    getTask: async (id) => repo.getTask(id),
  };

  const recapSearchAgent = {
    run: vi.fn(async ({ searchTerms, targetCount }) => {
      const candidates = [];
      for (let i = 1; i <= targetCount; i++) {
        candidates.push({
          recapDocumentId: `recap_${i}`,
          description: `Document ${i}: ${searchTerms}`,
          docketId: `docket_${i}`,
          court: "nysd",
          caseName: "Test v. Case",
          pageCount: 5,
        });
      }
      return { candidates };
    }),
  };

  const metadataAgent = {
    run: vi.fn(async (task) => ({
      source: "courtlistener",
      recapDocumentId: task.recapDocumentId,
      docketId: `docket_${task.recapDocumentId}`,
      court: "nysd",
      caseName: "Test v. Case",
      ocrStatus: "complete",
      pageCount: 5,
    })),
  };

  const caseFolderAgent = {
    run: vi.fn(async () => mockFolders()),
  };

  const fetchAgent = {
    run: vi.fn(async () => ({
      plainText: "usable text content for testing. ".repeat(200),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 1,
      hashes: { pdfSha256: "abc123" },
    })),
  };

  const textTriageAgent = {
    run: vi.fn(async () => ({ requiresOcr: false, reason: "plain_text_usable", pageCount: 1 })),
  };

  const documentVisionParserAgent = {
    run: vi.fn(async () => ({ text: "parsed document text", provider: "qwen_vl", model: "qwen/qwen3-vl-8b-instruct" })),
  };

  const reviewFlagAgent = {
    run: vi.fn(async () => ({ reviewRequired: false, flags: [], overallConfidence: 0.95 })),
  };

  const legalAnnotationAgent = {
    run: vi.fn(async () => ({ annotations: [], provider: "qwen_vl", model: "qwen/qwen3-vl-8b-instruct" })),
  };

  const legalExtractionAgent = {
    run: vi.fn(async () => ({
      document: {
        title: "Test Document",
        docketNumber: "1:24-cv-00001",
        court: "nysd",
        dateFiled: "2024-01-15",
        parties: [],
        summary: "Test document summary",
      },
      confidence: { overall: 0.9, fields: {} },
      provider: "deepseek",
      model: "deepseek/deepseek-v4-flash",
    })),
  };

  const documentBodyProcessingService = {
    run: vi.fn(async () => ({
      extractionSource: 'courtlistener_plain_text',
      text: 'body text for extraction',
      bodyTextAvailable: true,
      bodyTextLength: 100,
      metadataOnly: false,
      pageImageCount: 0,
    })),
    fileStore,
  };

  const manifestAgent = {
    run: vi.fn(async (ctx) => ({
      status: "complete",
      versions: {
        schemaVersion: "1.0.0",
        visionModel: "qwen/qwen3-vl-8b-instruct",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
      source: {
        provider: "courtlistener",
        recapDocumentId: ctx.metadata.recapDocumentId,
        docketId: ctx.metadata.docketId,
      },
      output: {
        caseFolderPath: ctx.folders.caseFolderPath,
        documentFolderPath: ctx.folders.documentFolderPath,
      },
    })),
    runError: vi.fn(async () => ({ status: "failed" })),
  };

  const service = new RecapImportService({
    queueAgent,
    recapSearchAgent,
    metadataAgent,
    caseFolderAgent,
    fetchAgent,
    textTriageAgent,
    documentVisionParserAgent,
    reviewFlagAgent,
    legalAnnotationAgent,
    legalExtractionAgent,
    manifestAgent,
    documentBodyProcessingService,
  });

  const config = {
    COURTLISTENER_API_TOKEN: "test-courtlistener-token",
    OPENROUTER_API_KEY: "test-openrouter-key",
    QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
    LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
    ALLOW_PACER_PURCHASE: "false",
    ALLOW_RECAP_FETCH: "false",
    RECAP_IMPORT_OUTPUT_ROOT: options.outputRoot || "./data/recap-imports",
  };

  const controller = new RecapImportController({ recapImportService: service, config });

  return {
    recapImportService: service,
    queueAgent,
    fileStore,
    recapImportController: controller,
    mocks: {
      queueAgent,
      recapSearchAgent,
      metadataAgent,
      caseFolderAgent,
      fetchAgent,
      textTriageAgent,
      documentVisionParserAgent,
      reviewFlagAgent,
      legalAnnotationAgent,
      legalExtractionAgent,
      manifestAgent,
      fileStore,
    },
  };
}
