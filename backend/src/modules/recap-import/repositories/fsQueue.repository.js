import fs from 'fs/promises';
import path from 'path';

export class FsQueueRepository {
  constructor({ queueDir }) {
    this.jobsDir = path.join(queueDir, 'jobs');
    this.tasksDir = path.join(queueDir, 'tasks');
    this.jobIdCounter = 0;
    this.taskIdCounter = 0;
  }

  async _init() {
    await fs.mkdir(this.jobsDir, { recursive: true });
    await fs.mkdir(this.tasksDir, { recursive: true });
    const jobFiles = await fs.readdir(this.jobsDir).catch(() => []);
    this.jobIdCounter = jobFiles.length;
    const taskFiles = await fs.readdir(this.tasksDir).catch(() => []);
    this.taskIdCounter = taskFiles.length;
  }

  async _readJson(dir, id) {
    try {
      const content = await fs.readFile(path.join(dir, `${id}.json`), 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async _writeJson(dir, id, data) {
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2), 'utf8');
  }

  async _deleteJson(dir, id) {
    await fs.rm(path.join(dir, `${id}.json`)).catch(() => {});
  }

  async createJob(data) {
    await this._init();
    const jobId = `job_${++this.jobIdCounter}`;
    const job = {
      id: jobId,
      ...data,
      status: 'pending',
      processedCount: 0,
      failedCount: 0,
      reviewNeededCount: 0,
      createdAt: new Date().toISOString(),
    };
    await this._writeJson(this.jobsDir, jobId, job);
    return job;
  }

  async getJob(id) {
    return this._readJson(this.jobsDir, id);
  }

  async getJobStatus(jobId) {
    const allTasks = await this._listTasksForJob(jobId);
    return {
      jobId,
      queued: allTasks.length,
      processed: allTasks.filter(t => t.status === 'complete' || t.status === 'review_needed').length,
      reviewNeeded: allTasks.filter(t => t.status === 'review_needed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
    };
  }

  async enqueueDocuments(jobId, candidates) {
    await this._init();
    const entries = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const id = `task_${++this.taskIdCounter}`;
      const task = {
        id,
        jobId,
        sequenceNumber: i + 1,
        ...c,
        status: 'pending',
      };
      await this._writeJson(this.tasksDir, id, task);
      entries.push(task);
    }
    return entries;
  }

  async listTasks(jobId) {
    const tasks = await this._listTasksForJob(jobId);
    return tasks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async _listTasksForJob(jobId) {
    const files = await fs.readdir(this.tasksDir).catch(() => []);
    const tasks = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const task = await this._readJson(this.tasksDir, file.replace('.json', ''));
      if (task && task.jobId === jobId) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  async getTask(id) {
    return this._readJson(this.tasksDir, id);
  }

  async claimNext(jobId) {
    const tasks = await this._listTasksForJob(jobId);
    const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (pending.length === 0) return null;
    const task = pending[0];
    task.status = 'running';
    await this._writeJson(this.tasksDir, task.id, task);
    return task;
  }

  async markComplete(taskId, { reviewRequired, folderPath }) {
    const task = await this.getTask(taskId);
    if (!task) return;
    task.status = reviewRequired ? 'review_needed' : 'complete';
    task.folderPath = folderPath;
    await this._writeJson(this.tasksDir, taskId, task);
  }

  async markFailed(taskId, error) {
    const task = await this.getTask(taskId);
    if (!task) return;
    task.status = 'failed';
    task.errorMessage = error.message;
    await this._writeJson(this.tasksDir, taskId, task);
  }
}
