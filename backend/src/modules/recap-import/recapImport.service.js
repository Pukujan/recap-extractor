export class RecapImportService {
  constructor(agents) {
    this.queueAgent = agents.queueAgent;
    this.recapSearchAgent = agents.recapSearchAgent;
    this.metadataAgent = agents.metadataAgent;
    this.caseFolderAgent = agents.caseFolderAgent;
    this.fetchAgent = agents.fetchAgent;
    this.textTriageAgent = agents.textTriageAgent;
    this.documentVisionParserAgent = agents.documentVisionParserAgent;
    this.reviewFlagAgent = agents.reviewFlagAgent;
    this.legalAnnotationAgent = agents.legalAnnotationAgent;
    this.legalExtractionAgent = agents.legalExtractionAgent;
    this.manifestAgent = agents.manifestAgent;
    this.documentBodyProcessingService = agents.documentBodyProcessingService;
  }

  async createJob(input) {
    console.log(`[pipeline] Creating job: search="${input.searchTerms}", targetCount=${input.targetCount}`);
    const job = await this.queueAgent.createJob(input);

    console.log(`[pipeline] Searching CourtListener RECAP...`);
    const searchResult = await this.recapSearchAgent.run({
      searchTerms: input.searchTerms,
      targetCount: input.targetCount,
      court: input.court,
      ocrMode: input.ocrMode,
    });
    console.log(`[pipeline] Found ${searchResult.candidates.length} available documents`);

    await this.queueAgent.enqueueDocuments(job.id, searchResult.candidates);
    console.log(`[pipeline] Job ${job.id} created with ${searchResult.candidates.length} queued documents`);

    return { jobId: job.id };
  }

  async processNextDocument(jobId) {
    const task = await this.queueAgent.claimNext(jobId);
    if (!task) return null;

    console.log(`[pipeline] Processing doc ${task.sequenceNumber}: ${task.description?.slice(0, 80)}...`);

    let metadata = null;
    let folders = null;
    let fetchResult = null;
    let bodySource = null;

    try {
      console.log(`[pipeline]   metadata...`);
      metadata = await this.metadataAgent.run(task);

      console.log(`[pipeline]   folder...`);
      folders = await this.caseFolderAgent.run({ task, metadata });
      if (!folders || !folders.documentFolderPath) {
        throw new Error(`caseFolderAgent returned invalid folders: ${JSON.stringify(folders)}`);
      }

      console.log(`[pipeline]   fetch...`);
      fetchResult = await this.fetchAgent.run({ task, metadata, folders });

      console.log(`[pipeline]   body source...`);
      bodySource = await this.documentBodyProcessingService.run({
        courtListenerPlainText: metadata.plainText || '',
        pdfPath: fetchResult.pdfPath,
        metadataText: metadata.description || '',
        folders,
        fileStore: this.documentBodyProcessingService.fileStore,
      });
      console.log(`[pipeline]   body source: ${bodySource.extractionSource} (${bodySource.bodyTextLength} chars)`);

      console.log(`[pipeline]   triage...`);
      const triageResult = await this.textTriageAgent.run({
        ...fetchResult,
        pageCount: metadata.pageCount || null,
        ocrStatus: metadata.ocrStatus || null,
      });

      console.log(`[pipeline]   vision...`);
      const visionResult = await this.documentVisionParserAgent.run({ triage: triageResult, fetched: fetchResult, folders });

      console.log(`[pipeline]   review flags...`);
      const flags = await this.reviewFlagAgent.run({ parsed: visionResult, metadata, bodySource });

      console.log(`[pipeline]   annotations...`);
      const annotations = await this.legalAnnotationAgent.run({ parsed: visionResult, metadata, review: flags, folders });

      console.log(`[pipeline]   DeepSeek extraction...`);
      const extraction = await this.legalExtractionAgent.run({ bodySource, metadata, annotations, folders });

      console.log(`[pipeline]   manifest...`);
      await this.manifestAgent.run({
        task,
        metadata,
        folders,
        fetched: fetchResult,
        parsed: visionResult,
        extraction,
        review: flags,
        annotations,
        bodySource,
      });

      const reviewRequired = flags.reviewRequired;
      const folderPath = folders.documentFolderPath;

      await this.queueAgent.markComplete(task.id, { reviewRequired, folderPath });

      console.log(`[pipeline] Done: ${bodySource.extractionSource} confidence=${extraction.confidence?.overall?.toFixed(2)}`);
      return { taskId: task.id, folderPath, reviewRequired };
    } catch (error) {
      console.error(`[pipeline] ERROR:`, error.message);
      await this.queueAgent.markFailed(task.id, error);

      try {
        await this.manifestAgent.runError({ task, error, folders });
      } catch (manifestError) {
        console.error('manifestAgent.runError also failed:', manifestError.message);
      }

      throw error;
    }
  }

  async getJobStatus(jobId) {
    return this.queueAgent.getJobStatus(jobId);
  }

  async listTasks(jobId) {
    return this.queueAgent.listTasks(jobId);
  }
}
