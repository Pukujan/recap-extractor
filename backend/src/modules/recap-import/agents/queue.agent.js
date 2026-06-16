export class QueueAgent {
  constructor({ repository, concurrency = 1 }) {
    this.repository = repository;
    this.concurrency = concurrency;
  }

  async createJob(input) {
    return this.repository.createJob(input);
  }

  async enqueueDocuments(jobId, candidates) {
    return this.repository.enqueueDocuments(jobId, candidates);
  }

  async listTasks(jobId) {
    return this.repository.listTasks(jobId);
  }

  async claimNext(jobId) {
    const tasks = await this.repository.listTasks(jobId);
    const runningCount = tasks.filter(t => t.status === 'running').length;
    if (runningCount >= this.concurrency) return null;
    return this.repository.claimNext(jobId);
  }

  async markComplete(taskId, { reviewRequired, folderPath }) {
    return this.repository.markComplete(taskId, { reviewRequired, folderPath });
  }

  async markFailed(taskId, error) {
    return this.repository.markFailed(taskId, error);
  }

  async getTask(taskId) {
    return this.repository.getTask(taskId);
  }

  async getJobStatus(jobId) {
    return this.repository.getJobStatus(jobId);
  }
}
