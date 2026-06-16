import { describe, it, expect } from "vitest";
import {
  validateCrawlerOptions,
  getRandomDelayMs,
  shouldStopForResponse,
  detectBlockedPageText
} from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("refuses maxPages above hard limit", () => {
    expect(() =>
      validateCrawlerOptions({
        query: "motion to compel",
        maxPages: 100
      })
    ).toThrow(/hard limit/i);
  });

  it("defaults to bounded demo settings", () => {
    const options = validateCrawlerOptions({
      query: "motion to compel"
    });

    expect(options.maxPages).toBe(5);
    expect(options.concurrency).toBe(1);
    expect(options.downloadPdfs).toBe(false);
    expect(options.loginAllowed).toBe(false);
    expect(options.stealthAllowed).toBe(false);
    expect(options.proxyRotationAllowed).toBe(false);
  });

  it("rejects PDF downloading in crawler demo mode", () => {
    expect(() =>
      validateCrawlerOptions({
        query: "motion to compel",
        downloadPdfs: true
      })
    ).toThrow(/pdf download/i);
  });

  it("generates polite delay between page visits", () => {
    const delay = getRandomDelayMs({
      min: 10000,
      max: 20000,
      random: () => 0.5
    });

    expect(delay).toBeGreaterThanOrEqual(10000);
    expect(delay).toBeLessThanOrEqual(20000);
  });

  it("stops immediately on HTTP 429", () => {
    const response = {
      status: () => 429,
      url: () => "https://www.courtlistener.com/search/"
    };

    const result = shouldStopForResponse(response);

    expect(result.stop).toBe(true);
    expect(result.reason).toBe("HTTP_429");
  });

  it("stops immediately on HTTP 403", () => {
    const response = {
      status: () => 403,
      url: () => "https://www.courtlistener.com/search/"
    };

    const result = shouldStopForResponse(response);

    expect(result.stop).toBe(true);
    expect(result.reason).toBe("HTTP_403");
  });

  it("detects captcha and blocked-page text", () => {
    expect(detectBlockedPageText("Please complete the CAPTCHA")).toMatchObject({
      blocked: true,
      reason: "CAPTCHA"
    });

    expect(detectBlockedPageText("Access denied")).toMatchObject({
      blocked: true
    });

    expect(detectBlockedPageText("Sign in to continue")).toMatchObject({
      blocked: true
    });
  });
});
