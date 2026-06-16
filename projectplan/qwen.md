---

<details>
<summary>18. MVP OCR Provider Override: Use Qwen-VL via OpenRouter First</summary>

## Decision

For the first MVP/mockup, use **Qwen-VL through OpenRouter** as the document vision/OCR parser instead of PaddleOCR.

Reason:

```text
Qwen-VL is easier to wire quickly through OpenRouter.
It can parse document page images, identify text/layout, detect likely signatures/handwriting, and return structured JSON.
PaddleOCR can be added later for stronger OCR confidence, bounding boxes, and layout precision.
```

Do not hardcode the parser as PaddleOCR.

Rename the OCR module conceptually:

```text
ocr.agent.js
documentVisionParser.agent.js
```

The adapter should support multiple providers:

```ts
type OcrProvider = "qwen_vl" | "paddleocr" | "mock";
```

Default MVP provider:

```env
OCR_PROVIDER=qwen_vl
```

---

## .env.example Addition

Append this to `.env.example`:

```env
# OCR / Vision Parser Provider
OCR_PROVIDER=qwen_vl
OCR_MODE=vl_mockup

# OpenRouter
OPENROUTER_API_KEY=replace_me
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1

# Preferred small/cheap vision model for MVP
QWEN_VL_MODEL=qwen/qwen3-vl-8b-instruct

# Fallback if Qwen3-VL-8B is unavailable in your OpenRouter account
QWEN_VL_FALLBACK_MODEL=qwen/qwen-2.5-vl-7b-instruct

# Stronger but more expensive fallback
QWEN_VL_STRONG_MODEL=qwen/qwen2.5-vl-72b-instruct

# OCR thresholds still apply
OCR_MIN_TEXT_CHARS=1000
OCR_MIN_CHARS_PER_PAGE=500
OCR_MAX_GARBAGE_RATIO=0.15
OCR_FORCE_DEFAULT=false
```

---

## Provider Selection Rule

The OCR agent must choose provider by env:

```ts
function getOcrProvider() {
  return process.env.OCR_PROVIDER || "qwen_vl";
}
```

Provider behavior:

```text
OCR_PROVIDER=qwen_vl
  -> use OpenRouter Qwen-VL adapter

OCR_PROVIDER=paddleocr
  -> use PaddleOCR adapter later

OCR_PROVIDER=mock
  -> use deterministic fixture output for tests
```

Guardrail:

```text
No backend code should assume PaddleOCR is the only parser.
No file names should say paddleocr-only unless the runtime actually used PaddleOCR.
Use generic artifact names: parsed.md, parsed_pages.json, layout_summary.json, review_flags.json.
```

---

## Qwen-VL Agent Contract

Agent file:

```text
backend/src/modules/recap-import/agents/ocr.agent.js
```

Client file:

```text
backend/src/modules/recap-import/clients/openRouterVision.client.js
```

Optional provider router:

```text
backend/src/modules/recap-import/services/ocrProvider.service.js
```

---

## Qwen-VL OCR Agent Input

```json
{
  "provider": "qwen_vl",
  "model": "qwen/qwen3-vl-8b-instruct",
  "documentFolderPath": "data/recap-imports/.../documents/doc-001-complaint/",
  "pdfPath": "source/source.pdf",
  "pageImages": [
    "pages/page-001.png",
    "pages/page-002.png"
  ],
  "plainText": "",
  "requiresOcr": true,
  "reason": "plain_text_missing"
}
```

---

## Qwen-VL OCR Agent Process

The agent should:

```text
convert PDF pages to images if needed
send page images to Qwen-VL through OpenRouter
ask for page-level transcription and layout summary
ask for likely signatures/handwriting/seals/stamps
ask for uncertainty markers
ask for strict JSON output
save parsed text and structured page output
mark bboxAvailable=false unless model returns trustworthy coordinates
```

Important:

```text
Qwen-VL is acceptable for MVP parsing.
Qwen-VL is not trusted as a precise bounding-box OCR engine.
If exact coordinates are missing, review flags must be page-level only.
```

---

## Qwen-VL Prompt Contract

Use a strict prompt similar to this:

