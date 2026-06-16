const SIGNATURE_PATTERNS = [
  /\/s\//i,
  /Respectfully submitted/i,
  /s\/\s*\w+/i,
  /\/s\/\s*\w+/i,
  /^_{3,}\s*$/m,
  /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\)?\s*$/m,
];

export class ReviewFlagAgent {
  async run(input) {
    const { parsed, metadata } = input;
    const flags = [];

    const reviewFlags = parsed.reviewFlags || [];
    for (const rf of reviewFlags) {
      flags.push({ ...rf });
    }

    const pages = parsed.pages || [];
    for (const page of pages) {
      const text = page.text || "";
      for (const pattern of SIGNATURE_PATTERNS) {
        if (pattern.test(text)) {
          flags.push({
            flagType: "signature_possible",
            severity: "medium",
            page: page.page,
            reason: "Signature pattern detected in text.",
            confidence: 0.7,
            bboxAvailable: false,
            bbox: null,
          });
          break;
        }
      }

      if (!text || text.trim().length === 0) {
        flags.push({
          flagType: "missing_page_text",
          severity: "high",
          page: page.page,
          reason: "Page has no extracted text.",
          confidence: 1.0,
          bboxAvailable: false,
          bbox: null,
        });
      }
    }

    const layoutSummary = parsed.layoutSummary || [];
    for (const ls of layoutSummary) {
      if (ls.hasHandwriting) {
        flags.push({
          flagType: "handwriting_possible",
          severity: "medium",
          page: ls.page,
          reason: "Handwriting detected in layout summary.",
          confidence: 0.8,
          bboxAvailable: false,
          bbox: null,
        });
      }
    }

    return {
      reviewRequired: flags.length > 0,
      flags,
    };
  }
}
