export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["citation", "statute", "holding", "reasoning", "keyFact", "party", "date"],
            description: "Annotation type",
          },
          text: { type: "string", description: "Annotated text snippet" },
          pageReference: { type: "integer", description: "Source page number" },
          boundingBox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          normalized: { type: "string", description: "Normalized / canonical form" },
        },
        required: ["type", "text"],
      },
    },
    provider: { type: "string", description: "Annotation provider" },
    model: { type: "string", description: "Model used for annotation" },
  },
  required: ["annotations"],
};
