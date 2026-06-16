# update-3.md — Fix Real Document Body Extraction Before Legal Extraction

## Goal

The current RECAP pipeline now correctly uses `type=rd` and finds real document-level RECAP results. However, a remaining limitation exists:

> PDF download works, but actual PDF body extraction is incomplete because `PdfToImageService` is still a stub. When CourtListener `plain_text` is missing, extraction may still run from metadata/docket description only.

This update fixes that.

The pipeline must extract from the best available document body source before running DeepSeek legal extraction.

---

## Current State

Already fixed:

* `type=r` was replaced with `type=rd`.
* RECAP search now targets document-level filing records.
* Search filters to documents with:

  * `is_available === true`
  * `filepath_local` or `plain_text`
* Flat `type=rd` fields are normalized.
* End-to-end run can download a real RECAP PDF.
* 112 tests pass across 23 test files.

Remaining problem:

* If CourtListener `plain_text` is missing and the PDF has no extracted body text yet, the pipeline may still pass metadata/description into legal extraction.
* That produces misleading high-confidence extraction from document metadata rather than the document body.
* `PdfToImageService` is a stub, so vision/OCR fallback is not real yet.

---

## Required Behavior

Before `legalExtraction.agent.js` runs, the pipeline must choose the best available body text source in this order:

```txt
1. CourtListener plain_text
2. Embedded PDF text extraction
3. Qwen-VL OCR/vision from rendered PDF page images
4. Metadata-only fallback
```

The selected source must be explicit and saved.

Every processed document must include:

```js
{
  extractionSource: "courtlistener_plain_text" | "pdf_embedded_text" | "qwen_vl_ocr" | "metadata_only",
  bodyTextAvailable: boolean,
  bodyTextLength: number,
  pageImageCount: number,
  metadataOnly: boolean
}
```

---

## Confidence Rule

If extraction is based on metadata only, confidence must be capped.

Required rule:

```js
if (extractionSource === "metadata_only") {
  overallConfidence = Math.min(overallConfidence, 0.45);
}
```

No extraction from docket entry description alone should claim `0.95` confidence.

High confidence is only allowed when actual document body text was used from:

```txt
courtlistener_plain_text
pdf_embedded_text
qwen_vl_ocr
```

---

## Non-Negotiables

Do not add:

```txt
Supabase
remote storage
frontend UI
PACER purchase
RECAP Fetch
new paid services
extra OCR providers
fallback APIs
```

OCR/vision provider must remain:

```txt
qwen/qwen3-vl-8b-instruct
```

DeepSeek extraction model remains:

```txt
deepseek/deepseek-v4-flash
```

Keep local repo storage only.

---

## Implementation Scope

Add or update these areas:

```txt
backend/src/modules/recap-import/services/pdfTextExtraction.service.js
backend/src/modules/recap-import/services/pdfToImage.service.js
backend/src/modules/recap-import/agents/textTriage.agent.js
backend/src/modules/recap-import/agents/documentVisionParser.agent.js
backend/src/modules/recap-import/agents/legalExtraction.agent.js
backend/src/modules/recap-import/agents/reviewFlag.agent.js
backend/src/modules/recap-import/agents/manifest.agent.js
backend/src/modules/recap-import/services/recapImport.service.js
backend/src/modules/recap-import/schemas/
backend/src/modules/recap-import/__tests__/
```

Do not rewrite the whole pipeline. Patch the current working flow.

---

## New Pipeline Contract

Current flow should become:

```txt
RECAP type=rd search
→ available doc gate
→ fetch PDF/plain_text
→ choose best body source
→ embedded PDF text extraction if needed
→ PDF-to-image render if embedded text is missing/low quality
→ Qwen-VL OCR if page images exist
→ legal annotation
→ DeepSeek legal extraction
→ confidence cap if metadata-only
→ review flags
→ manifest
```

---

## Source Selection Rules

Create a dedicated selector so this logic is not scattered.

Suggested file:

```txt
backend/src/modules/recap-import/services/documentBodySource.service.js
```

Expected function:

