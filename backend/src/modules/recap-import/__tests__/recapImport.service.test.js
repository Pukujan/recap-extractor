import { describe, expect, it, vi } from "vitest";
import { RecapImportService } from "../recapImport.service.js";
import { mockFolders } from "./testHelpers.js";

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
