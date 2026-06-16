import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp, createTestAppWithValidEnv } from "./testUtils/createTestApp.js";
import { seedRecapJobWithCompletedFolder } from "./testHelpers.js";

describe("RECAP Import routes", () => {
  it("creates an import job from search terms", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "medical malpractice motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.targetCount).toBe(10);
    expect(res.body.queueConcurrency).toBe(1);
  });

  it("rejects missing searchTerms", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/searchTerms/i);
  });

  it("defaults targetCount to 10", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(201);
    expect(res.body.targetCount).toBe(10);
  });

  it("rejects targetCount over 100", async () => {
    const app = createTestAppWithValidEnv();

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "expert report",
        targetCount: 500,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetCount/i);
  });

  it("rejects missing CourtListener token", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "",
        OPENROUTER_API_KEY: "test-openrouter",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
        ALLOW_PACER_PURCHASE: "false",
        ALLOW_RECAP_FETCH: "false",
      },
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/COURTLISTENER_API_TOKEN/i);
  });

  it("rejects missing OpenRouter key", async () => {
    const app = createTestApp({
      env: {
        COURTLISTENER_API_TOKEN: "test-courtlistener",
        OPENROUTER_API_KEY: "",
        QWEN_VL_MODEL: "qwen/qwen3-vl-8b-instruct",
        LEGAL_EXTRACTION_MODEL: "deepseek/deepseek-v4-flash",
        ALLOW_PACER_PURCHASE: "false",
        ALLOW_RECAP_FETCH: "false",
      },
    });

    const res = await request(app)
      .post("/api/recap-import/jobs")
      .send({
        searchTerms: "motion to compel",
        targetCount: 10,
        ocrMode: "recap_text_first",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/OPENROUTER_API_KEY/i);
  });

  it("returns frontend-safe job status without internal file list", async () => {
    const app = createTestAppWithValidEnv();
    const job = await seedRecapJobWithCompletedFolder();

    const res = await request(app)
      .get(`/api/recap-import/jobs/${job.id}`);

    expect(res.status).toBe(200);
    expect(res.body.caseFolders[0].folderPath).toBeDefined();

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("source.pdf");
    expect(serialized).not.toContain("parsed.md");
    expect(serialized).not.toContain("extracted_legal.json");
    expect(serialized).not.toContain("prompt_eval_versions.json");
    expect(serialized).not.toContain("layout_boxes.json");
    expect(serialized).not.toContain("review_flags.json");
  });
});
