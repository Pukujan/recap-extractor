import { describe, expect, it } from "vitest";
import { ManifestAgent } from "../../agents/manifest.agent.js";
import { createMockJsonWriter } from "../testHelpers.js";

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
