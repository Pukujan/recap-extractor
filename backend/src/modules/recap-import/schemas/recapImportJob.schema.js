export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "Unique job identifier" },
    searchTerms: { type: "string", description: "Search terms for RECAP query" },
    court: { type: "string", description: "Court filter (optional)" },
    targetCount: { type: "integer", minimum: 1, maximum: 100, description: "Number of documents to target" },
    ocrMode: { type: "string", enum: ["recap_text_first", "force_ocr"], description: "OCR processing mode" },
    status: { type: "string", enum: ["pending", "running", "complete", "failed"] },
    processedCount: { type: "integer" },
    failedCount: { type: "integer" },
    reviewNeededCount: { type: "integer" },
    queueConcurrency: { type: "integer", default: 1 },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["searchTerms", "targetCount", "ocrMode"],
};
