import { describe, expect, it, vi } from "vitest";
import { LegalExtractionAgent } from "../../agents/legalExtraction.agent.js";
import { createMockJsonWriter, mockFolders } from "../testHelpers.js";

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
      extractLegalJson: vi.fn().mockResolvedValue("Here is the JSON:\n```json\n{}\n```"),
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

  it("throws clear error on DeepSeek/OpenRouter failure", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockRejectedValue(new Error("OpenRouter text API returned 429")),
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
    ).rejects.toThrow(/429/i);
  });

  it("returns valid JSON matching extraction schema", async () => {
    const openRouterTextClient = {
      extractLegalJson: vi.fn().mockResolvedValue(validExtraction),
    };

    const writer = createMockJsonWriter();
    const agent = new LegalExtractionAgent({
      openRouterTextClient,
      writer,
      config: {
        openRouterApiKey: "test",
        legalExtractionModel: "deepseek/deepseek-v4-flash",
      },
    });

    const result = await agent.run({
      parsed: { text: "Plaintiff moves to compel." },
      annotations: { annotations: [] },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(result).toHaveProperty("document");
    expect(result).toHaveProperty("parties");
    expect(result).toHaveProperty("confidence");
    expect(result.confidence).toHaveProperty("overall");
    expect(result.confidence).toHaveProperty("documentType");
    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("extracted_legal.json"),
      expect.any(Object)
    );
  });
});
