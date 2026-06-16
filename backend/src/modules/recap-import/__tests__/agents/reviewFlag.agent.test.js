import { describe, expect, it } from "vitest";
import { ReviewFlagAgent } from "../../agents/reviewFlag.agent.js";

describe("ReviewFlagAgent", () => {
  it("passes through Qwen-VL page-level signature flags", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        reviewFlags: [
          {
            flagType: "signature_possible",
            severity: "medium",
            page: 2,
            reason: "Likely signature block detected.",
            confidence: 0.81,
            bboxAvailable: false,
            bbox: null,
          },
        ],
        pages: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags[0].flagType).toBe("signature_possible");
    expect(result.flags[0].bboxAvailable).toBe(false);
  });

  it("flags possible signature block from text pattern", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        pages: [
          {
            page: 3,
            text: "Respectfully submitted,\n/s/ John Smith\nAttorney for Defendant",
          },
        ],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "signature_possible")).toBe(true);
  });

  it("flags possible handwriting from layout summary", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        layoutSummary: [
          {
            page: 4,
            hasHandwriting: true,
          },
        ],
        pages: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "handwriting_possible")).toBe(true);
  });

  it("flags missing page text", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        pages: [
          { page: 1, text: "" },
          { page: 2, text: "Some text" },
        ],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.flags.some(f => f.flagType === "missing_page_text")).toBe(true);
  });

  it("sets reviewRequired=false when there are no flags", async () => {
    const agent = new ReviewFlagAgent();

    const result = await agent.run({
      parsed: {
        provider: "qwen_vl",
        bboxAvailable: false,
        pages: [{ page: 1, text: "Clean page text." }],
        layoutSummary: [{ page: 1, hasSignatureBlock: false, hasHandwriting: false }],
        reviewFlags: [],
      },
      metadata: {},
    });

    expect(result.reviewRequired).toBe(false);
    expect(result.flags).toEqual([]);
  });
});
