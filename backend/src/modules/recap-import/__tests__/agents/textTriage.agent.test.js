import { describe, expect, it } from "vitest";
import { TextTriageAgent } from "../../agents/textTriage.agent.js";

describe("TextTriageAgent", () => {
  it("uses RECAP plain text when usable", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "This is a long enough extracted filing text. ".repeat(300),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsLayoutParsing: false,
      needsCoordinateReview: false,
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.reason).toBe("plain_text_usable");
  });

  it("requires OCR when forceOcr is true", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: true,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("force_ocr");
  });

  it("requires OCR when plain text is missing", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: true,
      pageCount: 4,
      forceOcr: false,
      ocrStatus: null,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_missing");
  });

  it("requires OCR when text is too short for page count", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "short text",
      plainTextExists: true,
      pdfExists: true,
      pageCount: 20,
      forceOcr: false,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_too_short_for_page_count");
  });

  it("requires OCR when text is garbled", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "@@@@ #### |||| //// \uFFFD \uFFFD \uFFFD ".repeat(100),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("plain_text_garbled");
  });

  it("requires OCR when RECAP OCR status is failed/incomplete/partial/unavailable", async () => {
    const agent = new TextTriageAgent();

    for (const status of ["failed", "incomplete", "partial", "unavailable"]) {
      const result = await agent.run({
        plainText: "Some text ".repeat(500),
        plainTextExists: true,
        pdfExists: true,
        pageCount: 2,
        forceOcr: false,
        ocrStatus: status,
      });

      expect(result.requiresOcr).toBe(true);
      expect(result.reason).toBe("recap_ocr_status_not_usable");
    }
  });

  it("requires OCR when layout parsing is required", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsLayoutParsing: true,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("layout_parsing_required");
  });

  it("requires OCR when coordinate review is required", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "Usable text ".repeat(500),
      plainTextExists: true,
      pdfExists: true,
      pageCount: 2,
      forceOcr: false,
      ocrStatus: "complete",
      needsCoordinateReview: true,
    });

    expect(result.requiresOcr).toBe(true);
    expect(result.reason).toBe("coordinate_review_required");
  });

  it("marks source unavailable when no text and no PDF exist", async () => {
    const agent = new TextTriageAgent();

    const result = await agent.run({
      plainText: "",
      plainTextExists: false,
      pdfExists: false,
      pageCount: null,
      forceOcr: false,
      ocrStatus: null,
    });

    expect(result.requiresOcr).toBe(false);
    expect(result.sourceUnavailable).toBe(true);
    expect(result.reason).toBe("source_unavailable");
  });
});
