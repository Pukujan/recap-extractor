import { describe, expect, it, vi } from "vitest";
import { OpenRouterVisionClient } from "../../clients/openRouterVision.client.js";

describe("OpenRouterVisionClient", () => {
  it("uses Qwen-VL model and sends image payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              page: 1,
              transcribedText: "Plaintiff moves to compel discovery.",
              layoutSummary: { hasHeader: true, hasFooter: false, hasTable: false, hasSignatureBlock: false, hasHandwriting: false, hasSealOrStamp: false, hasExhibitLabel: false },
              legalHints: { possibleDocumentType: "motion", possibleMotionType: "motion_to_compel", partyNames: ["Plaintiff"], attorneyNames: [], courtNames: [], dates: [], legalTerms: ["discovery"] },
              reviewFlags: [],
              confidence: { text: 0.86, layout: 0.8, legalHints: 0.72 },
            }),
          },
        }],
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
        choices: [{ message: { content: '{"page":1,"transcribedText":"Text","layoutSummary":{},"legalHints":{},"reviewFlags":[],"confidence":{"text":0.8,"layout":0.7,"legalHints":0.5}}' } }],
      }),
    });

    const client = new OpenRouterVisionClient({
      apiKey: "key", baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct", fetchImpl: fetchMock,
    });

    const result = await client.parsePageImage({ imageBase64: "abc", prompt: "Return strict JSON" });
    expect(result.page).toBe(1);
    expect(result.transcribedText).toBe("Text");
  });

  it("rejects markdown-wrapped JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "```json\n{\"page\":1}\n```" } }],
      }),
    });

    const client = new OpenRouterVisionClient({
      apiKey: "key", baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct", fetchImpl: fetchMock,
    });

    await expect(
      client.parsePageImage({ imageBase64: "abc", prompt: "Return strict JSON" })
    ).rejects.toThrow(/strict JSON/i);
  });

  it("throws clear error on OpenRouter failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 402, text: async () => "Payment required",
    });

    const client = new OpenRouterVisionClient({
      apiKey: "openrouter-key", baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-vl-8b-instruct", fetchImpl: fetchMock,
    });

    await expect(
      client.parsePageImage({ imageBase64: "abc", prompt: "Return JSON" })
    ).rejects.toThrow(/OpenRouter vision.*402/i);
  });
});
