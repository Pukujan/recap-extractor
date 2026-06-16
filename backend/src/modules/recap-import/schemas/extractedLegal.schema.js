export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    document: {
      type: "object",
      properties: {
        title: { type: "string" },
        docketNumber: { type: "string" },
        court: { type: "string" },
        dateFiled: { type: "string" },
        parties: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
            },
          },
        },
        attorneys: { type: "array", items: { type: "object" } },
        judges: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        causesOfAction: { type: "array", items: { type: "string" } },
        statutes: { type: "array", items: { type: "string" } },
        citations: { type: "array", items: { type: "string" } },
        reliefSought: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
      },
    },
    confidence: {
      type: "object",
      properties: {
        overall: { type: "number", minimum: 0, maximum: 1 },
        fields: { type: "object", additionalProperties: { type: "number" } },
      },
    },
    provider: { type: "string" },
    model: { type: "string" },
    tokensUsed: { type: "integer" },
    processingTimeMs: { type: "integer" },
  },
  required: ["document", "confidence"],
};
