export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    pageNumber: { type: "integer", description: "Page number in document" },
    text: { type: "string", description: "Extracted text from page image" },
    provider: { type: "string", enum: ["qwen_vl"], description: "Vision provider used" },
    model: { type: "string", description: "Model identifier used" },
    rawResponse: { type: "object", description: "Raw API response for audit" },
    tokensUsed: { type: "integer", description: "Token count for billing" },
    processingTimeMs: { type: "integer", description: "Time to process this page" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["pageNumber", "text", "provider"],
};
