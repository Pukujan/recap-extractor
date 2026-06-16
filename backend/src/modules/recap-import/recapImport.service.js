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
    const job = await this.queueAgent.createJob(input);

    const searchResult = await this.recapSearchAgent.run({
      searchTerms: input.searchTerms,
      targetCount: input.targetCount,
      court: input.court,
      ocrMode: input.ocrMode,
    });

    await this.queueAgent.enqueueDocuments(job.id, searchResult.candidates);

    return { jobId: job.id };
  }

  async processNextDocument(jobId) {
    const task = await this.queueAgent.claimNext(jobId);
    if (!task) return null;

    let metadata = null;
    let folders = null;
    let fetchResult = null;
    let bodySource = null;

    try {
      metadata = await this.metadataAgent.run(task);

      folders = await this.caseFolderAgent.run({ task, metadata });
      if (!folders || !folders.documentFolderPath) {
        throw new Error(`caseFolderAgent returned invalid folders: ${JSON.stringify(folders)}`);
      }

      fetchResult = await this.fetchAgent.run({ task, metadata, folders });

      bodySource = await this.documentBodyProcessingService.run({
        courtListenerPlainText: metadata.plainText || '',
        pdfPath: fetchResult.pdfPath,
        metadataText: metadata.description || '',
        folders,
        fileStore: this.documentBodyProcessingService.fileStore,
      });

      const triageResult = await this.textTriageAgent.run({
        ...fetchResult,
        pageCount: metadata.pageCount || null,
        ocrStatus: metadata.ocrStatus || null,
      });

      const visionResult = await this.documentVisionParserAgent.run({ triage: triageResult, fetched: fetchResult, folders });

      const flags = await this.reviewFlagAgent.run({ parsed: visionResult, metadata, bodySource });

      const annotations = await this.legalAnnotationAgent.run({ parsed: visionResult, metadata, review: flags, folders });

      const extraction = await this.legalExtractionAgent.run({ bodySource, metadata, annotations, folders });

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

      return { taskId: task.id, folderPath, reviewRequired };
    } catch (error) {
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
