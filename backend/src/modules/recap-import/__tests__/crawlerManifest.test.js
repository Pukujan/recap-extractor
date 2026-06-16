import { describe, it, expect } from "vitest";
import { buildCrawlerManifest } from "../crawler-demo/crawlerManifest.js";

describe("crawlerManifest", () => {
  it("marks crawler run as demo-only and not for bulk retrieval", () => {
    const manifest = buildCrawlerManifest({
      query: "motion to compel",
      maxPages: 5
    });

    expect(manifest.crawlMode).toBe("demo_browser_public_pages");
    expect(manifest.notForBulkRetrieval).toBe(true);
    expect(manifest.downloadPdfs).toBe(false);
    expect(manifest.loginUsed).toBe(false);
    expect(manifest.stealthUsed).toBe(false);
    expect(manifest.proxyRotationUsed).toBe(false);
    expect(manifest.concurrency).toBe(1);
    expect(manifest.hardMaxPages).toBe(10);
  });

  it("records stoppedReason when crawler is blocked", () => {
    const manifest = buildCrawlerManifest({
      query: "motion to compel",
      maxPages: 5,
      stoppedReason: "HTTP_429",
      pagesVisited: 0
    });

    expect(manifest.stoppedReason).toBe("HTTP_429");
    expect(manifest.pagesVisited).toBe(0);
  });
});
