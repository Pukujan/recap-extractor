import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("visits at most maxPages", async () => {
    const goto = vi.fn().mockResolvedValue({
      status: () => 200,
      url: () => "https://www.courtlistener.com/search/"
    });

    const page = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto,
      title: vi.fn().mockResolvedValue("Search"),
      content: vi.fn().mockResolvedValue("<html><a href='/recap/'>RECAP</a></html>"),
      $$eval: vi.fn().mockResolvedValue([
        "https://www.courtlistener.com/recap/1/",
        "https://www.courtlistener.com/recap/2/",
        "https://www.courtlistener.com/recap/3/"
      ]),
      close: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn()
    };

    const result = await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 2,
      browser,
      delay: vi.fn()
    });

    expect(goto).toHaveBeenCalledTimes(2);
    expect(result.manifest.pagesVisited).toBe(2);
  });

  it("waits between page visits", async () => {
    const page = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue({
        status: () => 200,
        url: () => "https://www.courtlistener.com/"
      }),
      title: vi.fn().mockResolvedValue("CourtListener"),
      content: vi.fn().mockResolvedValue("<html><a href='/recap/1/'>One</a></html>"),
      $$eval: vi.fn().mockResolvedValue(["https://www.courtlistener.com/recap/1/"]),
      close: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn()
    };

    const delay = vi.fn().mockResolvedValue(undefined);

    await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 2,
      browser,
      delay
    });

    expect(delay).toHaveBeenCalled();
  });

  it("stops on 429 and records stoppedReason", async () => {
    const page = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue({
        status: () => 429,
        url: () => "https://www.courtlistener.com/search/"
      }),
      title: vi.fn(),
      content: vi.fn(),
      $$eval: vi.fn(),
      close: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn()
    };

    const result = await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 5,
      browser,
      delay: vi.fn()
    });

    expect(result.manifest.stoppedReason).toBe("HTTP_429");
    expect(result.manifest.pagesVisited).toBe(0);
  });

  it("saves HTML for each visited page", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const page = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue({
        status: () => 200,
        url: () => "https://www.courtlistener.com/"
      }),
      title: vi.fn().mockResolvedValue("CourtListener"),
      content: vi.fn().mockResolvedValue("<html><title>CourtListener</title></html>"),
      $$eval: vi.fn().mockResolvedValue([]),
      close: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn()
    };

    await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 1,
      browser,
      delay: vi.fn(),
      fileStore: {
        writeFile,
        writeJson: vi.fn().mockResolvedValue(undefined),
        ensureDir: vi.fn().mockResolvedValue(undefined)
      }
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/page-001\.html$/),
      expect.stringContaining("<html>")
    );
  });

  it("does not download discovered PDF links", async () => {
    const pdfDownloadService = {
      download: vi.fn()
    };

    const page = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue({
        status: () => 200,
        url: () => "https://www.courtlistener.com/"
      }),
      title: vi.fn().mockResolvedValue("CourtListener"),
      content: vi.fn().mockResolvedValue(
        "<html><a href='https://storage.courtlistener.com/recap/test.pdf'>PDF</a></html>"
      ),
      $$eval: vi.fn().mockResolvedValue([
        "https://storage.courtlistener.com/recap/test.pdf"
      ]),
      close: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn()
    };

    await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 1,
      browser,
      delay: vi.fn(),
      pdfDownloadService
    });

    expect(pdfDownloadService.download).not.toHaveBeenCalled();
  });
});
