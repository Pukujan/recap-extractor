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

    try {
      const metadata = await this.metadataAgent.run(task);

      const folders = await this.caseFolderAgent.run({ task, metadata });

      const fetchResult = await this.fetchAgent.run({ task, metadata, folders });

      const triageResult = await this.textTriageAgent.run({ task, metadata, fetchResult });

      const visionResult = await this.documentVisionParserAgent.run({ task, triageResult, fetchResult });

      const flags = await this.reviewFlagAgent.run({ task, metadata, visionResult });

      const annotations = await this.legalAnnotationAgent.run({ task, metadata, visionResult });

      const extraction = await this.legalExtractionAgent.run({ task, metadata, annotations, visionResult });

      await this.manifestAgent.run({
        task,
        metadata,
        folders,
        fetched: fetchResult,
        parsed: visionResult,
        extraction,
        review: flags,
        annotations,
      });

      const reviewRequired = flags.reviewRequired;
      const folderPath = folders.documentFolderPath;

      await this.queueAgent.markComplete(task.id, { reviewRequired, folderPath });

      return { taskId: task.id, folderPath, reviewRequired };
    } catch (error) {
      await this.queueAgent.markFailed(task.id, error);

      await this.manifestAgent.runError({ task, error });

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