```text
You are a document vision parser for legal filings.

Task:
Read the provided document page image and extract as much useful document text and legal/document structure as possible.

Return strict JSON only.

Do not invent facts.
If text is uncertain, mark it as uncertain.
If handwriting, signature, stamp, seal, table, exhibit label, or unreadable area appears, flag it.
If exact bounding boxes are not available, use page-level flags and set bboxAvailable=false.

Required JSON shape:
{
  "page": number,
  "transcribedText": string,
  "layoutSummary": {
    "hasHeader": boolean,
    "hasFooter": boolean,
    "hasTable": boolean,
    "hasSignatureBlock": boolean,
    "hasHandwriting": boolean,
    "hasSealOrStamp": boolean,
    "hasExhibitLabel": boolean
  },
  "legalHints": {
    "possibleDocumentType": string | null,
    "possibleMotionType": string | null,
    "partyNames": string[],
    "attorneyNames": string[],
    "courtNames": string[],
    "dates": string[],
    "legalTerms": string[]
  },
  "reviewFlags": [
    {
      "flagType": string,
      "severity": "low" | "medium" | "high",
      "page": number,
      "reason": string,
      "confidence": number,
      "bboxAvailable": false,
      "bbox": null
    }
  ],
  "confidence": {
    "text": number,
    "layout": number,
    "legalHints": number
  }
}
```

---

## OpenRouter Vision Client Contract

The OpenRouter client should use the OpenAI-compatible chat/completions API.

Pseudo-shape:

```ts
export class OpenRouterVisionClient {
  constructor({ apiKey, baseUrl, model, fetchImpl }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.fetch = fetchImpl || fetch;
  }

  async parsePageImage({ imageBase64, prompt }) {
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter vision request failed: ${response.status}`);
    }

    return response.json();
  }
}
```

Guardrail:

```text
Tests must mock OpenRouterVisionClient.
Do not call real OpenRouter in unit tests.
```

---

## OCR Agent Output for Qwen-VL

When Qwen-VL is used, output should look like:

```json
{
  "usedOcr": true,
  "provider": "qwen_vl",
  "model": "qwen/qwen3-vl-8b-instruct",
  "bboxAvailable": false,
  "coordinateReviewPrecision": "page_level_only",
  "parsedTextPath": "parsed/parsed.md",
  "parsedPagesPath": "parsed/parsed_pages.json",
  "layoutSummaryPath": "parsed/layout_summary.json",
  "ocrQualityReportPath": "parsed/ocr_quality_report.json",
  "reviewFlagsPath": "review/review_flags.json"
}
```

If the model returns coordinates, still treat them as lower-trust:

```json
{
  "bboxAvailable": true,
  "coordinateReviewPrecision": "model_estimated_not_verified"
}
```

---

## Artifact Naming Update

Because Qwen-VL may not provide real OCR boxes, use these generic files:

```text
parsed/
  parsed.md
  parsed_pages.json
  layout_summary.json
  ocr_quality_report.json

review/
  review_flags.json
