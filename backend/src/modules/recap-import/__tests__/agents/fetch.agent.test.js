import { describe, expect, it, vi } from "vitest";
import { FetchAgent } from "../../agents/fetch.agent.js";
import { createMockFileStore } from "../testHelpers.js";

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
