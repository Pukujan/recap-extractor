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
        choices: [{ message: { content: JSON.stringify(validExtraction) } }],
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
        choices: [{ message: { content: "Here is the JSON:\n```json\n{}\n```" } }],
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
