import { describe, it, expect, vi } from 'vitest';
import { writeExtractionSourceFile } from '../services/documentBodyProcessing.service.js';

describe('extraction source file', () => {
  it('writes extraction_source.json into parsed folder', async () => {
    const writeJson = vi.fn().mockResolvedValue(undefined);

    await writeExtractionSourceFile({
      parsedDir: '/tmp/doc/parsed',
      bodySource: {
        extractionSource: 'pdf_embedded_text',
        bodyTextAvailable: true,
        bodyTextLength: 1000,
        pageImageCount: 0,
        metadataOnly: false,
        confidenceCapApplied: false,
      },
      fileStore: { writeJson },
    });

    expect(writeJson).toHaveBeenCalledWith(
      '/tmp/doc/parsed/extraction_source.json',
      expect.objectContaining({
        extractionSource: 'pdf_embedded_text',
        bodyTextAvailable: true,
        metadataOnly: false,
      })
    );
  });
});
