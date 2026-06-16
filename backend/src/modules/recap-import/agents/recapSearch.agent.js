export class RecapSearchAgent {
  constructor({ courtListenerClient, config }) {
    this.client = courtListenerClient;
    this.config = config;
  }

  async run(input) {
    const { searchTerms, court, targetCount = 100, page: startPage = 1, pageSize = 100 } = input;

    if (!this.config?.courtListener?.token) {
      throw new Error('COURTLISTENER_API_TOKEN is required');
    }

    const seen = new Set();
    const candidates = [];
    let currentPage = startPage;

    while (candidates.length < targetCount) {
      const result = await this.client.searchRecap({
        searchTerms,
        court,
        page: currentPage,
        pageSize,
      });

      for (const doc of result.results) {
        const key = `${doc.recapDocumentId}|${doc.docketEntryId}|${doc.absoluteUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(doc);
          if (candidates.length >= targetCount) break;
        }
      }

      if (!result.next) break;
      currentPage++;
    }

    return { candidates: candidates.slice(0, targetCount) };
  }
}
