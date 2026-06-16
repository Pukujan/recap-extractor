import { describe, it, expect } from 'vitest';
import { applyExtractionConfidencePolicy, buildLegalExtractionInput } from '../agents/legalExtraction.agent.js';

describe('legalExtraction confidence policy', () => {
  it('caps overall confidence to 0.45 when extraction source is metadata_only', () => {
    const extraction = { confidence: { overall: 0.95 } };
    const result = applyExtractionConfidencePolicy({ extraction, extractionSource: 'metadata_only' });
    expect(result.confidence.overall).toBeLessThanOrEqual(0.45);
    expect(result.confidenceCapApplied).toBe(true);
  });

  it('does not cap confidence when extraction uses document body text', () => {
    const extraction = { confidence: { overall: 0.95 } };
    const result = applyExtractionConfidencePolicy({ extraction, extractionSource: 'pdf_embedded_text' });
    expect(result.confidence.overall).toBe(0.95);
    expect(result.confidenceCapApplied).toBe(false);
  });
});

describe('legalExtraction input building', () => {
  it('passes selected body text into DeepSeek extraction input', () => {
    const input = buildLegalExtractionInput({
      sourceMetadata: { description: 'Motion to compel', caseName: 'Example v. Defendant' },
      bodySource: {
        extractionSource: 'pdf_embedded_text',
        text: 'Actual motion body text with arguments and relief requested.',
        bodyTextAvailable: true,
        metadataOnly: false,
      },
    });

    expect(input).toContain('Actual motion body text');
    expect(input).toContain('pdf_embedded_text');
    expect(input).toContain('Motion to compel');
  });
});
