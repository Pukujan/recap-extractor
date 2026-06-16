export function loadRecapImportConfig(env) {
  if (!env.COURTLISTENER_API_TOKEN) {
    throw new Error("COURTLISTENER_API_TOKEN is required");
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required");
  }
  if (!env.QWEN_VL_MODEL) {
    throw new Error("QWEN_VL_MODEL is required");
  }
  if (!env.LEGAL_EXTRACTION_MODEL) {
    throw new Error("LEGAL_EXTRACTION_MODEL is required");
  }

  const ocrProvider = env.OCR_PROVIDER || "qwen_vl";
  if (ocrProvider !== "qwen_vl") {
    throw new Error("OCR_PROVIDER must be qwen_vl for MVP");
  }

  if (env.ALLOW_PACER_PURCHASE === "true") {
    throw new Error("PACER purchase is disabled for MVP");
  }

  if (env.ALLOW_RECAP_FETCH === "true") {
    throw new Error("RECAP Fetch is disabled for MVP");
  }

  if (env.RECAP_IMPORT_USE_FIXTURES === "true") {
    throw new Error("Fixtures mode is for tests only");
  }

  const queueConcurrency = env.RECAP_IMPORT_QUEUE_CONCURRENCY
    ? parseInt(env.RECAP_IMPORT_QUEUE_CONCURRENCY, 10)
    : 1;

  if (queueConcurrency > 1) {
    throw new Error("Queue concurrency must be 1 for MVP");
  }

  return {
    courtListener: {
      baseUrl: env.COURTLISTENER_API_BASE_URL,
      token: env.COURTLISTENER_API_TOKEN,
    },
    outputRoot: env.RECAP_IMPORT_OUTPUT_ROOT,
    maxTargetCount: parseInt(env.RECAP_IMPORT_MAX_TARGET_COUNT, 10) || 100,
    queueConcurrency,
    ocr: {
      provider: ocrProvider,
      qwenVlModel: env.QWEN_VL_MODEL,
    },
    legalExtraction: {
      model: env.LEGAL_EXTRACTION_MODEL,
    },
    safety: {
      allowPacerPurchase: env.ALLOW_PACER_PURCHASE === "true",
      allowRecapFetch: env.ALLOW_RECAP_FETCH === "true",
    },
  };
}
