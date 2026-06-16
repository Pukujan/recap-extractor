import { describe, expect, it } from "vitest";
import { MetadataAgent } from "../../agents/metadata.agent.js";
import { createMockJsonWriter } from "../testHelpers.js";

describe("MetadataAgent", () => {
  it("normalizes and preserves CourtListener source metadata", async () => {
    const writer = createMockJsonWriter();
    const agent = new MetadataAgent({ writer });

    const result = await agent.run({
      source: "courtlistener",
      caseName: "Smith v. Hospital Corp",
      caseNameFull: "Jane Smith v. Hospital Corporation",
      courtId: "nysd",
      docketId: 12345,
      docketNumber: "1:26-cv-12345",
      docketEntryId: 45678,
      recapDocumentId: 98765,
      documentNumber: "42",
      attachmentNumber: null,
      description: "Motion to Compel",
      dateFiled: "2026-06-01",
      absoluteUrl: "https://www.courtlistener.com/docket/12345/",
      plainTextAvailable: true,
      ocrStatus: "complete",
      pdfAvailable: true,
      raw: { original: true },
    });

    expect(result.docketId).toBe("12345");
    expect(result.docketEntryId).toBe("45678");
    expect(result.recapDocumentId).toBe("98765");
    expect(result.raw).toEqual({ original: true });
    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("source_metadata.json"),
      expect.objectContaining({
        caseName: "Smith v. Hospital Corp",
        recapDocumentId: "98765",
      })
    );
  });

  it("handles missing optional fields without dropping raw payload", async () => {
    const writer = createMockJsonWriter();
    const agent = new MetadataAgent({ writer });

    const result = await agent.run({
      source: "courtlistener",
      caseName: "Unknown Case",
      courtId: "nysd",
      docketId: "123",
      raw: { untouched: true },
    });

    expect(result.caseName).toBe("Unknown Case");
    expect(result.raw).toEqual({ untouched: true });
    expect(result.description).toBeNull();
  });
});
