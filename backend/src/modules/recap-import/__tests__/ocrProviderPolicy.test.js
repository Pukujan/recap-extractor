import { describe, it, expect } from 'vitest';
import { resolveOcrProvider } from '../agents/documentVisionParser.agent.js';

describe('OCR provider policy', () => {
  it('allows only qwen_vl as OCR provider', () => {
    expect(resolveOcrProvider('qwen_vl')).toBe('qwen_vl');
    expect(() => resolveOcrProvider('tesseract')).toThrow(/unsupported OCR provider/i);
    expect(() => resolveOcrProvider('fallback')).toThrow(/unsupported OCR provider/i);
  });
});
