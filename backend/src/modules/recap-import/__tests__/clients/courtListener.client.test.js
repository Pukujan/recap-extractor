import { describe, expect, it, vi } from "vitest";
import { CourtListenerClient } from "../../clients/courtListener.client.js";

describe("CourtListenerClient", () => {
  it("uses CourtListener token auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
    });

    await client.searchRecap({
      searchTerms: "motion to compel",
      court: "nysd",
      page: 1,
      pageSize: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/search/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Token abc123",
        }),
      })
    );
  });

  it("builds search URL with query, court, page, and RECAP/PACER result type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
    });

    await client.searchRecap({
      searchTerms: "expert report",
      court: "nysd",
      page: 2,
      pageSize: 20,
    });

    const url = fetchMock.mock.calls[0][0];

    expect(url).toContain("/search/");
    expect(decodeURIComponent(url)).toContain("expert report");
    expect(url).toContain("nysd");
    expect(url).toMatch(/page=2|offset=/);
  });

  it("throws clear error on non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "bad-token",
      fetchImpl: fetchMock,
    });

    await expect(
      client.searchRecap({
        searchTerms: "motion",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toThrow(/CourtListener.*401/i);
  });

  it("uses type=rd for document-level search, not type=r", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
    });

    await client.searchRecap({
      searchTerms: "motion",
      page: 1,
      pageSize: 20,
    });

    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain("type=rd");
    expect(url).not.toMatch(/[?&]type=r(?!d)/);
    expect(url).not.toContain("type=o");
  });

  it("retries on 429 rate limit after waiting", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => '{"detail":"Rate limit exceeded"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
      retryDelayMs: 100,
      wait,
    });

    const result = await client.searchRecap({
      searchTerms: "motion",
      page: 1,
      pageSize: 20,
    });

    expect(wait).toHaveBeenCalledWith(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ results: [] });
  });

  it("gives up after max retries on 429", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"detail":"Rate limit exceeded"}',
    });

    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: fetchMock,
      maxRetries: 2,
      retryDelayMs: 50,
      wait,
    });

    await expect(
      client.searchRecap({
        searchTerms: "motion",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toThrow(/429/i);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not expose PACER purchase or RECAP Fetch methods in MVP client", () => {
    const client = new CourtListenerClient({
      baseUrl: "https://www.courtlistener.com/api/rest/v4",
      token: "abc123",
      fetchImpl: vi.fn(),
    });

    expect(client.buyPacerDocument).toBeUndefined();
    expect(client.recapFetch).toBeUndefined();
    expect(client.prayAndPay).toBeUndefined();
  });
});
