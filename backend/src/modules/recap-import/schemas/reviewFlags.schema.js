export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    reviewRequired: { type: "boolean", description: "Whether human review is needed" },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", description: "Flag category" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          message: { type: "string", description: "Human-readable flag description" },
          field: { type: "string", description: "Affected field name" },
          detail: { type: "string", description: "Additional context" },
        },
        required: ["category", "severity", "message"],
      },
    },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["reviewRequired", "flags"],
};