```js
export function chooseDocumentBodySource({
  courtListenerPlainText,
  pdfEmbeddedText,
  qwenVisionText,
  metadataText
}) {
  // returns normalized source object
}
```

Expected output:

```js
{
  extractionSource: "courtlistener_plain_text",
  text: "...",
  bodyTextAvailable: true,
  bodyTextLength: 12345,
  metadataOnly: false,
  pageImageCount: 0
}
```

---

## Minimum Text Quality

Use simple thresholds for MVP.

```js
const MIN_BODY_TEXT_CHARS = 500;
const MIN_OCR_TEXT_CHARS = 300;
```

A PDF embedded-text result below `500` chars should be treated as low quality and should trigger image rendering + Qwen-VL OCR.

If all body extraction fails, use metadata-only but flag it.

---

## Required Output Files

Each document folder should include:

```txt
parsed/
  parsed.md
  parsed_pages.json
  layout_summary.json
  extraction_source.json

review/
  review_flags.json

extracted/
  legal_annotations.json
  extracted_legal.json

manifest/
  document_manifest.json
```

`extraction_source.json` must include:

```json
{
  "extractionSource": "pdf_embedded_text",
  "bodyTextAvailable": true,
  "bodyTextLength": 4821,
  "pageImageCount": 0,
  "metadataOnly": false,
  "confidenceCapApplied": false
}
```

For metadata-only:

```json
{
  "extractionSource": "metadata_only",
  "bodyTextAvailable": false,
  "bodyTextLength": 0,
  "pageImageCount": 0,
  "metadataOnly": true,
  "confidenceCapApplied": true
}
```

---

# TDD Requirement

Write failing tests first.

Do not implement production code until these tests fail for the expected reason.

After implementation, all tests must pass.

Current baseline:

```txt
112 tests passing
23 test files
```

Expected after this patch:

```txt
new tests added
all old tests still pass
all new tests pass
```

---

# Red Tests

## 1. Uses CourtListener plain_text before PDF extraction

File:

```txt
backend/src/modules/recap-import/__tests__/documentBodySource.service.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { chooseDocumentBodySource } from "../services/documentBodySource.service.js";

describe("documentBodySource.service", () => {
  it("uses CourtListener plain_text as the highest priority body source", () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: "CourtListener body text ".repeat(100),
      pdfEmbeddedText: "PDF embedded text ".repeat(100),
      qwenVisionText: "OCR text ".repeat(100),
      metadataText: "metadata only"
    });

    expect(result.extractionSource).toBe("courtlistener_plain_text");
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.text).toContain("CourtListener body text");
  });
});
```

---

## 2. Uses embedded PDF text when CourtListener plain_text is missing

```js
import { describe, it, expect } from "vitest";
import { chooseDocumentBodySource } from "../services/documentBodySource.service.js";

describe("documentBodySource.service", () => {
  it("uses embedded PDF text when CourtListener plain_text is missing", () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: "",
      pdfEmbeddedText: "Embedded PDF body text ".repeat(100),
      qwenVisionText: "",
      metadataText: "metadata only"
    });

    expect(result.extractionSource).toBe("pdf_embedded_text");
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.bodyTextLength).toBeGreaterThan(500);
  });
});
```

---

## 3. Low-quality embedded PDF text triggers OCR source when Qwen text exists

```js
import { describe, it, expect } from "vitest";
import { chooseDocumentBodySource } from "../services/documentBodySource.service.js";

describe("documentBodySource.service", () => {
  it("uses Qwen-VL OCR when embedded PDF text is below quality threshold", () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: "",
      pdfEmbeddedText: "too short",
      qwenVisionText: "OCR extracted body text ".repeat(100),
      metadataText: "metadata only"
    });

    expect(result.extractionSource).toBe("qwen_vl_ocr");
    expect(result.bodyTextAvailable).toBe(true);
    expect(result.metadataOnly).toBe(false);
    expect(result.text).toContain("OCR extracted body text");
  });
});
```

---

## 4. Falls back to metadata_only only when no body text exists

