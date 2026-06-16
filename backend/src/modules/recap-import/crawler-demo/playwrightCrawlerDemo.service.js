import { validateCrawlerOptions, shouldStopForResponse, detectBlockedPageText, getRandomDelayMs } from './crawlerPolicy.js';
import { parseCrawlerPageResult } from './crawlerResultParser.js';
import { buildCrawlerManifest } from './crawlerManifest.js';

export async function runCourtListenerCrawlerDemo({
  query = '',
  url = '',
  maxPages,
  browser,
  delay,
  fileStore,
  courtListenerClient,
  pdfDownloadService,
} = {}) {
  const options = validateCrawlerOptions({ query, url, maxPages });
  const startUrl = options.url || `https://www.courtlistener.com/?q=${encodeURIComponent(options.query)}`;

  const manifest = buildCrawlerManifest({
    query: options.query,
    url: options.url,
    maxPages: options.maxPages,
  });

  const results = [];
  const queue = [startUrl];
  const visited = new Set();
  const runDir = `data/crawler-demo/run-${Date.now()}`;
  let stoppedReason = null;

  if (!delay) {
    delay = (ms) => new Promise((r) => setTimeout(r, ms));
  }

  const _delay = delay;

  while (queue.length > 0 && visited.size < options.maxPages) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;

    let page;
    try {
      page = await browser.newPage();
      const response = await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });

      const stopCheck = shouldStopForResponse(response);
      if (stopCheck.stop) {
        stoppedReason = stopCheck.reason;
        break;
      }

      visited.add(currentUrl);

      const html = await page.content();

      const blocked = detectBlockedPageText(html);
      if (blocked.blocked) {
        stoppedReason = blocked.reason;
        break;
      }

      const title = await page.title();
      const pageNum = String(visited.size).padStart(3, '0');
      const htmlCachePath = `${runDir}/pages/page-${pageNum}.html`;

      if (fileStore) {
        await fileStore.ensureDir(`${runDir}/pages`);
        await fileStore.writeFile(htmlCachePath, html);
      }

      const parsed = parseCrawlerPageResult({
        sourceUrl: currentUrl,
        title,
        html,
        htmlCachePath,
      });

      results.push(parsed);

      for (const link of parsed.linksDiscovered) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    } finally {
      if (page) await page.close();
    }

    if (visited.size < options.maxPages) {
      const delayMs = getRandomDelayMs({
        min: options.delayMsMin,
        max: options.delayMsMax,
      });
      await _delay(delayMs);
    }
  }

  const finalManifest = buildCrawlerManifest({
    query: options.query,
    url: options.url,
    maxPages: options.maxPages,
    stoppedReason,
    pagesVisited: visited.size,
  });

  if (fileStore) {
    await fileStore.writeJson(`${runDir}/manifest.json`, finalManifest);
    await fileStore.writeJson(`${runDir}/extracted/crawler_results.json`, results);
  }

  if (browser) {
    await browser.close();
  }

  return { manifest: finalManifest, results };
}
