export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    source: { type: "string", enum: ["courtlistener", "recap", "pacer"], description: "Data source" },
    recapDocumentId: { type: "string" },
    docketId: { type: "string" },
    court: { type: "string" },
    caseName: { type: "string" },
    dateFiled: { type: "string" },
    documentNumber: { type: "string" },
    pacerDocId: { type: "string" },
    pageCount: { type: "integer" },
    ocrStatus: { type: "string", enum: ["none", "in_progress", "complete", "failed"] },
    fileSizeBytes: { type: "integer" },
    sha256: { type: "string" },
    downloadUrl: { type: "string" },
  },
  required: ["source", "recapDocumentId"],
};
