export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    requiresOcr: { type: "boolean", description: "Whether OCR is required" },
    reason: {
      type: "string",
      enum: ["plain_text_usable", "ocr_needed", "no_text_available", "pdf_unavailable"],
      description: "Reason for OCR decision",
    },
    plainTextLength: { type: "integer", description: "Length of available plain text" },
    plainTextPreview: { type: "string", description: "First characters of plain text" },
    pageCount: { type: "integer" },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence in the triage decision" },
  },
  required: ["requiresOcr", "reason"],
};
