const MIN_TEXT_CHARS = 1000;
const MIN_CHARS_PER_PAGE = 500;
const MAX_GARBAGE_RATIO = 0.15;
const UNUSABLE_OCR_STATUSES = new Set(['failed', 'incomplete', 'partial', 'unavailable']);

export class TextTriageAgent {
  async run(input) {
    const {
      plainText = '',
      plainTextExists = false,
      pdfExists = false,
      pageCount = null,
      forceOcr = false,
      ocrStatus = null,
      needsLayoutParsing = false,
      needsCoordinateReview = false,
    } = input;

    if (!plainTextExists && !pdfExists) {
      return {
        requiresOcr: false,
        reason: 'source_unavailable',
        textQuality: null,
        sourceUnavailable: true,
      };
    }

    if (forceOcr) {
      return {
        requiresOcr: true,
        reason: 'force_ocr',
        textQuality: this._assessTextQuality(plainText),
        sourceUnavailable: false,
      };
    }

    if (!plainTextExists || plainText.trim().length === 0) {
      return {
        requiresOcr: true,
        reason: 'plain_text_missing',
        textQuality: null,
        sourceUnavailable: false,
      };
    }

    if (pageCount != null && plainText.length < pageCount * MIN_CHARS_PER_PAGE) {
      return {
        requiresOcr: true,
        reason: 'plain_text_too_short_for_page_count',
        textQuality: 'insufficient',
        sourceUnavailable: false,
      };
    }

    if (this._looksGarbled(plainText)) {
      return {
        requiresOcr: true,
        reason: 'plain_text_garbled',
        textQuality: 'garbled',
        sourceUnavailable: false,
      };
    }

    if (ocrStatus && UNUSABLE_OCR_STATUSES.has(ocrStatus.toLowerCase())) {
      return {
        requiresOcr: true,
        reason: 'recap_ocr_status_not_usable',
        textQuality: 'ocr_status_unusable',
        sourceUnavailable: false,
      };
    }

    if (needsLayoutParsing) {
      return {
        requiresOcr: true,
        reason: 'layout_parsing_required',
        textQuality: 'needs_layout_parsing',
        sourceUnavailable: false,
      };
    }

    if (needsCoordinateReview) {
      return {
        requiresOcr: true,
        reason: 'coordinate_review_required',
        textQuality: 'needs_coordinate_review',
        sourceUnavailable: false,
      };
    }

    return {
      requiresOcr: false,
      reason: 'plain_text_usable',
      textQuality: 'usable',
      sourceUnavailable: false,
    };
  }

  _looksGarbled(text) {
    if (!text || text.length === 0) return false;
    let garbageCount = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const isDigit = code >= 48 && code <= 57;
      const isSpace = code === 32 || code === 9 || code === 10 || code === 13;
      const isPunct = [46, 44, 59, 58, 33, 63, 39, 34, 40, 41, 91, 93, 123, 125, 45, 47].includes(code);
      if (!isLetter && !isDigit && !isSpace && !isPunct) {
        garbageCount++;
      }
    }
    return garbageCount / text.length > MAX_GARBAGE_RATIO;
  }

  _assessTextQuality(text) {
    if (!text || text.length === 0) return null;
    if (text.length < MIN_TEXT_CHARS) return 'insufficient';
    if (this._looksGarbled(text)) return 'garbled';
    return 'usable';
  }
}