```js
import { describe, it, expect } from "vitest";
import { chooseDocumentBodySource } from "../services/documentBodySource.service.js";

describe("documentBodySource.service", () => {
  it("uses metadata_only only when no real body source exists", () => {
    const result = chooseDocumentBodySource({
      courtListenerPlainText: "",
      pdfEmbeddedText: "",
      qwenVisionText: "",
      metadataText: "Motion to compel filed by defendant"
    });

    expect(result.extractionSource).toBe("metadata_only");
    expect(result.bodyTextAvailable).toBe(false);
    expect(result.metadataOnly).toBe(true);
    expect(result.text).toContain("Motion to compel");
  });
});
```

---

## 5. PDF embedded text extractor returns text and page count

File:

```txt
backend/src/modules/recap-import/__tests__/pdfTextExtraction.service.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { extractEmbeddedPdfText } from "../services/pdfTextExtraction.service.js";

describe("pdfTextExtraction.service", () => {
  it("extracts embedded text from a local PDF path", async () => {
    const fakePdfLoader = vi.fn().mockResolvedValue({
      pages: [
        { text: "Page one complaint text." },
        { text: "Page two factual allegations." }
      ],
      pageCount: 2
    });

    const result = await extractEmbeddedPdfText({
      pdfPath: "/tmp/source.pdf",
      pdfLoader: fakePdfLoader
    });

    expect(fakePdfLoader).toHaveBeenCalledWith("/tmp/source.pdf");
    expect(result.text).toContain("Page one complaint text");
    expect(result.text).toContain("Page two factual allegations");
    expect(result.pageCount).toBe(2);
    expect(result.charCount).toBeGreaterThan(20);
  });
});
```

---

## 6. PDF embedded text extraction reports low quality

```js
import { describe, it, expect, vi } from "vitest";
import { extractEmbeddedPdfText } from "../services/pdfTextExtraction.service.js";

describe("pdfTextExtraction.service", () => {
  it("marks embedded text as low quality when text is too short", async () => {
    const fakePdfLoader = vi.fn().mockResolvedValue({
      pages: [{ text: "short" }],
      pageCount: 1
    });

    const result = await extractEmbeddedPdfText({
      pdfPath: "/tmp/source.pdf",
      pdfLoader: fakePdfLoader
    });

    expect(result.textQuality).toBe("low");
    expect(result.shouldUseVisionFallback).toBe(true);
  });
});
```

---

## 7. PDF-to-image service is no longer a stub

File:

```txt
backend/src/modules/recap-import/__tests__/pdfToImage.service.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { renderPdfPagesToImages } from "../services/pdfToImage.service.js";

describe("pdfToImage.service", () => {
  it("renders selected PDF pages into image files for Qwen-VL", async () => {
    const fakeRenderer = vi.fn().mockResolvedValue([
      "/tmp/doc/page-001.png",
      "/tmp/doc/page-002.png"
    ]);

    const result = await renderPdfPagesToImages({
      pdfPath: "/tmp/source.pdf",
      outputDir: "/tmp/doc",
      maxPages: 2,
      renderer: fakeRenderer
    });

    expect(fakeRenderer).toHaveBeenCalledWith({
      pdfPath: "/tmp/source.pdf",
      outputDir: "/tmp/doc",
      maxPages: 2
    });

    expect(result.pageImages).toEqual([
      "/tmp/doc/page-001.png",
      "/tmp/doc/page-002.png"
    ]);
    expect(result.pageImageCount).toBe(2);
  });
});
```

---

## 8. PDF-to-image service handles render failure safely

```js
import { describe, it, expect, vi } from "vitest";
import { renderPdfPagesToImages } from "../services/pdfToImage.service.js";

describe("pdfToImage.service", () => {
  it("returns an empty page image list when rendering fails", async () => {
    const fakeRenderer = vi.fn().mockRejectedValue(new Error("render failed"));

    const result = await renderPdfPagesToImages({
      pdfPath: "/tmp/source.pdf",
      outputDir: "/tmp/doc",
      maxPages: 2,
      renderer: fakeRenderer
    });

    expect(result.pageImages).toEqual([]);
    expect(result.pageImageCount).toBe(0);
    expect(result.error).toContain("render failed");
  });
});
```

