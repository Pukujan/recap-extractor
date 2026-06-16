import { chooseDocumentBodySource } from './documentBodySource.service.js';
import { extractEmbeddedPdfText } from './pdfTextExtraction.service.js';

export class DocumentBodyProcessingService {
  constructor({ fileStore } = {}) {
    this.fileStore = fileStore;
  }

  async run({
    courtListenerPlainText,
    pdfPath,
    metadataText,
    pdfPageImages = [],
    documentVisionParser,
    folders,
    extractEmbedded = extractEmbeddedPdfText,
    chooseSource = chooseDocumentBodySource,
  } = {}) {
    let pdfEmbeddedText = '';
    let qwenVisionText = '';
    let pageImageCount = 0;

    if (!courtListenerPlainText && pdfPath) {
      const result = await extractEmbedded({ pdfPath });
      pdfEmbeddedText = result.text || '';
      if (result.shouldUseVisionFallback && pdfPageImages.length > 0 && documentVisionParser) {
        const visionResult = await documentVisionParser.run({ pageImages: pdfPageImages });
        qwenVisionText = visionResult.text || '';
        pageImageCount = pdfPageImages.length;
      }
    }

    const bodySource = chooseSource({
      courtListenerPlainText,
      pdfEmbeddedText,
      qwenVisionText,
      metadataText,
    });

    const result = {
      ...bodySource,
      pageImageCount,
    };

    if (folders && this.fileStore) {
      await writeExtractionSourceFile({
        parsedDir: `${folders.documentFolderPath}parsed`,
        bodySource: result,
        fileStore: this.fileStore,
      });
    }

    return result;
  }
}

export async function writeExtractionSourceFile({
  parsedDir,
  bodySource,
  fileStore,
} = {}) {
  const data = {
    extractionSource: bodySource.extractionSource,
    bodyTextAvailable: bodySource.bodyTextAvailable,
    bodyTextLength: bodySource.bodyTextLength,
    pageImageCount: bodySource.pageImageCount || 0,
    metadataOnly: bodySource.metadataOnly,
    confidenceCapApplied: bodySource.metadataOnly,
  };
  await fileStore.writeJson(`${parsedDir}/extraction_source.json`, data);
}
