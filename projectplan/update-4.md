# update-4.md — Bounded Playwright Public-Page Crawler Demo Mode

## Goal

Add a **Playwright-based crawler demo mode** that shows the extractor can navigate public CourtListener web pages like a browser, collect public page metadata, cache HTML locally, and hand discovered page content into the local extraction/demo pipeline.

This is **not** the production ingestion path.

The production path remains:

```txt
CourtListener API → local cache → PDF/text/body extraction → legal extraction
```

This update adds a bounded showcase mode:

```txt
Public CourtListener web page → Playwright browser crawl → local HTML cache → extracted public-page metadata → optional local extraction preview
```

---

## Why This Exists

The API is rate-limited, which is annoying for MVP demos. But we should not build a scraper that tries to bypass rate limits.

This mode exists only to demonstrate:

```txt
- Browser navigation capability
- Public-page parsing
- Crawler politeness controls
- Local HTML caching
- Traceable crawler output
```

It must not be used for bulk document harvesting.

---

## Non-Negotiable Safety Limits

Default behavior:

```txt
maxPages = 5
hardMaxPages = 10
concurrency = 1
delayMs = random 10,000–20,000 ms between page loads
downloadPdfs = false
login = false
stealth = false
proxyRotation = false
```

The crawler must stop immediately on:

```txt
HTTP 403
HTTP 429
CAPTCHA page
blocked page
login wall
robots/terms warning page
unexpected redirect to auth/login
```

Do not add:

```txt
CAPTCHA bypass
stealth plugins
proxy rotation
login scraping
cookie import
parallel workers
bulk PDF downloads
auto-retry loops against 403/429
NYSCEF scraping
PACER login scraping
```

---

## Required Command

Add:

```bash
npm run demo:crawl-courtlistener -- --query="motion to compel" --maxPages=5
```

Optional direct URL mode:

```bash
npm run demo:crawl-courtlistener -- --url="https://www.courtlistener.com/recap/" --maxPages=5
```

Hard reject:

```bash
npm run demo:crawl-courtlistener -- --query="motion to compel" --maxPages=100
```

Expected error:

```txt
Crawler demo mode hard limit exceeded. maxPages cannot exceed 10.
```

---

## Output Directory

Write every run to:

```txt
data/crawler-demo/
  run-{timestamp}/
    pages/
      page-001.html
      page-002.html
    extracted/
      crawler_results.json
    manifest.json
    logs/
      crawl.log
```

---

## Manifest Shape

`manifest.json` must include:

```json
{
  "crawlMode": "demo_browser_public_pages",
  "notForBulkRetrieval": true,
  "query": "motion to compel",
  "startUrl": "https://www.courtlistener.com/...",
  "maxPages": 5,
  "hardMaxPages": 10,
  "concurrency": 1,
  "delayMsMin": 10000,
  "delayMsMax": 20000,
  "downloadPdfs": false,
  "loginUsed": false,
  "stealthUsed": false,
  "proxyRotationUsed": false,
  "stoppedReason": null,
  "pagesVisited": 0,
  "startedAt": "ISO_DATE",
  "finishedAt": "ISO_DATE"
}
```

If stopped on rate limit/block:

```json
{
  "stoppedReason": "HTTP_429"
}
```

---

## Crawler Results Shape

`crawler_results.json` must include an array:

```json
[
  {
    "sourceUrl": "https://www.courtlistener.com/...",
    "title": "Page title",
    "caseName": "Example v. Defendant",
    "court": "United States District Court...",
    "docketNumber": "1:23-cv-00001",
    "documentDescription": "Motion to compel",
    "linksDiscovered": [
      "https://www.courtlistener.com/..."
    ],
    "pdfLinksDiscovered": [],
    "htmlCachePath": "data/crawler-demo/run-.../pages/page-001.html",
    "crawlMode": "demo_browser_public_pages",
    "notForBulkRetrieval": true
  }
]
```

PDF links may be discovered but must not be downloaded in this mode.

---

## Implementation Files

Add:

