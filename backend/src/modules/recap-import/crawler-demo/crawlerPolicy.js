const DEFAULT_POLICY = {
  maxPagesDefault: 20,
  maxPagesHardLimit: 20,
  concurrency: 1,
  delayMsMin: 10000,
  delayMsMax: 20000,
  downloadPdfs: false,
  loginAllowed: false,
  stealthAllowed: false,
  proxyRotationAllowed: false,
};

const BLOCKED_PATTERNS = [
  { pattern: /captcha/i, reason: 'CAPTCHA' },
  { pattern: /access denied/i, reason: 'ACCESS_DENIED' },
  { pattern: /sign in/i, reason: 'LOGIN_WALL' },
  { pattern: /please log in/i, reason: 'LOGIN_WALL' },
  { pattern: /terms of service/i, reason: 'TERMS_WARNING' },
  { pattern: /too many requests/i, reason: 'RATE_LIMITED' },
];

export function validateCrawlerOptions(options = {}) {
  const maxPages = options.maxPages ?? DEFAULT_POLICY.maxPagesDefault;
  const q = options.query || '';
  const url = options.url || '';

  if (maxPages > DEFAULT_POLICY.maxPagesHardLimit) {
    throw new Error(`Crawler demo mode hard limit exceeded. maxPages cannot exceed ${DEFAULT_POLICY.maxPagesHardLimit}.`);
  }

  if (options.downloadPdfs) {
    throw new Error('PDF downloading is not allowed in crawler demo mode.');
  }

  return {
    query: q,
    url,
    maxPages,
    concurrency: DEFAULT_POLICY.concurrency,
    downloadPdfs: false,
    loginAllowed: false,
    stealthAllowed: false,
    proxyRotationAllowed: false,
    delayMsMin: DEFAULT_POLICY.delayMsMin,
    delayMsMax: DEFAULT_POLICY.delayMsMax,
  };
}

export function getRandomDelayMs({ min, max, random = Math.random } = {}) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function shouldStopForResponse(response) {
  const status = typeof response.status === 'function' ? response.status() : response.status;
  const url = typeof response.url === 'function' ? response.url() : response.url;

  if (status === 429) return { stop: true, reason: 'HTTP_429' };
  if (status === 403) return { stop: true, reason: 'HTTP_403' };

  return { stop: false, reason: null };
}

export function detectBlockedPageText(text) {
  if (!text) return { blocked: false, reason: null };

  for (const bp of BLOCKED_PATTERNS) {
    if (bp.pattern.test(text)) {
      return { blocked: true, reason: bp.reason };
    }
  }

  return { blocked: false, reason: null };
}

export { DEFAULT_POLICY };
