import { describe, it, expect } from "vitest";
import { parseCrawlerPageResult } from "../crawler-demo/crawlerResultParser.js";

describe("crawlerResultParser", () => {
  it("extracts title and public links from cached HTML", () => {
    const result = parseCrawlerPageResult({
      sourceUrl: "https://www.courtlistener.com/recap/",
      title: "RECAP Archive",
      html: `
        <html>
          <body>
            <h1>RECAP Archive</h1>
            <a href="/recap/123/">Document</a>
            <a href="https://www.courtlistener.com/docket/456/example/">Docket</a>
            <a href="https://storage.courtlistener.com/recap/test.pdf">PDF</a>
            <a href="https://example.com/external">External</a>
            <a href="mailto:test@example.com">Email</a>
          </body>
        </html>
      `,
      htmlCachePath: "data/crawler-demo/run/pages/page-001.html"
    });

    expect(result.title).toBe("RECAP Archive");
    expect(result.linksDiscovered).toContain("https://www.courtlistener.com/recap/123/");
    expect(result.linksDiscovered).toContain("https://www.courtlistener.com/docket/456/example/");
    expect(result.linksDiscovered).not.toContain("https://example.com/external");
    expect(result.pdfLinksDiscovered).toContain("https://storage.courtlistener.com/recap/test.pdf");
    expect(result.htmlCachePath).toBe("data/crawler-demo/run/pages/page-001.html");
    expect(result.crawlMode).toBe("demo_browser_public_pages");
    expect(result.notForBulkRetrieval).toBe(true);
  });

  it("extracts simple case metadata when present in page text", () => {
    const result = parseCrawlerPageResult({
      sourceUrl: "https://www.courtlistener.com/docket/123/example-v-defendant/",
      title: "Example v. Defendant",
      html: `
        <html>
          <body>
            <h1>Example v. Defendant</h1>
            <p>United States District Court for the Southern District of New York</p>
            <p>Docket Number: 1:23-cv-00001</p>
            <p>Motion to Compel Discovery</p>
          </body>
        </html>
      `,
      htmlCachePath: "data/crawler-demo/run/pages/page-001.html"
    });

    expect(result.caseName).toBe("Example v. Defendant");
    expect(result.court).toMatch(/Southern District of New York/);
    expect(result.docketNumber).toBe("1:23-cv-00001");
    expect(result.documentDescription).toMatch(/Motion to Compel/i);
  });
});
