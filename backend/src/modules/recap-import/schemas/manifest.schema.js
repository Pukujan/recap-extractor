export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["complete", "failed"], description: "Processing status" },
    versions: {
      type: "object",
      properties: {
        schemaVersion: { type: "string" },
        visionModel: { type: "string" },
        legalExtractionModel: { type: "string" },
        annotationModel: { type: "string" },
        pipelineVersion: { type: "string" },
      },
    },
    source: {
      type: "object",
      properties: {
        provider: { type: "string" },
        recapDocumentId: { type: "string" },
        docketId: { type: "string" },
        court: { type: "string" },
        caseName: { type: "string" },
        documentNumber: { type: "string" },
        downloadUrl: { type: "string" },
      },
    },
    pipeline: {
      type: "object",
      properties: {
        metadataCompleted: { type: "string", format: "date-time" },
        fetchCompleted: { type: "string", format: "date-time" },
        textTriageCompleted: { type: "string", format: "date-time" },
        visionParsingCompleted: { type: "string", format: "date-time" },
        reviewFlaggingCompleted: { type: "string", format: "date-time" },
        annotationCompleted: { type: "string", format: "date-time" },
        extractionCompleted: { type: "string", format: "date-time" },
      },
    },
    output: {
      type: "object",
      properties: {
        caseFolderPath: { type: "string" },
        documentFolderPath: { type: "string" },
        plainTextPath: { type: "string" },
        parsedMdPath: { type: "string" },
        extractedJsonPath: { type: "string" },
        manifestPath: { type: "string" },
      },
    },
    review: {
      type: "object",
      properties: {
        reviewRequired: { type: "boolean" },
        flags: { type: "array", items: { type: "object" } },
      },
    },
    error: {
      type: "object",
      properties: {
        message: { type: "string" },
        stage: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
    metrics: {
      type: "object",
      properties: {
        totalProcessingTimeMs: { type: "integer" },
        visionTokensUsed: { type: "integer" },
        extractionTokensUsed: { type: "integer" },
        pageCount: { type: "integer" },
      },
    },
  },
  required: ["status", "versions", "source"],
};
