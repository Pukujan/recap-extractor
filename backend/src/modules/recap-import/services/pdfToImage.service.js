import fs from "fs/promises";

export class PdfToImageService {
  constructor() {}

  async convertPdfToPageImages(pdfPath, outputDir) {
    console.warn(
      "PdfToImageService: convertPdfToPageImages is a stub — requires sharp/poppler for MVP"
    );
    return [];
  }

  async imageToBase64(imagePath) {
    console.warn(
      "PdfToImageService: imageToBase64 is a stub — requires sharp/poppler for MVP"
    );
    return "";
  }
}