---

## 9. Qwen-VL is called when PDF embedded text is low quality

File:

```txt
backend/src/modules/recap-import/__tests__/recapImport.bodyExtraction.integration.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { processDocumentBody } from "../services/documentBodyProcessing.service.js";

describe("document body processing integration", () => {
  it("calls Qwen-VL when PDF embedded text is low quality and page images exist", async () => {
    const extractEmbeddedPdfText = vi.fn().mockResolvedValue({
      text: "short",
      charCount: 5,
      textQuality: "low",
      shouldUseVisionFallback: true
    });

    const renderPdfPagesToImages = vi.fn().mockResolvedValue({
      pageImages: ["/tmp/page-001.png"],
      pageImageCount: 1
    });

    const documentVisionParser = {
      run: vi.fn().mockResolvedValue({
        text: "OCR body text from Qwen ".repeat(100),
        pages: [{ page: 1, text: "OCR body text from Qwen" }]
      })
    };

    const result = await processDocumentBody({
      courtListenerPlainText: "",
      pdfPath: "/tmp/source.pdf",
      metadataText: "metadata description",
      extractEmbeddedPdfText,
      renderPdfPagesToImages,
      documentVisionParser
    });

    expect(documentVisionParser.run).toHaveBeenCalledWith(
      expect.objectContaining({
        pageImages: ["/tmp/page-001.png"]
      })
    );

    expect(result.extractionSource).toBe("qwen_vl_ocr");
    expect(result.bodyTextAvailable).toBe(true);
  });
});
```

---

## 10. Qwen-VL is not called when CourtListener plain_text exists

```js
import { describe, it, expect, vi } from "vitest";
import { processDocumentBody } from "../services/documentBodyProcessing.service.js";

describe("document body processing integration", () => {
  it("does not call PDF or Qwen processing when CourtListener plain_text exists", async () => {
    const extractEmbeddedPdfText = vi.fn();
    const renderPdfPagesToImages = vi.fn();

    const documentVisionParser = {
      run: vi.fn()
    };

    const result = await processDocumentBody({
      courtListenerPlainText: "CourtListener actual document body ".repeat(100),
      pdfPath: "/tmp/source.pdf",
      metadataText: "metadata description",
      extractEmbeddedPdfText,
      renderPdfPagesToImages,
      documentVisionParser
    });

    expect(extractEmbeddedPdfText).not.toHaveBeenCalled();
    expect(renderPdfPagesToImages).not.toHaveBeenCalled();
    expect(documentVisionParser.run).not.toHaveBeenCalled();
    expect(result.extractionSource).toBe("courtlistener_plain_text");
  });
});
```

---

## 11. Metadata-only extraction caps confidence

File:

```txt
backend/src/modules/recap-import/__tests__/legalExtraction.confidenceCap.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { applyExtractionConfidencePolicy } from "../agents/legalExtraction.agent.js";

describe("legalExtraction confidence policy", () => {
  it("caps overall confidence to 0.45 when extraction source is metadata_only", () => {
    const extraction = {
      confidence: {
        overall: 0.95
      }
    };

    const result = applyExtractionConfidencePolicy({
      extraction,
      extractionSource: "metadata_only"
    });

    expect(result.confidence.overall).toBeLessThanOrEqual(0.45);
    expect(result.confidenceCapApplied).toBe(true);
  });
});
```

---

## 12. Body-based extraction does not cap confidence

```js
import { describe, it, expect } from "vitest";
import { applyExtractionConfidencePolicy } from "../agents/legalExtraction.agent.js";

describe("legalExtraction confidence policy", () => {
  it("does not cap confidence when extraction uses document body text", () => {
    const extraction = {
      confidence: {
        overall: 0.95
      }
    };

    const result = applyExtractionConfidencePolicy({
      extraction,
      extractionSource: "pdf_embedded_text"
    });

    expect(result.confidence.overall).toBe(0.95);
    expect(result.confidenceCapApplied).toBe(false);
  });
});
```

