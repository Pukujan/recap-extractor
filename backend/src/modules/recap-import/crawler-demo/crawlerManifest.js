import { DEFAULT_POLICY } from './crawlerPolicy.js';

export function buildCrawlerManifest({
  query,
  url,
  maxPages = DEFAULT_POLICY.maxPagesDefault,
  stoppedReason = null,
  pagesVisited = 0,
  startedAt = new Date().toISOString(),
} = {}) {
  return {
    crawlMode: 'demo_browser_public_pages',
    notForBulkRetrieval: true,
    query: query || null,
    startUrl: url || (query ? `https://www.courtlistener.com/?q=${encodeURIComponent(query)}` : null),
    maxPages,
    hardMaxPages: DEFAULT_POLICY.maxPagesHardLimit,
    concurrency: DEFAULT_POLICY.concurrency,
    delayMsMin: DEFAULT_POLICY.delayMsMin,
    delayMsMax: DEFAULT_POLICY.delayMsMax,
    downloadPdfs: false,
    loginUsed: false,
    stealthUsed: false,
    proxyRotationUsed: false,
    stoppedReason,
    pagesVisited,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
