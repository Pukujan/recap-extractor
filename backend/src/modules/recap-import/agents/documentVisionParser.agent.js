const QWEN_VL_PROMPT = `You are a precise OCR and legal document analysis system. Return ONLY a valid JSON object with no markdown wrapping, no code fences, and no additional text.

Analyze the provided page image and return this exact JSON structure:
{
  "page": <number>,
  "transcribedText": "<full verbatim text from the page>",
  "layoutSummary": {
    "hasHeader": <boolean>,
    "hasFooter": <boolean>,
    "hasTable": <boolean>,
    "hasSignatureBlock": <boolean>,
    "hasHandwriting": <boolean>,
    "hasSealOrStamp": <boolean>,
    "hasExhibitLabel": <boolean>
  },
  "legalHints": {
    "possibleDocumentType": "<string or null>",
    "possibleMotionType": "<string or null>",
    "partyNames": ["<string>"],
    "attorneyNames": ["<string>"],
    "courtNames": ["<string>"],
    "dates": ["<string>"],
    "legalTerms": ["<string>"]
  },
  "reviewFlags": [
    {
      "flagType": "<signature_possible|handwriting_possible|seal_or_stamp|unusual_layout|low_confidence_text>",
      "severity": "<low|medium|high>",
      "page": <number>,
      "reason": "<string>",
      "confidence": <number>,
      "bboxAvailable": false,
      "bbox": null
    }
  ],
  "confidence": {
    "text": <number 0-1>,
    "layout": <number 0-1>,
    "legalHints": <number 0-1>
  }
}`;

export class DocumentVisionParserAgent {
  constructor({ openRouterVisionClient, fileStore, pdfToImageService, config }) {
    this.openRouterVisionClient = openRouterVisionClient;
    this.fileStore = fileStore;
    this.pdfToImageService = pdfToImageService;
    this.config = config;
  }

  async run(input) {
    const { triage, fetched, folders } = input;
    const { openRouterApiKey, provider, qwenVlModel } = this.config;

    if (!openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for DocumentVisionParserAgent");
    }
    if (!qwenVlModel) {
      throw new Error("QWEN_VL_MODEL is required for DocumentVisionParserAgent");
    }
    if (provider !== "qwen_vl") {
      throw new Error(`Only qwen_vl provider is supported, got: ${provider}`);
    }

    const documentFolder = folders.documentFolderPath;

    if (!triage.requiresOcr) {
      return this._processPlainText(fetched, documentFolder);
    }

    return this._processWithOcr(fetched, documentFolder);
  }

  async _processPlainText(fetched, documentFolder) {
    const plainText = fetched.plainText || "";
    const pages = [{ page: 1, text: plainText }];

    const parsedTextPath = `${documentFolder}parsed/parsed.md`;
    const parsedPagesPath = `${documentFolder}parsed/parsed_pages.json`;
    const layoutSummaryPath = `${documentFolder}parsed/layout_summary.json`;
    const ocrQualityReportPath = `${documentFolder}parsed/ocr_quality_report.json`;
    const reviewFlagsPath = `${documentFolder}review/review_flags.json`;

    const layoutSummary = [{
      page: 1,
      hasHeader: false,
      hasFooter: false,
      hasTable: false,
      hasSignatureBlock: false,
      hasHandwriting: false,
      hasSealOrStamp: false,
      hasExhibitLabel: false,
    }];

    const ocrQualityReport = {
      source: "plain_text",
      pagesProcessed: 1,
      totalPages: 1,
      averageTextConfidence: 1.0,
      averageLayoutConfidence: null,
      averageLegalHintConfidence: null,
      pagesWithLowConfidence: [],
      reviewFlagsGenerated: 0,
    };

    const reviewFlags = [];

    await this.fileStore.writeText(parsedTextPath, plainText);
    await this.fileStore.writeJson(parsedPagesPath, pages);
    await this.fileStore.writeJson(layoutSummaryPath, layoutSummary);
    await this.fileStore.writeJson(ocrQualityReportPath, ocrQualityReport);
    await this.fileStore.writeJson(reviewFlagsPath, reviewFlags);

    return {
      usedOcr: false,
      provider: "qwen_vl",
      model: this.config.qwenVlModel,
      bboxAvailable: false,
      coordinateReviewPrecision: "page_level_only",
      parsedTextPath,
      parsedPagesPath,
      layoutSummaryPath,
      ocrQualityReportPath,
      reviewFlagsPath,
      reviewFlags,
      pages,
      layoutSummary,
    };
  }

