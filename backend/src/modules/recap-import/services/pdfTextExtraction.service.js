let pdfParseFn;

async function getPdfParse() {
  if (pdfParseFn) return pdfParseFn;
  const mod = await import('pdf-parse');
  pdfParseFn = mod.PDFParse || mod.default || mod;
  return pdfParseFn;
}

export async function defaultPdfLoader(pdfPath) {
  const fs = await import('fs/promises');
  const dataBuffer = await fs.readFile(pdfPath);
  const parse = await getPdfParse();
  const data = await parse(dataBuffer);
  return {
    pages: data.text ? [{ text: data.text }] : [],
    pageCount: data.numpages || 1,
  };
}

export async function extractEmbeddedPdfText({
  pdfPath,
  pdfLoader = defaultPdfLoader,
} = {}) {
  try {
    const loaded = await pdfLoader(pdfPath);

    const text = loaded.pages
      .map((page, index) => `\n\n--- Page ${index + 1} ---\n${page.text || ''}`)
      .join('\n');

    const charCount = text.trim().length;

    return {
      text,
      pageCount: loaded.pageCount ?? loaded.pages.length,
      charCount,
      textQuality: charCount >= 500 ? 'usable' : 'low',
      shouldUseVisionFallback: charCount < 500,
    };
  } catch (error) {
    return {
      text: '',
      pageCount: 0,
      charCount: 0,
      textQuality: 'low',
      shouldUseVisionFallback: true,
      error: error.message,
    };
  }
}