```

Only write this file when real/usable boxes exist:

```text
parsed/layout_boxes.json
```

If boxes do not exist, write this in `ocr_quality_report.json`:

```json
{
  "bboxAvailable": false,
  "coordinateReviewPrecision": "page_level_only",
  "reason": "qwen_vl_provider_did_not_return_verified_bounding_boxes"
}
```

---

## Review Flag Rule for Qwen-VL

For Qwen-VL MVP, review flags can be page-level.

Example:

```json
{
  "reviewRequired": true,
  "flags": [
    {
      "flagType": "signature_possible",
      "severity": "medium",
      "page": 4,
      "reason": "Qwen-VL detected a likely signature block near the end of the page.",
      "confidence": 0.78,
      "bboxAvailable": false,
      "bbox": null
    }
  ]
}
```

Do not pretend these are exact coordinate flags.

---

## Triage Update

Existing OCR trigger rules still apply.

If OCR is required and `OCR_PROVIDER=qwen_vl`, use Qwen-VL.

```ts
if (triage.requiresOcr && process.env.OCR_PROVIDER === "qwen_vl") {
  return qwenVlOcrAgent.run(input);
}
```

If OCR is not required, use existing RECAP text and skip Qwen-VL.

```ts
if (!triage.requiresOcr) {
  return ocrAgent.fromPlainText(input);
}
```

---

## TDD Additions for Qwen-VL MVP

Add these tests.

### 1. provider selection uses qwen_vl by default

```js
describe("ocrProvider.service", () => {
  it("uses qwen_vl provider from env", () => {
    process.env.OCR_PROVIDER = "qwen_vl";

    const provider = getOcrProvider();

    expect(provider).toBe("qwen_vl");
  });
});
```

### 2. OCR agent calls OpenRouter when provider is qwen_vl

```js
describe("OcrAgent with Qwen-VL provider", () => {
  it("calls OpenRouterVisionClient when OCR is required", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                page: 1,
                transcribedText: "Plaintiff moves to compel discovery.",
                layoutSummary: {
                  hasHeader: true,
                  hasFooter: false,
                  hasTable: false,
                  hasSignatureBlock: false,
                  hasHandwriting: false,
                  hasSealOrStamp: false,
                  hasExhibitLabel: false
                },
                legalHints: {
                  possibleDocumentType: "motion",
                  possibleMotionType: "motion_to_compel",
                  partyNames: ["Plaintiff"],
                  attorneyNames: [],
                  courtNames: [],
                  dates: [],
                  legalTerms: ["discovery"]
                },
                reviewFlags: [],
                confidence: {
                  text: 0.86,
                  layout: 0.8,
                  legalHints: 0.72
                }
              })
            }
          }
        ]
      })
    };

    const agent = createOcrAgent({
      provider: "qwen_vl",
      openRouterVisionClient
    });

    const result = await agent.run({
      triage: {
        requiresOcr: true,
        reason: "plain_text_missing"
      },
      fetched: {
        pdfExists: true,
        pageImages: ["pages/page-001.png"]
      },
      folders: mockFolders()
    });

    expect(openRouterVisionClient.parsePageImage).toHaveBeenCalledTimes(1);
    expect(result.usedOcr).toBe(true);
    expect(result.provider).toBe("qwen_vl");
  });
});
```

### 3. Qwen-VL output marks bbox unavailable when no coordinates exist

```js
describe("Qwen-VL OCR output", () => {
  it("marks bboxAvailable=false when model does not return coordinates", async () => {
    const agent = createOcrAgent({
      provider: "qwen_vl",
      openRouterVisionClient: mockQwenVlClientWithoutBboxes()
    });

    const result = await agent.run(mockOcrRequiredInput());

    expect(result.bboxAvailable).toBe(false);
    expect(result.coordinateReviewPrecision).toBe("page_level_only");
  });
});
```

### 4. Qwen-VL signature detection creates page-level review flag

```js
describe("Qwen-VL review flags", () => {
  it("creates page-level signature flag from Qwen-VL response", async () => {
    const agent = createOcrAgent({
      provider: "qwen_vl",
      openRouterVisionClient: mockQwenVlClient({
        reviewFlags: [
          {
            flagType: "signature_possible",
            severity: "medium",
            page: 2,
            reason: "Likely signature block detected.",
            confidence: 0.81,
            bboxAvailable: false,
            bbox: null
          }
        ]
      })
    });

    const result = await agent.run(mockOcrRequiredInput());

    expect(result.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flagType: "signature_possible",
          page: 2,
          bboxAvailable: false
        })
      ])
    );
  });
});
```

### 5. Plain text usable skips Qwen-VL

```js
describe("OcrAgent provider skip behavior", () => {
  it("does not call Qwen-VL when RECAP plain text is usable", async () => {
    const openRouterVisionClient = {
      parsePageImage: vi.fn()
    };

    const agent = createOcrAgent({
      provider: "qwen_vl",
      openRouterVisionClient
    });

    const result = await agent.run({
      triage: {
        requiresOcr: false,
        reason: "plain_text_usable"
      },
      fetched: {
        plainText: "Usable RECAP text ".repeat(500),
        plainTextExists: true
      },
      folders: mockFolders()
    });

    expect(openRouterVisionClient.parsePageImage).not.toHaveBeenCalled();
    expect(result.usedOcr).toBe(false);
  });
});
```

---

## Acceptance Criteria Update

MVP is acceptable if:

```text
Qwen-VL can be selected via OCR_PROVIDER=qwen_vl
OpenRouter API key/model are loaded from env
unit tests mock Qwen-VL responses
OCR agent writes parsed.md and parsed_pages.json
review flags are saved
bboxAvailable=false when no verified boxes exist
frontend still only shows output folder path
PaddleOCR can be added later without rewriting the pipeline
```

---

## Final Guardrail

Use Qwen-VL for the MVP parser, but keep the architecture provider-neutral.

```text
Qwen-VL now.
PaddleOCR later.
Same agent contract.
Same folder contract.
Same frontend.
Same queue.
```

</details>