```txt
backend/src/modules/recap-import/crawler-demo/
  playwrightCrawlerDemo.service.js
  crawlerPolicy.js
  crawlerResultParser.js
  crawlerManifest.js
  crawlerFileStore.js

scripts/
  demo-crawl-courtlistener.js

backend/src/modules/recap-import/__tests__/
  crawlerPolicy.test.js
  playwrightCrawlerDemo.service.test.js
  crawlerResultParser.test.js
  crawlerManifest.test.js
  crawlerNoApi.test.js
```

Update `package.json`:

```json
{
  "scripts": {
    "demo:crawl-courtlistener": "node scripts/demo-crawl-courtlistener.js"
  }
}
```

Add dependency if missing:

```bash
npm install -D playwright
npx playwright install chromium
```

Use Chromium only.

---

## Crawler Policy Module

Create:

```txt
backend/src/modules/recap-import/crawler-demo/crawlerPolicy.js
```

Exports:

```js
export function validateCrawlerOptions(options) {}
export function getRandomDelayMs({ min, max, random }) {}
export function shouldStopForResponse(response) {}
export function detectBlockedPageText(text) {}
```

Policy:

```js
const DEFAULT_POLICY = {
  maxPagesDefault: 5,
  maxPagesHardLimit: 10,
  concurrency: 1,
  delayMsMin: 10000,
  delayMsMax: 20000,
  downloadPdfs: false,
  loginAllowed: false,
  stealthAllowed: false,
  proxyRotationAllowed: false
};
```

---

## TDD Requirement

Write red tests first.

Do not implement production crawler code until tests fail for the expected missing behavior.

All existing tests must keep passing.

---

# Red Tests

## 1. Refuses maxPages above hard limit

File:

```txt
backend/src/modules/recap-import/__tests__/crawlerPolicy.test.js
```

Test:

```js
import { describe, it, expect } from "vitest";
import { validateCrawlerOptions } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("refuses maxPages above hard limit", () => {
    expect(() =>
      validateCrawlerOptions({
        query: "motion to compel",
        maxPages: 100
      })
    ).toThrow(/hard limit/i);
  });
});
```

---

## 2. Defaults to maxPages 5 and concurrency 1

```js
import { describe, it, expect } from "vitest";
import { validateCrawlerOptions } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
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
});
```

---

## 3. Rejects PDF download mode

```js
import { describe, it, expect } from "vitest";
import { validateCrawlerOptions } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("rejects PDF downloading in crawler demo mode", () => {
    expect(() =>
      validateCrawlerOptions({
        query: "motion to compel",
        downloadPdfs: true
      })
    ).toThrow(/pdf download/i);
  });
});
```

---

## 4. Random delay stays between 10 and 20 seconds

```js
import { describe, it, expect } from "vitest";
import { getRandomDelayMs } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("generates polite delay between page visits", () => {
    const delay = getRandomDelayMs({
      min: 10000,
      max: 20000,
      random: () => 0.5
    });

    expect(delay).toBeGreaterThanOrEqual(10000);
    expect(delay).toBeLessThanOrEqual(20000);
  });
});
```

---

## 5. Stops on HTTP 429

```js
import { describe, it, expect } from "vitest";
import { shouldStopForResponse } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("stops immediately on HTTP 429", () => {
    const response = {
      status: () => 429,
      url: () => "https://www.courtlistener.com/search/"
    };

    const result = shouldStopForResponse(response);

    expect(result.stop).toBe(true);
    expect(result.reason).toBe("HTTP_429");
  });
});
```

---

## 6. Stops on HTTP 403

```js
import { describe, it, expect } from "vitest";
import { shouldStopForResponse } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("stops immediately on HTTP 403", () => {
    const response = {
      status: () => 403,
      url: () => "https://www.courtlistener.com/search/"
    };

    const result = shouldStopForResponse(response);

    expect(result.stop).toBe(true);
    expect(result.reason).toBe("HTTP_403");
  });
});
```

---

## 7. Detects CAPTCHA or blocked page text

```js
import { describe, it, expect } from "vitest";
import { detectBlockedPageText } from "../crawler-demo/crawlerPolicy.js";

describe("crawlerPolicy", () => {
  it("detects captcha and blocked-page text", () => {
    expect(detectBlockedPageText("Please complete the CAPTCHA")).toMatchObject({
      blocked: true,
      reason: "CAPTCHA"
    });

    expect(detectBlockedPageText("Access denied")).toMatchObject({
      blocked: true
    });
  });
});
```

