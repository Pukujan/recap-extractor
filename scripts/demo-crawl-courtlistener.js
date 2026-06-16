import { validateCrawlerOptions } from '../backend/src/modules/recap-import/crawler-demo/crawlerPolicy.js';

export function parseCrawlerCliArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--query=')) args.query = arg.slice(8);
    else if (arg.startsWith('--url=')) args.url = arg.slice(6);
    else if (arg.startsWith('--maxPages=')) args.maxPages = parseInt(arg.slice(11), 10);
  }

  if (!args.query && !args.url) {
    args.query = 'motion to compel';
    args.maxPages = args.maxPages || 20;
  }

  const options = validateCrawlerOptions(args);
  return options;
}

async function main() {
  const options = parseCrawlerCliArgs(process.argv.slice(2));

  console.log(`[crawler-demo] Starting crawl: query="${options.query || options.url}" maxPages=${options.maxPages}`);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  const fs = await import('fs/promises');
  const path = await import('path');

  const fileStore = {
    ensureDir: async (dirPath) => fs.mkdir(path.resolve(dirPath), { recursive: true }),
    writeFile: async (filePath, content) => {
      const absPath = path.resolve(filePath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content, 'utf8');
    },
    writeJson: async (filePath, data) => {
      const absPath = path.resolve(filePath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, JSON.stringify(data, null, 2), 'utf8');
    },
  };

  const { runCourtListenerCrawlerDemo } = await import(
    '../backend/src/modules/recap-import/crawler-demo/playwrightCrawlerDemo.service.js'
  );

  const result = await runCourtListenerCrawlerDemo({
    query: options.query,
    url: options.url,
    maxPages: options.maxPages,
    browser,
    fileStore,
  });

  console.log(`[crawler-demo] Done. Pages visited: ${result.manifest.pagesVisited}`);
  if (result.manifest.stoppedReason) {
    console.log(`[crawler-demo] Stopped reason: ${result.manifest.stoppedReason}`);
  }
  console.log(`[crawler-demo] Output: ${JSON.stringify(result.results, null, 2)}`);

  await browser.close();
}

const isMain = process.argv[1] && (process.argv[1].endsWith('demo-crawl-courtlistener.js') || process.argv[1].endsWith('scripts/demo-crawl-courtlistener.js'));
if (isMain) {
  main().catch((err) => {
    console.error('[crawler-demo] Error:', err.message);
    process.exit(1);
  });
}
