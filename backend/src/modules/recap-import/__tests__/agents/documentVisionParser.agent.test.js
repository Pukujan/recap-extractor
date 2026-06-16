import { describe, expect, it, vi } from "vitest";
import { DocumentVisionParserAgent } from "../../agents/documentVisionParser.agent.js";
import { createMockFileStore, createMockPdfToImageService, mockFolders } from "../testHelpers.js";

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
