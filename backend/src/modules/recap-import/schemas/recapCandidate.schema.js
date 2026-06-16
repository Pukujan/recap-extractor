export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA = {
  type: "object",
  properties: {
    recapDocumentId: { type: "string", description: "RECAP document primary key" },
    description: { type: "string", description: "Short document description" },
    docketId: { type: "string", description: "PACER docket ID" },
    court: { type: "string", description: "Court ID string" },
    caseName: { type: "string", description: "Full case name" },
    dateFiled: { type: "string", format: "date", description: "Filing date" },
    documentNumber: { type: "string", description: "Docket entry number" },
    pacerDocId: { type: "string", description: "PACER document ID" },
    pageCount: { type: "integer", description: "Number of pages" },
    recapSequenceNumber: { type: "integer", description: "Order from RECAP search results" },
  },
  required: ["recapDocumentId", "description"],
};
