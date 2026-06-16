import express from "express";
import { RecapImportService } from "../../recapImport.service.js";
import { RecapImportController } from "../../recapImport.controller.js";
import { createRecapImportRouter } from "../../recapImport.routes.js";
import { createInMemoryQueueRepository, createMockFileStore, mockFolders, setTestAppRepo } from "../testHelpers.js";

function createMockAgents(repo) {
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
    run: async ({ searchTerms, targetCount }) => {
      const candidates = [];
      for (let i = 1; i <= targetCount; i++) {
        candidates.push({
          recapDocumentId: `recap_${i}`,
          description: `Document ${i}: ${searchTerms}`,
          docketId: `docket_${i}`,
          court: "nysd",
          caseName: "Test v. Case",
        });
      }
      return { candidates };
    },
  };

  const metadataAgent = {
    run: async () => ({
      source: "courtlistener",
      recapDocumentId: "recap_test",
      docketId: "docket_test",
      court: "nysd",
      caseName: "Test v. Case",
      ocrStatus: "complete",
      pageCount: 5,
    }),
  };

  const caseFolderAgent = {
    run: async () => mockFolders(),
  };

  const fetchAgent = {
    run: async () => ({
      plainText: "usable text content for testing purposes. ",
      plainTextExists: true,
      pdfExists: true,
      pageCount: 1,
    }),
  };

  const textTriageAgent = {
    run: async () => ({ requiresOcr: false, reason: "plain_text_usable", pageCount: 1 }),
  };

  const documentVisionParserAgent = {
    run: async () => ({ text: "parsed document text", provider: "qwen_vl", model: "qwen/qwen3-vl-8b-instruct" }),
  };

  const reviewFlagAgent = {
    run: async () => ({ reviewRequired: false, flags: [], overallConfidence: 0.95 }),
  };

  const legalAnnotationAgent = {
    run: async () => ({ annotations: [], provider: "qwen_vl", model: "qwen/qwen3-vl-8b-instruct" }),
  };

  const legalExtractionAgent = {
    run: async () => ({
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
    }),
  };

  const manifestAgent = {
    run: async () => ({ status: "complete", versions: { schemaVersion: "1.0.0" } }),
    runError: async () => {},
  };

  const documentBodyProcessingService = {
    run: async () => ({
      extractionSource: 'courtlistener_plain_text',
      text: 'body text for extraction',
      bodyTextAvailable: true,
      bodyTextLength: 100,
      metadataOnly: false,
      pageImageCount: 0,
    }),
    fileStore: createMockFileStore(),
  };

  return {
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
  };
}

export function createTestApp({ env } = {}) {
  const app = express();
  app.use(express.json());

  const repo = createInMemoryQueueRepository();
  setTestAppRepo(repo);
  const agents = createMockAgents(repo);

  const service = new RecapImportService(agents);
  const controller = new RecapImportController({ recapImportService: service, config: env || process.env });
  const router = createRecapImportRouter(controller);

  app.use("/api/recap-import", router);

  return app;
}

export function createTestAppWithValidEnv() {
  return createTestApp({
    env: {
      COURTLISTENER_API_TOKEN: "test-courtlistener-token",
      COURTLISTENER_API_BASE_URL: "https://www.courtlistener.com/api/rest/v4",
      OPENROUTER_API_KEY: "test-openrouter-key",
      OPENROUTER_API_BASE_URL: "https://openrouter.ai/api/v1",
      QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
      LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
      ALLOW_PACER_PURCHASE: "false",
      ALLOW_RECAP_FETCH: "false",
      RECAP_IMPORT_OUTPUT_ROOT: "./data/recap-imports",
      RECAP_IMPORT_MAX_TARGET_COUNT: "100",
      RECAP_IMPORT_QUEUE_CONCURRENCY: "1",
      OCR_PROVIDER: "qwen_vl",
    },
  });
}
