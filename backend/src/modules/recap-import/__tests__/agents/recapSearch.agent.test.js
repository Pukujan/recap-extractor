import { describe, expect, it, vi } from "vitest";
import { RecapSearchAgent } from "../../agents/recapSearch.agent.js";

describe("RecapSearchAgent", () => {
  it("requires CourtListener token", async () => {
    const agent = new RecapSearchAgent({
      courtListenerClient: { searchRecap: vi.fn() },
      config: {
        courtListener: { token: "" },
      },
    });

    await expect(
      agent.run({
        searchTerms: "motion to compel",
        targetCount: 10,
      })
    ).rejects.toThrow(/COURTLISTENER_API_TOKEN/i);
  });

  it("calls CourtListener client and returns candidates up to targetCount", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "2", docketEntryId: "b", absoluteUrl: "url-2", caseName: "C v D" },
          { recapDocumentId: "3", docketEntryId: "c", absoluteUrl: "url-3", caseName: "E v F" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
      },
    });

    const result = await agent.run({
      searchTerms: "motion to compel",
      court: "nysd",
      targetCount: 2,
    });

    expect(courtListenerClient.searchRecap).toHaveBeenCalled();
    expect(result.candidates).toHaveLength(2);
  });

  it("dedupes duplicate documents", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "1", docketEntryId: "a", absoluteUrl: "url-1", caseName: "A v B" },
          { recapDocumentId: "2", docketEntryId: "b", absoluteUrl: "url-2", caseName: "C v D" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
      },
    });

    const result = await agent.run({
      searchTerms: "motion",
      targetCount: 10,
    });

    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map(c => c.recapDocumentId)).size).toBe(2);
  });

  it("does not trigger PACER purchase or RECAP Fetch", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({ results: [], next: null }),
      buyPacerDocument: vi.fn(),
      recapFetch: vi.fn(),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: {
        courtListener: { token: "test" },
        safety: {
          allowPacerPurchase: false,
          allowRecapFetch: false,
        },
      },
    });

    await agent.run({
      searchTerms: "expert report",
      targetCount: 10,
    });

    expect(courtListenerClient.buyPacerDocument).not.toHaveBeenCalled();
    expect(courtListenerClient.recapFetch).not.toHaveBeenCalled();
  });
});
