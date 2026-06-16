import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';

import { loadRecapImportConfig } from './modules/recap-import/services/config.service.js';
import { RecapFileStore } from './modules/recap-import/services/recapFileStore.service.js';
import { JsonWriterService } from './modules/recap-import/services/jsonWriter.service.js';
import { EvalWriter } from './modules/recap-import/services/evalWriter.service.js';
import { PdfToImageService } from './modules/recap-import/services/pdfToImage.service.js';
import { sha256File } from './modules/recap-import/services/hash.service.js';

import { CourtListenerClient } from './modules/recap-import/clients/courtListener.client.js';
import { OpenRouterTextClient } from './modules/recap-import/clients/openRouterText.client.js';
import { OpenRouterVisionClient } from './modules/recap-import/clients/openRouterVision.client.js';

import { RecapSearchAgent } from './modules/recap-import/agents/recapSearch.agent.js';
import { QueueAgent } from './modules/recap-import/agents/queue.agent.js';
import { MetadataAgent } from './modules/recap-import/agents/metadata.agent.js';
import { CaseFolderAgent } from './modules/recap-import/agents/caseFolder.agent.js';
import { FetchAgent } from './modules/recap-import/agents/fetch.agent.js';
import { TextTriageAgent } from './modules/recap-import/agents/textTriage.agent.js';
import { DocumentVisionParserAgent } from './modules/recap-import/agents/documentVisionParser.agent.js';
import { ReviewFlagAgent } from './modules/recap-import/agents/reviewFlag.agent.js';
import { LegalAnnotationAgent } from './modules/recap-import/agents/legalAnnotation.agent.js';
import { LegalExtractionAgent } from './modules/recap-import/agents/legalExtraction.agent.js';
import { ManifestAgent } from './modules/recap-import/agents/manifest.agent.js';

import { FsQueueRepository } from './modules/recap-import/repositories/fsQueue.repository.js';
import { RecapImportService } from './modules/recap-import/recapImport.service.js';
import { RecapImportController } from './modules/recap-import/recapImport.controller.js';
import { createRecapImportRouter } from './modules/recap-import/recapImport.routes.js';

const PORT = process.env.PORT || 3000;

async function main() {
  const config = loadRecapImportConfig(process.env);

  const fileStore = new RecapFileStore();
  const jsonWriter = new JsonWriterService({ fs });
  const evalWriter = new EvalWriter(fileStore);
  const pdfToImageService = new PdfToImageService();

  const courtListenerClient = new CourtListenerClient({
    baseUrl: config.courtListener.baseUrl,
    token: config.courtListener.token,
  });

  const openRouterTextClient = new OpenRouterTextClient({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_API_BASE_URL,
    model: config.legalExtraction.model,
  });

  const openRouterVisionClient = new OpenRouterVisionClient({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_API_BASE_URL,
    model: config.ocr.qwenVlModel,
  });

  const queueRepository = new FsQueueRepository({
    queueDir: `${config.outputRoot}/.queue`,
  });

  const recapSearchAgent = new RecapSearchAgent({
    courtListenerClient,
    config,
  });

  const queueAgent = new QueueAgent({
    repository: queueRepository,
    concurrency: config.queueConcurrency,
  });

  const metadataAgent = new MetadataAgent({
    writer: jsonWriter,
  });

  const caseFolderAgent = new CaseFolderAgent({
    outputRoot: config.outputRoot,
    fileStore,
  });

  const fetchAgent = new FetchAgent({
    fileStore,
    hashService: { sha256File },
  });

  const textTriageAgent = new TextTriageAgent();

  const documentVisionParserAgent = new DocumentVisionParserAgent({
    openRouterVisionClient,
    fileStore,
    pdfToImageService,
    config: {
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      provider: config.ocr.provider,
      qwenVlModel: config.ocr.qwenVlModel,
    },
  });

  const reviewFlagAgent = new ReviewFlagAgent();

  const legalAnnotationAgent = new LegalAnnotationAgent({
    writer: jsonWriter,
  });

  const legalExtractionAgent = new LegalExtractionAgent({
    openRouterTextClient,
    writer: jsonWriter,
    config: {
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      legalExtractionModel: config.legalExtraction.model,
    },
  });

  const manifestAgent = new ManifestAgent({
    writer: jsonWriter,
  });

  const service = new RecapImportService({
    queueAgent,
    recapSearchAgent,
    metadataAgent,
    caseFolderAgent,
    fetchAgent,
    textTriageAgent,
    documentVisionParserAgent,
    reviewFlagAgent,
    legalAnnotationAgent,
    legalExtractionAgent,
    manifestAgent,
  });

  const controller = new RecapImportController({
    recapImportService: service,
    config: process.env,
  });

  const router = createRecapImportRouter(controller);

  const app = express();
  app.use(express.json());
  app.use('/api/recap-import', router);

  app.listen(PORT, () => {
    console.log(`RECAP Extractor server running on http://localhost:${PORT}`);
    console.log(`API: POST /api/recap-import/jobs  (search and create job)`);
    console.log(`     POST /api/recap-import/jobs/:jobId/process  (process next doc)`);
    console.log(`     GET  /api/recap-import/jobs/:jobId  (job status)`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
