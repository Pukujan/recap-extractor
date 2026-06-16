const CL_STORAGE = 'https://storage.courtlistener.com';

export class RecapSearchAgent {
  constructor({ courtListenerClient, config }) {
    this.client = courtListenerClient;
    this.config = config;
  }

  _normalize(raw) {
    const de = raw.docket_entry || {};

    return {
      recapDocumentId: raw.id != null ? String(raw.id) : null,
      docketEntryId: raw.docket_entry_id != null ? String(raw.docket_entry_id) : (de.id != null ? String(de.id) : null),
      absoluteUrl: raw.absolute_url || null,
      caseName: raw.case_name || de.case_name || (de.docket && de.docket.case_name) || null,
      caseNameFull: raw.case_name_full || de.case_name_full || (de.docket && de.docket.case_name_full) || null,
      courtId: raw.court || de.court || (de.docket && (de.docket.court || de.docket.court_id)) || null,
      docketId: raw.docket_id != null ? String(raw.docket_id) : (de.docket_id != null ? String(de.docket_id) : (de.docket && de.docket.id != null ? String(de.docket.id) : null)),
      docketNumber: raw.docket_number || (de.docket && de.docket.docket_number) || null,
      documentNumber: raw.document_number != null ? String(raw.document_number) : null,
      attachmentNumber: raw.attachment_number != null ? String(raw.attachment_number) : null,
      description: raw.description || raw.short_description || null,
      dateFiled: raw.date_filed || raw.entry_date_filed || null,
      pdfAvailable: !!(raw.filepath_local),
      plainTextAvailable: !!raw.plain_text,
      plainText: raw.plain_text || null,
      filepathLocal: raw.filepath_local || null,
      ocrStatus: raw.ocr_status || null,
      source: 'courtlistener',
      raw,
    };
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
        if (doc.is_available !== true) continue;
        if (!doc.filepath_local && !doc.plain_text) continue;

        const normalized = this._normalize(doc);
        const key = `${normalized.recapDocumentId}|${normalized.docketEntryId}|${normalized.absoluteUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(normalized);
          if (candidates.length >= targetCount) break;
        }
      }

      if (!result.next) break;
      currentPage++;
    }

    return { candidates: candidates.slice(0, targetCount) };
  }
}
