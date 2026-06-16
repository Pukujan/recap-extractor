import { vi } from "vitest";

export function createInMemoryQueueRepository() {
  const jobs = new Map();
  const tasks = new Map();
  let jobIdCounter = 0;
  let taskIdCounter = 0;

  return {
    createJob: async (data) => {
      const jobId = `job_${++jobIdCounter}`;
      const job = {
        id: jobId,
        ...data,
        status: "pending",
        processedCount: 0,
        failedCount: 0,
        reviewNeededCount: 0,
        createdAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);
      return job;
    },
    getJob: async (id) => jobs.get(id) || null,
    getJobStatus: async (jobId) => {
      const allTasks = Array.from(tasks.values()).filter(t => t.jobId === jobId);
      return {
        jobId,
        queued: allTasks.length,
        processed: allTasks.filter(t => t.status === "complete" || t.status === "review_needed").length,
        reviewNeeded: allTasks.filter(t => t.status === "review_needed").length,
        failed: allTasks.filter(t => t.status === "failed").length,
      };
    },
    enqueueDocuments: async (jobId, candidates) => {
      const entries = candidates.map((c, i) => ({
        id: `task_${++taskIdCounter}`,
        jobId,
        sequenceNumber: i + 1,
        recapDocumentId: c.recapDocumentId,
        description: c.description,
        status: "pending",
      }));
      for (const t of entries) tasks.set(t.id, t);
    },
    listTasks: async (jobId) =>
      Array.from(tasks.values()).filter(t => t.jobId === jobId).sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    getTask: async (id) => tasks.get(id) || null,
    claimNext: async (jobId) => {
      const jobTasks = Array.from(tasks.values())
        .filter(t => t.jobId === jobId && t.status === "pending")
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      if (jobTasks.length === 0) return null;
      const task = jobTasks[0];
      task.status = "running";
      tasks.set(task.id, task);
      return task;
    },
    markComplete: async (taskId, { reviewRequired, folderPath }) => {
      const task = tasks.get(taskId);
      if (!task) return;
      task.status = reviewRequired ? "review_needed" : "complete";
      task.folderPath = folderPath;
      tasks.set(taskId, task);
    },
    markFailed: async (taskId, error) => {
      const task = tasks.get(taskId);
      if (!task) return;
      task.status = "failed";
      task.errorMessage = error.message;
      tasks.set(taskId, task);
    },
  };
}

export function createMockJsonWriter() {
  return {
    writeJson: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockFileStore({ existsSequence } = {}) {
  const sequence = existsSequence || [];
  let existsIndex = 0;
  return {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeText: vi.fn().mockResolvedValue(undefined),
    writeBuffer: vi.fn().mockResolvedValue(undefined),
    writeJson: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockImplementation(() => {
      if (sequence.length > 0) {
        return Promise.resolve(sequence[existsIndex++ % sequence.length]);
      }
      return Promise.resolve(false);
    }),
    pathJoin: (...parts) => parts.join("/"),
  };
}

export function createMockPdfToImageService() {
  return {
    convertPdfToPageImages: vi.fn().mockResolvedValue(["pages/page-001.png"]),
    imageToBase64: vi.fn().mockResolvedValue("base64-image"),
  };
}

export let _testAppRepo = null;

export function setTestAppRepo(repo) {
  _testAppRepo = repo;
}

export async function seedRecapJobWithCompletedFolder() {
  const repo = _testAppRepo;
  if (!repo) throw new Error("No test app repo available. Call setTestAppRepo first.");

  const job = await repo.createJob({
    searchTerms: "medical malpractice motion to compel",
    targetCount: 10,
    ocrMode: "recap_text_first",
  });

  await repo.enqueueDocuments(job.id, [
    { recapDocumentId: "1", description: "Complaint" },
  ]);

  const task = await repo.claimNext(job.id);

  await repo.markComplete(task.id, {
    reviewRequired: false,
    folderPath: "data/recap-imports/test-case__nysd__docket-12345/",
  });

  return job;
}

export function mockFolders() {
  return {
    caseFolderPath: "data/recap-imports/test-case__nysd__docket-12345/",
    documentFolderPath: "data/recap-imports/test-case__nysd__docket-12345/documents/doc-001-test-doc/",
  };
}
