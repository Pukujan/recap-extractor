import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

function makePage() {
  return {
    goto: vi.fn().mockResolvedValue({ status: () => 200, url: () => "https://www.courtlistener.com/" }),
    title: vi.fn().mockResolvedValue("CourtListener"),
    content: vi.fn().mockResolvedValue("<html><title>CourtListener</title></html>"),
    $$eval: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  };
}

function makeBrowser(page) {
  return {
    newContext: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(page),
    }),
    close: vi.fn(),
  };
}

describe("crawler demo no API behavior", () => {
  it("does not call the CourtListener API client", async () => {
    const courtListenerClient = {
      search: vi.fn(),
      searchRecapDocuments: vi.fn(),
      searchRecapDocumentsByType: vi.fn(),
    };

    const page = makePage();
    const browser = makeBrowser(page);

    await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 1,
      browser,
      courtListenerClient,
      delay: vi.fn(),
    });

    expect(courtListenerClient.search).not.toHaveBeenCalled();
    expect(courtListenerClient.searchRecapDocuments).not.toHaveBeenCalled();
    expect(courtListenerClient.searchRecapDocumentsByType).not.toHaveBeenCalled();
  });
});
