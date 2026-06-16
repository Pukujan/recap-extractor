export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "Unique task identifier" },
    jobId: { type: "string", description: "Parent job identifier" },
    sequenceNumber: { type: "integer", description: "Order within job" },
    recapDocumentId: { type: "string", description: "RECAP document identifier" },
    description: { type: "string", description: "Human-readable document description" },
    status: { type: "string", enum: ["pending", "running", "complete", "review_needed", "failed"] },
    folderPath: { type: "string", description: "Output folder path" },
    errorMessage: { type: "string", description: "Error details if failed" },
    ocrMode: { type: "string" },
  },
  required: ["jobId", "recapDocumentId", "status"],
};
