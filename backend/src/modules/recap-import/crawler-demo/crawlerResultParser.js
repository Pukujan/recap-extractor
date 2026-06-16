const CL_BASE = 'https://www.courtlistener.com';
const STORAGE_BASE = 'https://storage.courtlistener.com';

function isCourtListenerLink(href) {
  if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return false;
  const resolved = href.startsWith('http') ? href : `${CL_BASE}${href}`;
  return resolved.startsWith(CL_BASE) || resolved.startsWith(STORAGE_BASE);
}

function isPdfLink(href) {
  return href.toLowerCase().endsWith('.pdf');
}

function resolveUrl(href) {
  if (href.startsWith('http')) return href;
  return `${CL_BASE}${href}`;
}

const LINK_RE = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
const CASE_NAME_RE = /<h1[^>]*>([^<]+)<\/h1>/i;
const COURT_RE = /<p>(United States\s+(?:District|Bankruptcy|Circuit)\s+Court[^<]*)<\/p>/i;
const DOCKET_RE = /Docket\s+Number[:\s]+([^\s<,]+)/i;
const DESC_RE = /<p>(Motion\s+to\s+\w+[^<]*)<\/p>/i;

export function parseCrawlerPageResult({ sourceUrl, title, html, htmlCachePath } = {}) {
  const linksDiscovered = [];
  const pdfLinksDiscovered = [];

  let match;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(html)) !== null) {
    const href = match[1].trim();
    if (!isCourtListenerLink(href)) continue;
    const resolved = resolveUrl(href);

    if (isPdfLink(resolved)) {
      if (!pdfLinksDiscovered.includes(resolved)) pdfLinksDiscovered.push(resolved);
    } else {
      if (!linksDiscovered.includes(resolved)) linksDiscovered.push(resolved);
    }
  }

  const caseMatch = html.match(CASE_NAME_RE);
  const courtMatch = html.match(COURT_RE);
  const docketMatch = html.match(DOCKET_RE);
  const descMatch = html.match(DESC_RE);

  return {
    sourceUrl: sourceUrl || null,
    title: title || null,
    caseName: caseMatch ? caseMatch[1].trim() : null,
    court: courtMatch ? courtMatch[1].trim() : null,
    docketNumber: docketMatch ? docketMatch[1].trim() : null,
    documentDescription: descMatch ? descMatch[1].trim() : null,
    linksDiscovered,
    pdfLinksDiscovered,
    htmlCachePath: htmlCachePath || null,
    crawlMode: 'demo_browser_public_pages',
    notForBulkRetrieval: true,
  };
}
