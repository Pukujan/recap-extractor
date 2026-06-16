import { describe, it, expect, vi } from 'vitest';
import { extractEmbeddedPdfText } from '../../services/pdfTextExtraction.service.js';

describe('pdfTextExtraction.service', () => {
  it('extracts embedded text from a local PDF path', async () => {
    const fakePdfLoader = vi.fn().mockResolvedValue({
      pages: [
        { text: 'Page one complaint text.' },
        { text: 'Page two factual allegations.' },
      ],
      pageCount: 2,
    });

    const result = await extractEmbeddedPdfText({
      pdfPath: '/tmp/source.pdf',
      pdfLoader: fakePdfLoader,
    });

    expect(fakePdfLoader).toHaveBeenCalledWith('/tmp/source.pdf');
    expect(result.text).toContain('Page one complaint text');
    expect(result.text).toContain('Page two factual allegations');
    expect(result.pageCount).toBe(2);
    expect(result.charCount).toBeGreaterThan(20);
  });

  it('marks embedded text as low quality when text is too short', async () => {
    const fakePdfLoader = vi.fn().mockResolvedValue({
      pages: [{ text: 'short' }],
      pageCount: 1,
    });

    const result = await extractEmbeddedPdfText({
      pdfPath: '/tmp/source.pdf',
      pdfLoader: fakePdfLoader,
    });

    expect(result.textQuality).toBe('low');
    expect(result.shouldUseVisionFallback).toBe(true);
  });

  it('handles load failure safely', async () => {
    const fakePdfLoader = vi.fn().mockRejectedValue(new Error('PDF not found'));

    const result = await extractEmbeddedPdfText({
      pdfPath: '/tmp/missing.pdf',
      pdfLoader: fakePdfLoader,
    });

    expect(result.textQuality).toBe('low');
    expect(result.shouldUseVisionFallback).toBe(true);
    expect(result.error).toContain('PDF not found');
  });
});
