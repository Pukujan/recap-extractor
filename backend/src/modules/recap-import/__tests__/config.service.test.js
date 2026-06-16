import { describe, expect, it } from "vitest";
import { loadRecapImportConfig } from "../services/config.service.js";

const validEnv = {
  COURTLISTENER_API_BASE_URL: "https://www.courtlistener.com/api/rest/v4",
  COURTLISTENER_API_TOKEN: "test-courtlistener-token",
  RECAP_IMPORT_OUTPUT_ROOT: "./data/recap-imports",
  RECAP_IMPORT_MAX_TARGET_COUNT: "100",
  RECAP_IMPORT_QUEUE_CONCURRENCY: "1",
  OCR_PROVIDER: "qwen_vl",
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_API_BASE_URL: "https://openrouter.ai/api/v1",
  QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
  LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
  ALLOW_PACER_PURCHASE: "false",
  ALLOW_RECAP_FETCH: "false",
};

describe("recap import config", () => {
  it("loads valid local runtime config", () => {
    const config = loadRecapImportConfig(validEnv);

    expect(config.courtListener.baseUrl).toBe("https://www.courtlistener.com/api/rest/v4");
    expect(config.courtListener.token).toBe("test-courtlistener-token");
    expect(config.outputRoot).toBe("./data/recap-imports");
    expect(config.maxTargetCount).toBe(100);
    expect(config.queueConcurrency).toBe(1);
    expect(config.ocr.provider).toBe("qwen_vl");
    expect(config.ocr.qwenVlModel).toBe("qwen/qwen3-vl-8b-instruct");
    expect(config.legalExtraction.model).toBe("deepseek/deepseek-v4-flash");
    expect(config.safety.allowPacerPurchase).toBe(false);
    expect(config.safety.allowRecapFetch).toBe(false);
  });

  it("requires COURTLISTENER_API_TOKEN", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        COURTLISTENER_API_TOKEN: "",
      })
    ).toThrow(/COURTLISTENER_API_TOKEN/i);
  });

  it("requires OPENROUTER_API_KEY", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        OPENROUTER_API_KEY: "",
      })
    ).toThrow(/OPENROUTER_API_KEY/i);
  });

  it("requires QWEN_VL_MODEL", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        QWEN_VL_MODEL: "",
      })
    ).toThrow(/QWEN_VL_MODEL/i);
  });

  it("requires LEGAL_EXTRACTION_MODEL", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        LEGAL_EXTRACTION_MODEL: "",
      })
    ).toThrow(/LEGAL_EXTRACTION_MODEL/i);
  });

  it("rejects OCR provider other than qwen_vl for MVP", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        OCR_PROVIDER: "paddleocr",
      })
    ).toThrow(/OCR_PROVIDER.*qwen_vl/i);
  });

  it("rejects PACER purchase enabled", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        ALLOW_PACER_PURCHASE: "true",
      })
    ).toThrow(/PACER purchase.*disabled/i);
  });

  it("rejects RECAP Fetch enabled", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        ALLOW_RECAP_FETCH: "true",
      })
    ).toThrow(/RECAP Fetch.*disabled/i);
  });

  it("rejects runtime fixture mode", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        RECAP_IMPORT_USE_FIXTURES: "true",
      })
    ).toThrow(/fixtures.*tests only/i);
  });

  it("defaults queue concurrency to 1 even if omitted", () => {
    const { RECAP_IMPORT_QUEUE_CONCURRENCY, ...env } = validEnv;
    const config = loadRecapImportConfig(env);

    expect(config.queueConcurrency).toBe(1);
  });

  it("rejects queue concurrency greater than 1 for MVP", () => {
    expect(() =>
      loadRecapImportConfig({
        ...validEnv,
        RECAP_IMPORT_QUEUE_CONCURRENCY: "3",
      })
    ).toThrow(/queue concurrency.*1/i);
  });
});