---

## 8. Crawler does not call CourtListener API client

File:

```txt
backend/src/modules/recap-import/__tests__/crawlerNoApi.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("crawler demo no API behavior", () => {
  it("does not call the CourtListener API client", async () => {
    const courtListenerClient = {
      search: vi.fn(),
      searchRecapDocuments: vi.fn()
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue({ status: () => 200, url: () => "https://www.courtlistener.com/" }),
        title: vi.fn().mockResolvedValue("CourtListener"),
        content: vi.fn().mockResolvedValue("<html><title>CourtListener</title></html>"),
        $$eval: vi.fn().mockResolvedValue([]),
        close: vi.fn()
      }),
      close: vi.fn()
    };

    await runCourtListenerCrawlerDemo({
      query: "motion to compel",
      maxPages: 1,
      browser,
      courtListenerClient,
      delay: vi.fn()
    });

    expect(courtListenerClient.search).not.toHaveBeenCalled();
    expect(courtListenerClient.searchRecapDocuments).not.toHaveBeenCalled();
  });
});
```

---

## 9. Crawler visits at most maxPages

File:

```txt
backend/src/modules/recap-import/__tests__/playwrightCrawlerDemo.service.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("visits at most maxPages", async () => {
    const goto = vi.fn().mockResolvedValue({
      status: () => 200,
      url: () => "https://www.courtlistener.com/search/"
    });

    const page = {
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
});
```

---

## 10. Crawler waits between page visits

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("waits between page visits", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue({ status: () => 200, url: () => "https://www.courtlistener.com/" }),
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
});
```

---

## 11. Crawler stops on 429 and records stoppedReason

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("stops on 429 and records stoppedReason", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue({ status: () => 429, url: () => "https://www.courtlistener.com/search/" }),
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
});
```

---

## 12. Crawler saves HTML cache for visited page

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("saves HTML for each visited page", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const page = {
      goto: vi.fn().mockResolvedValue({ status: () => 200, url: () => "https://www.courtlistener.com/" }),
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
});
```

---

## 13. Parser extracts basic page metadata

File:

```txt
backend/src/modules/recap-import/__tests__/crawlerResultParser.test.js
```

Test:

```js
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
          </body>
        </html>
      `,
      htmlCachePath: "data/crawler-demo/run/pages/page-001.html"
    });

    expect(result.title).toBe("RECAP Archive");
    expect(result.linksDiscovered).toContain("https://www.courtlistener.com/recap/123/");
    expect(result.pdfLinksDiscovered).toContain("https://storage.courtlistener.com/recap/test.pdf");
    expect(result.notForBulkRetrieval).toBe(true);
  });
});
```

---

## 14. Crawler does not download discovered PDF links

```js
import { describe, it, expect, vi } from "vitest";
import { runCourtListenerCrawlerDemo } from "../crawler-demo/playwrightCrawlerDemo.service.js";

describe("playwrightCrawlerDemo.service", () => {
  it("does not download discovered PDF links", async () => {
    const pdfDownloadService = {
      download: vi.fn()
    };

    const page = {
      goto: vi.fn().mockResolvedValue({ status: () => 200, url: () => "https://www.courtlistener.com/" }),
      title: vi.fn().mockResolvedValue("CourtListener"),
      content: vi.fn().mockResolvedValue("<html><a href='https://storage.courtlistener.com/recap/test.pdf'>PDF</a></html>"),
      $$eval: vi.fn().mockResolvedValue(["https://storage.courtlistener.com/recap/test.pdf"]),
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
```

---

## 15. Manifest marks crawler as demo-only

File:

```txt
backend/src/modules/recap-import/__tests__/crawlerManifest.test.js
```

Test:

```js
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
    expect(manifest.concurrency).toBe(1);
  });
});
```

---

## 16. CLI rejects missing query and missing URL

File:

```txt
backend/src/modules/recap-import/__tests__/demoCrawlerCli.test.js
```

Test:

