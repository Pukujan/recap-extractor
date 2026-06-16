import { describe, it, expect } from 'vitest';
import { createMockJsonWriter, mockFolders } from './testHelpers.js';
import { ManifestAgent } from '../agents/manifest.agent.js';

describe('manifest.agent extraction source', () => {
  it('records extraction source and confidence cap status in document manifest', async () => {
    const writer = createMockJsonWriter();
    const agent = new ManifestAgent({ writer });

    const manifest = await agent.run({
      task: { jobId: 'job_1', id: 'task_1' },
      metadata: { source: 'courtlistener', recapDocumentId: '123', docketId: '456' },
      folders: mockFolders(),
      fetched: { hashes: {} },
      parsed: { model: 'qwen/qwen3-vl-8b-instruct' },
      extraction: { confidenceCapApplied: false, confidence: { overall: 0.88 }, model: 'deepseek/deepseek-v4-flash' },
      review: { reviewRequired: false, flags: [] },
      bodySource: {
        extractionSource: 'qwen_vl_ocr',
        bodyTextAvailable: true,
        bodyTextLength: 2500,
        pageImageCount: 3,
        metadataOnly: false,
      },
    });

    expect(manifest.extraction.extractionSource).toBe('qwen_vl_ocr');
    expect(manifest.extraction.bodyTextAvailable).toBe(true);
    expect(manifest.extraction.bodyTextLength).toBe(2500);
    expect(manifest.extraction.confidenceCapApplied).toBe(false);
  });
});
