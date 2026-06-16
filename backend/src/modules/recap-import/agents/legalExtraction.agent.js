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

If information is not present in the text, use empty arrays or null values. Do not invent information.`;

export class LegalExtractionAgent {
  constructor({ openRouterTextClient, writer, config }) {
    this.openRouterTextClient = openRouterTextClient;
    this.writer = writer;
    this.config = config;
  }

  async run(input) {
    const { parsed, annotations, metadata, review, folders } = input;
    const { openRouterApiKey, legalExtractionModel } = this.config;

    if (!openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for LegalExtractionAgent");
    }
    if (!legalExtractionModel) {
      throw new Error("LEGAL_EXTRACTION_MODEL is required for LegalExtractionAgent");
    }

    const combinedInput = JSON.stringify({
      text: parsed.text || "",
      pages: parsed.pages || [],
      annotations: annotations.annotations || [],
      metadata,
      review,
    }, null, 2);

    const result = await this.openRouterTextClient.extractLegalJson({
      model: legalExtractionModel,
      prompt: LEGAL_EXTRACTION_PROMPT,
      input: combinedInput,
    });

    if (typeof result === "string") {
      throw new Error("Legal extraction returned prose/markdown instead of strict JSON");
    }

    const extractedPath = `${folders.documentFolderPath}extracted/extracted_legal.json`;
    await this.writer.writeJson(extractedPath, result);

    return result;
  }
}