---

## 13. Legal extraction receives body text, not metadata only, when available

```js
import { describe, it, expect, vi } from "vitest";
import { buildLegalExtractionInput } from "../agents/legalExtraction.agent.js";

describe("legalExtraction input building", () => {
  it("passes selected body text into DeepSeek extraction input", () => {
    const input = buildLegalExtractionInput({
      sourceMetadata: {
        description: "Motion to compel",
        caseName: "Example v. Defendant"
      },
      bodySource: {
        extractionSource: "pdf_embedded_text",
        text: "Actual motion body text with arguments and relief requested.",
        bodyTextAvailable: true,
        metadataOnly: false
      }
    });

    expect(input).toContain("Actual motion body text");
    expect(input).toContain("pdf_embedded_text");
    expect(input).toContain("Motion to compel");
  });
});
```

---

## 14. Metadata-only extraction creates review flag

File:

```txt
backend/src/modules/recap-import/__tests__/reviewFlag.metadataOnly.test.js
```

Test:

```js
import { describe, it, expect } from "vitest";
import { buildReviewFlags } from "../agents/reviewFlag.agent.js";

describe("reviewFlag.agent metadata-only behavior", () => {
  it("flags metadata-only extraction for human review", () => {
    const flags = buildReviewFlags({
      extractionSource: "metadata_only",
      bodyTextAvailable: false,
      extractedLegal: {
        confidence: {
          overall: 0.45
        }
      }
    });

    expect(flags.needsHumanReview).toBe(true);
    expect(flags.flags).toContainEqual(
      expect.objectContaining({
        code: "METADATA_ONLY_EXTRACTION"
      })
    );
  });
});
```

---

## 15. Manifest records extraction source

File:

```txt
backend/src/modules/recap-import/__tests__/manifest.extractionSource.test.js
```

Test:

```js
import { describe, it, expect } from "vitest";
import { buildDocumentManifest } from "../agents/manifest.agent.js";

describe("manifest.agent extraction source", () => {
  it("records extraction source and confidence cap status in document manifest", () => {
    const manifest = buildDocumentManifest({
      recapDocumentId: "123",
      sourceMetadata: {
        description: "Motion to compel"
      },
      bodySource: {
        extractionSource: "qwen_vl_ocr",
        bodyTextAvailable: true,
        bodyTextLength: 2500,
        pageImageCount: 3,
        metadataOnly: false
      },
      extractedLegal: {
        confidenceCapApplied: false,
        confidence: {
          overall: 0.88
        }
      }
    });

    expect(manifest.extraction.extractionSource).toBe("qwen_vl_ocr");
    expect(manifest.extraction.bodyTextAvailable).toBe(true);
    expect(manifest.extraction.bodyTextLength).toBe(2500);
    expect(manifest.extraction.confidenceCapApplied).toBe(false);
  });
});
```

---

## 16. Extraction source file is written to parsed folder

File:

```txt
backend/src/modules/recap-import/__tests__/extractionSourceFile.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { writeExtractionSourceFile } from "../services/documentBodyProcessing.service.js";

describe("extraction source file", () => {
  it("writes extraction_source.json into parsed folder", async () => {
    const writeJson = vi.fn().mockResolvedValue(undefined);

    await writeExtractionSourceFile({
      parsedDir: "/tmp/doc/parsed",
      bodySource: {
        extractionSource: "pdf_embedded_text",
        bodyTextAvailable: true,
        bodyTextLength: 1000,
        pageImageCount: 0,
        metadataOnly: false,
        confidenceCapApplied: false
      },
      writeJson
    });

    expect(writeJson).toHaveBeenCalledWith(
      "/tmp/doc/parsed/extraction_source.json",
      expect.objectContaining({
        extractionSource: "pdf_embedded_text",
        bodyTextAvailable: true,
        metadataOnly: false
      })
    );
  });
});
```

---

