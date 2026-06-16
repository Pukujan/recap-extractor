import { slugifyForPath } from '../services/slug.service.js';

export class CaseFolderAgent {
  constructor({ outputRoot, fileStore }) {
    this.outputRoot = outputRoot;
    this.fileStore = fileStore;
  }

  async run({ metadata, task }) {
    const caseSlug = slugifyForPath(metadata.caseName);
    const safeCourtId = (metadata.courtId || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const caseFolderName = `${caseSlug}__${safeCourtId}__docket-${metadata.docketId}`;

    let caseFolderPath = `${this.outputRoot}/${caseFolderName}/`;
    let counter = 1;
    while (await this.fileStore.exists(caseFolderPath)) {
      caseFolderPath = `${this.outputRoot}/${caseFolderName}__${++counter}/`;
    }

    const desc = slugifyForPath(metadata.description || 'document');
    const seq = String(task.sequenceNumber).padStart(3, '0');
    const documentFolderPath = `${caseFolderPath}documents/doc-${seq}-${desc}/`;

    await this.fileStore.ensureDir(caseFolderPath);
    await this.fileStore.ensureDir(documentFolderPath);

    return { caseFolderPath, documentFolderPath };
  }
}
