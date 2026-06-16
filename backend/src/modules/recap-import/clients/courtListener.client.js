export class CourtListenerClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async searchRecap({ searchTerms, court, page, pageSize } = {}) {
    let query = `type=r&q=${encodeURIComponent(searchTerms)}`;
    if (court) query += `&court=${encodeURIComponent(court)}`;
    if (page != null) query += `&page=${page}`;
    if (pageSize != null) query += `&page_size=${pageSize}`;

    const url = `${this.baseUrl}/search/?${query}`;

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Token ${this.token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CourtListener API returned ${response.status}: ${text}`);
    }

    return response.json();
  }
}