## 17. No unsupported OCR provider fallback

File:

```txt
backend/src/modules/recap-import/__tests__/ocrProviderPolicy.test.js
```

Test:

```js
import { describe, it, expect } from "vitest";
import { resolveOcrProvider } from "../agents/documentVisionParser.agent.js";

describe("OCR provider policy", () => {
  it("allows only qwen_vl as OCR provider", () => {
    expect(resolveOcrProvider("qwen_vl")).toBe("qwen_vl");
    expect(() => resolveOcrProvider("tesseract")).toThrow(/unsupported OCR provider/i);
    expect(() => resolveOcrProvider("fallback")).toThrow(/unsupported OCR provider/i);
  });
});
```

---

## 18. End-to-end service does not call legal extraction before body source selection

File:

```txt
backend/src/modules/recap-import/__tests__/recapImport.service.bodyOrder.test.js
```

Test:

```js
import { describe, it, expect, vi } from "vitest";
import { RecapImportService } from "../services/recapImport.service.js";

describe("recapImport.service body extraction order", () => {
  it("selects document body source before calling legal extraction", async () => {
    const callOrder = [];

    const service = new RecapImportService({
      recapSearchAgent: { run: vi.fn() },
      queueService: {},
      fetchAgent: {
        run: vi.fn().mockImplementation(async () => {
          callOrder.push("fetch");
          return {
            metadata: {
              plainText: "CourtListener body text ".repeat(100)
            },
            localPdfPath: "/tmp/source.pdf"
          };
        })
      },
      documentBodyProcessingService: {
        process: vi.fn().mockImplementation(async () => {
          callOrder.push("body");
          return {
            extractionSource: "courtlistener_plain_text",
            text: "CourtListener body text ".repeat(100),
            bodyTextAvailable: true,
            metadataOnly: false
          };
        })
      },
      legalExtractionAgent: {
        run: vi.fn().mockImplementation(async () => {
          callOrder.push("legalExtraction");
          return {
            confidence: { overall: 0.9 }
          };
        })
      }
    });

    await service.processFetchedDocument({
      jobId: "job_1",
      document: {
        recapDocumentId: "123"
      }
    });

    expect(callOrder).toEqual(["fetch", "body", "legalExtraction"]);
  });
});
```

---

# Implementation Notes

## PDF embedded text extraction

Use a Node-compatible PDF parser already acceptable in the project.

Preferred options:

```txt
pdf-parse
pdfjs-dist
```

Keep it simple.

The service should be dependency-injectable for tests.

Expected shape:

```js
export async function extractEmbeddedPdfText({
  pdfPath,
  pdfLoader = defaultPdfLoader
}) {
  const loaded = await pdfLoader(pdfPath);

  const text = loaded.pages
    .map((page, index) => `\n\n--- Page ${index + 1} ---\n${page.text || ""}`)
    .join("\n");

  const charCount = text.trim().length;

  return {
    text,
    pageCount: loaded.pageCount ?? loaded.pages.length,
    charCount,
    textQuality: charCount >= 500 ? "usable" : "low",
    shouldUseVisionFallback: charCount < 500
  };
}
```

---

## PDF-to-image rendering

Implement the current stub for real.

Use one of these if already acceptable in repo:

```txt
pdf-poppler
pdfjs-dist + canvas
child_process calling pdftoppm if available
```

For MVP, dependency-inject the renderer so tests do not need real system binaries.

Expected shape:

```js
export async function renderPdfPagesToImages({
  pdfPath,
  outputDir,
  maxPages = 5,
  renderer = defaultRenderer
}) {
  try {
    const pageImages = await renderer({ pdfPath, outputDir, maxPages });
    return {
      pageImages,
      pageImageCount: pageImages.length,
      error: null
    };
  } catch (error) {
    return {
      pageImages: [],
      pageImageCount: 0,
      error: error.message
    };
  }
}
```

---

## Document body processing service

Create:

```txt
backend/src/modules/recap-import/services/documentBodyProcessing.service.js
```

Expected exported functions:

