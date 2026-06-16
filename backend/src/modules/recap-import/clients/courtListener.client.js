export class CourtListenerClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch, maxRetries = 2, retryDelayMs = 65000, wait = null } = {}) {
    this.wait = wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.baseUrl = baseUrl;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  async searchRecap({ searchTerms, court, page, pageSize } = {}) {
    let query = `type=rd&q=${encodeURIComponent(searchTerms)}`;
    if (court) query += `&court=${encodeURIComponent(court)}`;
    if (page != null) query += `&page=${page}`;
    if (pageSize != null) query += `&page_size=${pageSize}`;

    const url = `${this.baseUrl}/search/?${query}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Token ${this.token}`,
        },
      });

      if (response.ok) {
        return response.json();
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        console.warn(`[pipeline] CourtListener rate limited (429). Retrying in ${this.retryDelayMs}ms (attempt ${attempt}/${this.maxRetries})...`);
        await this.wait(this.retryDelayMs);
        continue;
      }

      const text = await response.text();
      throw new Error(`CourtListener API returned ${response.status}: ${text}`);
    }
  }
}
