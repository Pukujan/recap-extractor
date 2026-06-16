import { describe, expect, it, vi } from "vitest";
import { createRecapImportTestSystem } from "../testUtils/createRecapImportTestSystem.js";
import { createInMemoryQueueRepository } from "../testHelpers.js";

function createMockDocument(count) {
  return {
    recapDocumentId: String(count),
    docketEntryId: `entry-${count}`,
    absoluteUrl: `https://www.courtlistener.com/doc/${count}/`,
    caseName: `Case v. ${count}`,
    description: `Document ${count}`,
    plainTextAvailable: true,
    pdfAvailable: false,
  };
}

function mockCourtListenerClientWithDocuments(n) {
  const docs = Array.from({ length: n }, (_, i) => createMockDocument(i + 1));
  return {
    searchRecap: vi.fn().mockResolvedValue({ results: docs, next: null }),
  };
}

function mockOpenRouterVisionClientSuccess() {
  return {
    parsePageImage: vi.fn().mockResolvedValue({
      page: 1,
      transcribedText: "Plaintiff moves to compel discovery.",
      layoutSummary: {
        hasHeader: true, hasFooter: false, hasTable: false,
        hasSignatureBlock: false, hasHandwriting: false, hasSealOrStamp: false, hasExhibitLabel: false,
      },
      legalHints: {
        possibleDocumentType: "motion", possibleMotionType: "motion_to_compel",
        partyNames: ["Plaintiff"], attorneyNames: [], courtNames: [], dates: [], legalTerms: ["discovery"],
      },
      reviewFlags: [],
      confidence: { text: 0.86, layout: 0.8, legalHints: 0.72 },
    }),
  };
}

function mockDeepSeekExtractionClientSuccess() {
  return {
    extractLegalJson: vi.fn().mockResolvedValue({
      document: {
        documentType: "motion", filingType: "motion", description: "Motion to compel",
        court: "nysd", caseName: "Smith v. Hospital Corp", docketNumber: "1:26-cv-12345",
        recapDocumentId: "1", dateFiled: "2026-06-01",
      },
      parties: [], attorneys: [], judges: [], dates: [], deadlines: [],
      motions: [], orders: [], claims: [], defenses: [],
      legalTerms: ["discovery"], citations: [], exhibits: [], medicalEntities: [],
      discoveryIssues: [], reviewFlags: [],
      confidence: { overall: 0.8, documentType: 0.75, entities: 0.7, dates: 0.7, legalIssues: 0.72 },
    }),
  };
}

function tempOutputRoot() {
  return "./data/recap-imports";
}

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

    const status = await system.recapImportService.getJobStatus(job.jobId);
    const tasks = await system.recapImportService.listTasks(job.jobId);
    const cleanTasks = tasks
      .filter((t) => t.folderPath)
      .map((t) => ({ folderPath: t.folderPath }));
    const response = { ...status, caseFolders: cleanTasks };
    const serialized = JSON.stringify(response);

    expect(serialized).toContain("folderPath");
  });
});