```js
export async function processDocumentBody(...)
export async function writeExtractionSourceFile(...)
```

It should:

1. Use CourtListener plain text immediately if available.
2. Else extract PDF embedded text if local PDF exists.
3. Else attempt Qwen-VL only if page images were rendered.
4. Else metadata-only fallback.
5. Write `parsed/parsed.md`.
6. Write `parsed/extraction_source.json`.
7. Return the body source object to downstream agents.

---

## Legal extraction input

`legalExtraction.agent.js` must receive:

```js
{
  sourceMetadata,
  bodySource,
  legalAnnotations,
  reviewFlags
}
```

The prompt/input must clearly tell DeepSeek:

```txt
Use DOCUMENT BODY as the primary evidence.
Use metadata only for case identity, docket identity, court, date, and description.
If extractionSource is metadata_only, do not infer facts not present in metadata.
```

---

## Review flags

Metadata-only extraction must create a review flag:

```js
{
  code: "METADATA_ONLY_EXTRACTION",
  severity: "high",
  message: "No CourtListener plain_text, PDF embedded text, or OCR text was available. Extraction was based on metadata only."
}
```

Low OCR quality should create:

```js
{
  code: "LOW_BODY_TEXT_QUALITY",
  severity: "medium"
}
```

PDF render failure should create:

```js
{
  code: "PDF_RENDER_FAILED",
  severity: "medium"
}
```

---

## Manifest Requirements

`document_manifest.json` must include:

```js
{
  extraction: {
    extractionSource,
    bodyTextAvailable,
    bodyTextLength,
    pageImageCount,
    metadataOnly,
    confidenceCapApplied,
    confidenceOverall
  }
}
```

This is required so future evaluations can separate real body extraction from metadata-only extraction.

---

# Acceptance Criteria

This update is complete only when:

1. Red tests are written first.
2. New tests fail before implementation.
3. Production implementation is added after test failure is confirmed.
4. All old tests still pass.
5. All new tests pass.
6. `PdfToImageService` is no longer a stub.
7. CourtListener `plain_text` is used first when available.
8. Embedded PDF text is extracted when `plain_text` is missing.
9. Qwen-VL OCR is used when embedded PDF text is missing or too short.
10. Metadata-only extraction is still allowed as fallback but clearly marked.
11. Metadata-only confidence is capped at `0.45`.
12. `extraction_source.json` is written for every document.
13. `document_manifest.json` records extraction source and confidence cap status.
14. `review_flags.json` flags metadata-only extraction.
15. No unsupported OCR provider is added.
16. No Supabase, frontend, PACER purchase, RECAP Fetch, or external storage is added.

---

# Manual Verification Command

After implementation, run one small job:

```bash
bash -lc 'npm start > /tmp/recap-server.log 2>&1 & SERVER_PID=$!; sleep 3; JOB_ID=$(curl -s -X POST http://localhost:3000/api/recap-import/jobs -H "Content-Type: application/json" -d "{\"searchTerms\":\"motion to compel\",\"targetCount\":3}" | jq -r .jobId); echo "JOB_ID=$JOB_ID"; for i in 1 2 3; do echo "Processing doc $i..."; curl -s -X POST "http://localhost:3000/api/recap-import/jobs/$JOB_ID/process" | jq; done; echo "EXTRACTION SOURCES:"; find ./data/recap-imports -name extraction_source.json -print -exec cat {} \; | head -200; echo "MANIFEST CHECK:"; find ./data/recap-imports -name document_manifest.json -print -exec jq ".extraction" {} \; | head -200; kill $SERVER_PID'
```

Expected result:

```txt
At least one processed document should show one of:
- courtlistener_plain_text
- pdf_embedded_text
- qwen_vl_ocr

If all documents are metadata_only, the pipeline still works but retrieval/body extraction quality should be investigated.
```

---

# Current Working Note

The previous fix proved the RECAP document-level pipeline can find and download real documents. This update makes sure the extraction model is using the actual filing body whenever possible, and prevents misleading high-confidence legal extraction when only metadata was available.