```js
import { describe, it, expect } from "vitest";
import { parseCrawlerCliArgs } from "../../../../../scripts/demo-crawl-courtlistener.js";

describe("demo crawler CLI", () => {
  it("requires either query or url", () => {
    expect(() => parseCrawlerCliArgs([])).toThrow(/query or url/i);
  });
});
```

---

## 17. CLI parses query and maxPages

```js
import { describe, it, expect } from "vitest";
import { parseCrawlerCliArgs } from "../../../../../scripts/demo-crawl-courtlistener.js";

describe("demo crawler CLI", () => {
  it("parses query and maxPages", () => {
    const args = parseCrawlerCliArgs([
      "--query=motion to compel",
      "--maxPages=5"
    ]);

    expect(args.query).toBe("motion to compel");
    expect(args.maxPages).toBe(5);
  });
});
```

---

# Implementation Notes

## Start URL

For query mode, generate a public CourtListener search URL.

Example:

```js
const startUrl = `https://www.courtlistener.com/?q=${encodeURIComponent(query)}`;
```

Or use the public RECAP search page if current app already knows the route.

Do not use `/api/rest/v4/search/` in crawler demo mode.

---

## Link Filtering

Only follow CourtListener public links:

```txt
https://www.courtlistener.com/...
```

Do not follow:

```txt
external domains
login URLs
logout URLs
account/profile URLs
API URLs
download/PDF URLs
javascript:
mailto:
```

PDF links can be recorded in `pdfLinksDiscovered`, but not downloaded.

---

## Delay

Implement:

```js
await delay(randomDelayMs);
```

Between page visits.

No delay needed after the final page.

---

## Page Visit Algorithm

Pseudo-code:

```js
queue = [startUrl]
visited = new Set()
results = []

while queue not empty and visited.size < maxPages:
  url = queue.shift()

  if visited has url:
    continue

  response = await page.goto(url, { waitUntil: "domcontentloaded" })

  if shouldStopForResponse(response):
    manifest.stoppedReason = reason
    break

  html = await page.content()

  blocked = detectBlockedPageText(html)
  if blocked.blocked:
    manifest.stoppedReason = blocked.reason
    break

  save html to pages/page-N.html

  parsed = parseCrawlerPageResult(...)
  results.push(parsed)

  for each link in parsed.linksDiscovered:
    if allowed and not visited:
      queue.push(link)

  visited.add(url)

  if visited.size < maxPages:
    await delay(randomDelayMs)
```

---

## Manual Verification Command

After implementation:

```bash
npm run demo:crawl-courtlistener -- --query="motion to compel" --maxPages=5
```

Then inspect:

```bash
find ./data/crawler-demo -maxdepth 5 -type f | sort
find ./data/crawler-demo -name manifest.json -print -exec jq "." {} \;
find ./data/crawler-demo -name crawler_results.json -print -exec jq "." {} \;
```

Expected:

```txt
- max 5 HTML pages saved
- manifest says notForBulkRetrieval: true
- no PDFs downloaded
- no CourtListener API called
- delay used between pages
- results include public links and page titles
```

---

## Acceptance Criteria

Done only when:

```txt
1. Red tests are written first.
2. Red tests fail before implementation.
3. Implementation passes all old and new tests.
4. npm run demo:crawl-courtlistener exists.
5. Crawler hard-rejects maxPages > 10.
6. Crawler defaults to maxPages 5.
7. Crawler uses concurrency 1.
8. Crawler delays 10–20 seconds between pages.
9. Crawler stops on 403/429/CAPTCHA/blocked pages.
10. Crawler does not use login, cookies, stealth, proxies, or CAPTCHA bypass.
11. Crawler does not call CourtListener API client.
12. Crawler does not download PDFs.
13. Crawler writes cached HTML pages.
14. Crawler writes crawler_results.json.
15. Crawler writes manifest.json with notForBulkRetrieval: true.
16. Existing RECAP API extractor still works unchanged.
```

---

## Current Working Note

This is a showcase crawler, not a production data acquisition path. It proves browser crawling and public-page parsing capability while keeping the real extraction product grounded in API, local cache, and explicit document-body source tracking.
