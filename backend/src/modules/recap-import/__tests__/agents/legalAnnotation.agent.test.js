import { describe, expect, it, vi } from "vitest";
import { LegalAnnotationAgent } from "../../agents/legalAnnotation.agent.js";
import { createMockJsonWriter, mockFolders } from "../testHelpers.js";

describe("LegalAnnotationAgent", () => {
  it("annotates motion to compel with confidence and source span", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith moves to compel discovery responses from Defendant Hospital Corp.",
        pages: [
          {
            page: 1,
            text: "Plaintiff Jane Smith moves to compel discovery responses from Defendant Hospital Corp.",
          },
        ],
      },
      metadata: {
        caseName: "Smith v. Hospital Corp",
      },
      review: {
        reviewRequired: false,
        flags: [],
      },
      folders: mockFolders(),
    });

    expect(result.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "motion_type",
          value: "motion_to_compel",
          confidence: expect.any(Number),
          source: expect.objectContaining({
            page: 1,
          }),
        }),
      ])
    );
  });

  it("annotates parties from parsed text", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "Plaintiff Jane Smith brings this action against Defendant Hospital Corp.",
        pages: [{ page: 1, text: "Plaintiff Jane Smith brings this action against Defendant Hospital Corp." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(result.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "party", value: expect.stringMatching(/Jane Smith|Hospital Corp/) }),
      ])
    );
  });

  it("does not invent absent parties", async () => {
    const agent = new LegalAnnotationAgent({
      writer: createMockJsonWriter(),
    });

    const result = await agent.run({
      parsed: {
        text: "This document discusses discovery.",
        pages: [{ page: 1, text: "This document discusses discovery." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("John Doe");
    expect(serialized).not.toContain("Jane Doe");
  });

  it("writes legal_annotations.json", async () => {
    const writer = createMockJsonWriter();
    const agent = new LegalAnnotationAgent({ writer });

    await agent.run({
      parsed: {
        text: "Plaintiff moves to compel.",
        pages: [{ page: 1, text: "Plaintiff moves to compel." }],
      },
      metadata: {},
      review: { reviewRequired: false, flags: [] },
      folders: mockFolders(),
    });

    expect(writer.writeJson).toHaveBeenCalledWith(
      expect.stringContaining("legal_annotations.json"),
      expect.any(Object)
    );
  });
});