  async _processWithOcr(fetched, documentFolder) {
    const pdfPath = fetched.pdfPath;
    const pageImages = await this.pdfToImageService.convertPdfToPageImages(pdfPath);

    const parsedTextPath = `${documentFolder}parsed/parsed.md`;
    const parsedPagesPath = `${documentFolder}parsed/parsed_pages.json`;
    const layoutSummaryPath = `${documentFolder}parsed/layout_summary.json`;
    const ocrQualityReportPath = `${documentFolder}parsed/ocr_quality_report.json`;
    const reviewFlagsPath = `${documentFolder}review/review_flags.json`;

    const pages = [];
    const layoutSummary = [];
    const reviewFlags = [];
    const pageTexts = [];
    let totalTextConf = 0;
    let totalLayoutConf = 0;
    let totalLegalConf = 0;
    const lowConfPages = [];

    for (let i = 0; i < pageImages.length; i++) {
      const pageNum = i + 1;
      const imageBase64 = await this.pdfToImageService.imageToBase64(pageImages[i]);

      const result = await this.openRouterVisionClient.parsePageImage({
        imageBase64,
        prompt: QWEN_VL_PROMPT,
      });

      pages.push({
        page: result.page,
        text: result.transcribedText,
      });

      layoutSummary.push({
        page: result.page,
        ...result.layoutSummary,
      });

      if (result.reviewFlags && result.reviewFlags.length > 0) {
        reviewFlags.push(...result.reviewFlags);
      }

      pageTexts.push(result.transcribedText);
      totalTextConf += result.confidence.text;
      totalLayoutConf += result.confidence.layout;
      totalLegalConf += result.confidence.legalHints;

      if (result.confidence.text < 0.5) {
        lowConfPages.push(pageNum);
      }
    }

    const combinedText = pageTexts.join("\n\n--- PAGE BREAK ---\n\n");

    const ocrQualityReport = {
      source: "qwen_vl_ocr",
      pagesProcessed: pageImages.length,
      totalPages: pageImages.length,
      averageTextConfidence: pageImages.length > 0 ? totalTextConf / pageImages.length : 0,
      averageLayoutConfidence: pageImages.length > 0 ? totalLayoutConf / pageImages.length : 0,
      averageLegalHintConfidence: pageImages.length > 0 ? totalLegalConf / pageImages.length : 0,
      pagesWithLowConfidence: lowConfPages,
      reviewFlagsGenerated: reviewFlags.length,
    };

    await this.fileStore.writeText(parsedTextPath, combinedText);
    await this.fileStore.writeJson(parsedPagesPath, pages);
    await this.fileStore.writeJson(layoutSummaryPath, layoutSummary);
    await this.fileStore.writeJson(ocrQualityReportPath, ocrQualityReport);
    await this.fileStore.writeJson(reviewFlagsPath, reviewFlags);

    return {
      usedOcr: true,
      provider: "qwen_vl",
      model: this.config.qwenVlModel,
      bboxAvailable: false,
      coordinateReviewPrecision: "page_level_only",
      parsedTextPath,
      parsedPagesPath,
      layoutSummaryPath,
      ocrQualityReportPath,
      reviewFlagsPath,
      reviewFlags,
      pages,
      layoutSummary,
    };
  }
}
