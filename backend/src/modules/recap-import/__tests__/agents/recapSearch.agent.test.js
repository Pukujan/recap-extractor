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
          { id: 1, docket_entry: { id: 10, docket: { case_name: "A v B" } }, is_available: true, filepath_local: "recap/a.pdf", plain_text: null, description: "Doc 1" },
          { id: 2, docket_entry: { id: 20, docket: { case_name: "C v D" } }, is_available: true, filepath_local: "recap/b.pdf", plain_text: null, description: "Doc 2" },
          { id: 3, docket_entry: { id: 30, docket: { case_name: "E v F" } }, is_available: true, filepath_local: "recap/c.pdf", plain_text: null, description: "Doc 3" },
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
          { id: 1, docket_entry: { id: 10, docket: { case_name: "A v B" } }, is_available: true, filepath_local: "recap/a.pdf", plain_text: null, absolute_url: "url-1", description: "Doc 1" },
          { id: 1, docket_entry: { id: 10, docket: { case_name: "A v B" } }, is_available: true, filepath_local: "recap/a.pdf", plain_text: null, absolute_url: "url-1", description: "Doc 1" },
          { id: 2, docket_entry: { id: 20, docket: { case_name: "C v D" } }, is_available: true, filepath_local: "recap/b.pdf", plain_text: null, absolute_url: "url-2", description: "Doc 2" },
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

  it("filters out documents where is_available is false", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { id: 1, docket_entry: { id: 10, docket: { case_name: "A v B" } }, is_available: false, filepath_local: null, plain_text: null, description: "Unavailable doc" },
          { id: 2, docket_entry: { id: 20, docket: { case_name: "C v D" } }, is_available: true, filepath_local: "recap/path.pdf", plain_text: null, description: "Available doc" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: { courtListener: { token: "test" } },
    });

    const result = await agent.run({
      searchTerms: "motion",
      targetCount: 10,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].recapDocumentId).toBe("2");
  });

  it("filters out available docs with no filepath_local and no plain_text", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          { id: 1, docket_entry: { id: 10, docket: { case_name: "A v B" } }, is_available: true, filepath_local: null, plain_text: null, description: "No content" },
          { id: 2, docket_entry: { id: 20, docket: { case_name: "C v D" } }, is_available: true, filepath_local: "recap/path.pdf", plain_text: null, description: "Has PDF" },
          { id: 3, docket_entry: { id: 30, docket: { case_name: "E v F" } }, is_available: true, filepath_local: null, plain_text: "Some text", description: "Has plain text" },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: { courtListener: { token: "test" } },
    });

    const result = await agent.run({
      searchTerms: "motion",
      targetCount: 10,
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map(c => c.recapDocumentId)).toEqual(["2", "3"]);
  });

  it("normalizes type=rd field names to camelCase downstream format", async () => {
    const courtListenerClient = {
      searchRecap: vi.fn().mockResolvedValue({
        results: [
          {
            id: 456140733,
            docket_entry: {
              id: 87654321,
              date_filed: "2022-11-17",
              docket: {
                id: 65359987,
                docket_number: "3:21-cv-00261",
                case_name: "Keathley v. Buddy Ayers Construction, Inc.",
                case_name_full: "Keathley v. Buddy Ayers Construction, Inc.",
                court: "msnd",
                court_id: "msnd",
              },
            },
            description: "NOTICE OF SERVICE",
            document_number: "53",
            attachment_number: null,
            is_available: true,
            filepath_local: "recap/gov.uscourts.msnd.65359987/gov.uscourts.msnd.65359987.53.0.pdf",
            plain_text: "Party text content",
            ocr_status: null,
            date_filed: "2022-11-17",
            absolute_url: "/recap/gov.uscourts.msnd.65359987/53/",
          },
        ],
        next: null,
      }),
    };

    const agent = new RecapSearchAgent({
      courtListenerClient,
      config: { courtListener: { token: "test" } },
    });

    const result = await agent.run({
      searchTerms: "motion to compel",
      targetCount: 10,
    });

    const c = result.candidates[0];
    expect(c.recapDocumentId).toBe("456140733");
    expect(c.docketEntryId).toBe("87654321");
    expect(c.absoluteUrl).toBe("/recap/gov.uscourts.msnd.65359987/53/");
    expect(c.caseName).toBe("Keathley v. Buddy Ayers Construction, Inc.");
    expect(c.caseNameFull).toBe("Keathley v. Buddy Ayers Construction, Inc.");
    expect(c.courtId).toBe("msnd");
    expect(c.docketId).toBe("65359987");
    expect(c.docketNumber).toBe("3:21-cv-00261");
    expect(c.documentNumber).toBe("53");
    expect(c.attachmentNumber).toBeNull();
    expect(c.description).toBe("NOTICE OF SERVICE");
    expect(c.dateFiled).toBe("2022-11-17");
    expect(c.pdfAvailable).toBe(true);
    expect(c.plainTextAvailable).toBe(true);
    expect(c.plainText).toBe("Party text content");
    expect(c.filepathLocal).toBe("recap/gov.uscourts.msnd.65359987/gov.uscourts.msnd.65359987.53.0.pdf");
    expect(c.ocrStatus).toBeNull();
    expect(c.source).toBe("courtlistener");
    expect(c.raw).toEqual(expect.objectContaining({ id: 456140733 }));
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
