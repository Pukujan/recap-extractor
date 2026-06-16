export class MetadataAgent {
  constructor({ writer }) {
    this.writer = writer;
  }

  async run(candidate) {
    const normalizeId = (val) => val != null ? String(val) : null;

    const pdfUrl = candidate.filepathLocal
      ? `https://storage.courtlistener.com/${candidate.filepathLocal}`
      : null;

    const metadata = {
      source: candidate.source ?? 'courtlistener',
      caseName: candidate.caseName ?? null,
      caseNameFull: candidate.caseNameFull ?? null,
      courtId: candidate.courtId ?? null,
      docketId: normalizeId(candidate.docketId),
      docketNumber: candidate.docketNumber ?? null,
      docketEntryId: normalizeId(candidate.docketEntryId),
      recapDocumentId: normalizeId(candidate.recapDocumentId),
      documentNumber: candidate.documentNumber ?? null,
      attachmentNumber: candidate.attachmentNumber ?? null,
      description: candidate.description ?? null,
      dateFiled: candidate.dateFiled ?? null,
      absoluteUrl: candidate.absoluteUrl ?? null,
      plainText: candidate.plainText ?? null,
      plainTextAvailable: candidate.plainTextAvailable ?? false,
      pdfUrl,
      pdfAvailable: candidate.pdfAvailable ?? false,
      ocrStatus: candidate.ocrStatus ?? null,
      raw: candidate.raw ?? {},
    };

    await this.writer.writeJson('source_metadata.json', metadata);

    return metadata;
  }
}
