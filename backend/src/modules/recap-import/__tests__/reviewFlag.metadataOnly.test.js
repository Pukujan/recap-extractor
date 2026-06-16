import { describe, it, expect } from 'vitest';
import { buildReviewFlags } from '../agents/reviewFlag.agent.js';

describe('reviewFlag.agent metadata-only behavior', () => {
  it('flags metadata-only extraction for human review', () => {
    const flags = buildReviewFlags({
      extractionSource: 'metadata_only',
      bodyTextAvailable: false,
      extractedLegal: { confidence: { overall: 0.45 } },
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe('METADATA_ONLY_EXTRACTION');
    expect(flags[0].severity).toBe('high');
  });

  it('does not flag body-based extraction', () => {
    const flags = buildReviewFlags({
      extractionSource: 'pdf_embedded_text',
      bodyTextAvailable: true,
    });

    expect(flags).toHaveLength(0);
  });
});
