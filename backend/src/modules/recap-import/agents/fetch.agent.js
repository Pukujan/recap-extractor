export class FetchAgent {
  constructor({ fileStore, hashService, fetchImpl }) {
    this.fileStore = fileStore;
    this.hashService = hashService;
    this.fetchImpl = fetchImpl;
  }

  async run({ metadata, folders }) {
    const docPath = folders.documentFolderPath;

    let plainTextPath = null;
    let pdfPath = null;
    let plainTextExists = false;
    let pdfExists = false;
    const hashes = {};

    if (metadata.plainText) {
      plainTextPath = `${docPath}source/courtlistener_plain_text.txt`;
      await this.fileStore.writeText(plainTextPath, metadata.plainText);
      plainTextExists = true;
    }

    if (metadata.pdfAvailable && metadata.pdfUrl) {
      pdfPath = `${docPath}source/source.pdf`;
      const response = await this.fetchImpl(metadata.pdfUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        await this.fileStore.writeBuffer(pdfPath, buffer);
        pdfExists = true;
        if (typeof this.hashService.sha256File === 'function') {
          hashes.pdfSha256 = await this.hashService.sha256File(pdfPath);
        }
      }
    }

    const sourceUnavailable = !plainTextExists && !pdfExists;

    return {
      plainTextPath,
      pdfPath,
      pdfExists,
      plainTextExists,
      sourceUnavailable,
      hashes,
    };
  }
}
