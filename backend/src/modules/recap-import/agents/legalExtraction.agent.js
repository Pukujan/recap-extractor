const LEGAL_EXTRACTION_PROMPT = `You are a precise legal document extraction system. Return ONLY a valid JSON object with no markdown wrapping, no code fences, and no additional text.

Extract structured legal information from the following legal document text and annotations. Return this exact JSON structure:
{
  "document": {
    "documentType": "<string>",
    "filingType": "<string>",
    "description": "<string>",
    "court": "<string>",
    "caseName": "<string>",
    "docketNumber": "<string>",
    "recapDocumentId": "<string>",
    "dateFiled": "<string | null>"
  },
  "parties": [
    {
      "name": "<string>",
      "role": "<string>",
      "type": "<individual|organization|government>"
    }
  ],
  "attorneys": [
    {
      "name": "<string>",
      "firm": "<string | null>",
      "representing": ["<string>"]
    }
  ],
  "judges": [
    {
      "name": "<string>",
      "title": "<string>"
    }
  ],
  "dates": [
    {
      "date": "<string>",
      "description": "<string>"
    }
  ],
  "deadlines": [
    {
      "date": "<string>",
      "description": "<string>"
    }
  ],
  "motions": [
    {
      "type": "<string>",
      "filedBy": "<string>",
      "relief": "<string>",
      "status": "<pending|granted|denied|withdrawn>"
    }
  ],
  "orders": [
    {
      "type": "<string>",
      "issuedBy": "<string>",
      "date": "<string>",
      "description": "<string>"
    }
  ],
  "claims": [
    {
      "description": "<string>",
      "plaintiff": "<string>",
      "defendant": "<string>"
    }
  ],
  "defenses": [
    {
      "description": "<string>",
      "assertedBy": "<string>"
    }
  ],
  "legalTerms": ["<string>"],
  "citations": [
    {
      "citation": "<string>",
      "context": "<string>"
    }
  ],
  "exhibits": [
    {
      "label": "<string>",
      "description": "<string>"
    }
  ],
  "medicalEntities": [
    {
      "name": "<string>",
      "type": "<diagnosis|condition|treatment|medication|provider>"
    }
  ],
  "discoveryIssues": [
    {
      "issue": "<string>",
      "description": "<string>"
    }
  ],
  "reviewFlags": [
    {
      "flagType": "<string>",
      "severity": "<low|medium|high>",
      "reason": "<string>"
    }
  ],
  "confidence": {
    "overall": "<number 0-1>",
    "documentType": "<number 0-1>",
    "entities": "<number 0-1>",
    "dates": "<number 0-1>",
    "legalIssues": "<number 0-1>"
  }
}

Use DOCUMENT BODY as the primary evidence.
Use metadata only for case identity, docket identity, court, date, and description.
If extractionSource is metadata_only, do not infer facts not present in metadata.
If information is not present in the text, use empty arrays or null values. Do not invent information.`;

export function buildLegalExtractionInput({ sourceMetadata, bodySource, annotations }) {
  const parts = [];

  if (bodySource.bodyTextAvailable && bodySource.text) {
    parts.push(`=== DOCUMENT BODY (source: ${bodySource.extractionSource}) ===\n${bodySource.text}`);
  }

  parts.push(`=== METADATA ===\n${JSON.stringify(sourceMetadata, null, 2)}`);

  if (annotations && annotations.length > 0) {
    parts.push(`=== ANNOTATIONS ===\n${JSON.stringify(annotations, null, 2)}`);
  }

  if (!bodySource.bodyTextAvailable) {
    parts.push('NOTE: No document body text was available. Extraction is based on metadata only. Do not infer facts not present in the metadata.');
  }

  return parts.join('\n\n');
}

export function applyExtractionConfidencePolicy({ extraction, extractionSource }) {
  const result = { ...extraction, confidence: { ...extraction.confidence } };

  if (extractionSource === 'metadata_only') {
    result.confidence.overall = Math.min(result.confidence.overall ?? 1, 0.45);
    result.confidence.documentType = Math.min(result.confidence.documentType ?? 1, 0.45);
    result.confidence.entities = Math.min(result.confidence.entities ?? 1, 0.35);
    result.confidence.dates = Math.min(result.confidence.dates ?? 1, 0.5);
    result.confidence.legalIssues = Math.min(result.confidence.legalIssues ?? 1, 0.3);
    result.confidenceCapApplied = true;
  } else {
    result.confidenceCapApplied = false;
  }

  return result;
}

export class LegalExtractionAgent {
  constructor({ openRouterTextClient, writer, config }) {
    this.openRouterTextClient = openRouterTextClient;
    this.writer = writer;
    this.config = config;
  }

  async run(input) {
    const { bodySource, metadata, annotations, folders } = input;
    const { openRouterApiKey, legalExtractionModel } = this.config;

    if (!openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is required for LegalExtractionAgent');
    }
    if (!legalExtractionModel) {
      throw new Error('LEGAL_EXTRACTION_MODEL is required for LegalExtractionAgent');
    }

    const extractionInput = buildLegalExtractionInput({
      sourceMetadata: metadata,
      bodySource,
      annotations: annotations?.annotations || [],
    });

    const result = await this.openRouterTextClient.extractLegalJson({
      model: legalExtractionModel,
      prompt: LEGAL_EXTRACTION_PROMPT,
      input: JSON.stringify({ text: extractionInput }),
    });

    if (typeof result === 'string') {
      throw new Error('Legal extraction returned prose/markdown instead of strict JSON');
    }

    const policyApplied = applyExtractionConfidencePolicy({
      extraction: result,
      extractionSource: bodySource.extractionSource,
    });

    const extractedPath = `${folders.documentFolderPath}extracted/extracted_legal.json`;
    await this.writer.writeJson(extractedPath, policyApplied);

    return policyApplied;
  }
}
