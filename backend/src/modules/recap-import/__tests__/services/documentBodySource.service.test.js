import { describe, it, expect } from 'vitest';
import { chooseDocumentBodySource } from '../../services/documentBodySource.service.js';

describe('documentBodySource.service', () => {
  it('uses CourtListener plain_text as the highest priority body source', () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: 'CourtListener body text '.repeat(100),
      pdfEmbeddedText: 'PDF embedded text '.repeat(100),
      qwenVisionText: 'OCR text '.repeat(100),
      metadataText: 'metadata only',
    });

    expect(result.extractionSource).toBe('courtlistener_plain_text');
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.text).toContain('CourtListener body text');
  });

  it('uses embedded PDF text when CourtListener plain_text is missing', () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: '',
      pdfEmbeddedText: 'Embedded PDF body text '.repeat(100),
      qwenVisionText: '',
      metadataText: 'metadata only',
    });

    expect(result.extractionSource).toBe('pdf_embedded_text');
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.bodyTextLength).toBeGreaterThan(500);
  });

  it('uses Qwen-VL OCR when embedded PDF text is below quality threshold', () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: '',
      pdfEmbeddedText: 'too short',
      qwenVisionText: 'OCR extracted body text '.repeat(100),
      metadataText: 'metadata only',
    });

    expect(result.extractionSource).toBe('qwen_vl_ocr');
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.text).toContain('OCR extracted body text');
  });

  it('uses metadata_only only when no real body source exists', () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: '',
      pdfEmbeddedText: '',
      qwenVisionText: '',
      metadataText: 'Motion to compel filed by defendant',
    });

    expect(result.extractionSource).toBe('metadata_only');
    expect(result.bodyTextAvailable).toBe(false);
    expect(result.metadataOnly).toBe(true);
    expect(result.text).toContain('Motion to compel');
  });
});
