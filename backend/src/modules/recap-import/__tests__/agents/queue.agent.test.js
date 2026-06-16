import { describe, expect, it } from "vitest";
import { QueueAgent } from "../../agents/queue.agent.js";
import { createInMemoryQueueRepository } from "../testHelpers.js";

describe("QueueAgent", () => {
  it("creates tasks from candidates", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 2,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Complaint" },
      { recapDocumentId: "2", description: "Motion" },
    ]);

    const tasks = await queue.listTasks(job.id);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].sequenceNumber).toBe(1);
    expect(tasks[1].sequenceNumber).toBe(2);
    expect(tasks.every(t => t.status === "pending")).toBe(true);
  });

  it("processes only one document task at a time", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 3,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Doc 1" },
      { recapDocumentId: "2", description: "Doc 2" },
      { recapDocumentId: "3", description: "Doc 3" },
    ]);

    const running = await queue.claimNext(job.id);

    expect(running.recapDocumentId).toBe("1");

    const tasks = await queue.listTasks(job.id);
    expect(tasks.filter(t => t.status === "running")).toHaveLength(1);
    expect(tasks.filter(t => t.status === "pending")).toHaveLength(2);
  });

  it("does not claim a second task while one is running", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 2,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [
      { recapDocumentId: "1", description: "Doc 1" },
      { recapDocumentId: "2", description: "Doc 2" },
    ]);

    await queue.claimNext(job.id);
    const second = await queue.claimNext(job.id);

    expect(second).toBeNull();
  });

  it("marks complete or review_needed based on reviewRequired", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 1,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [{ recapDocumentId: "1", description: "Motion" }]);
    const task = await queue.claimNext(job.id);

    await queue.markComplete(task.id, {
      reviewRequired: true,
      folderPath: "data/recap-imports/case",
    });

    const updated = await queue.getTask(task.id);
    const status = await queue.getJobStatus(job.id);

    expect(updated.status).toBe("review_needed");
    expect(status.reviewNeeded).toBe(1);
  });

  it("marks failed with error message", async () => {
    const queue = new QueueAgent({
      repository: createInMemoryQueueRepository(),
      concurrency: 1,
    });

    const job = await queue.createJob({
      searchTerms: "motion",
      targetCount: 1,
      ocrMode: "recap_text_first",
    });

    await queue.enqueueDocuments(job.id, [{ recapDocumentId: "1", description: "Motion" }]);
    const task = await queue.claimNext(job.id);

    await queue.markFailed(task.id, new Error("boom"));

    const updated = await queue.getTask(task.id);
    expect(updated.status).toBe("failed");
    expect(updated.errorMessage).toMatch(/boom/);
  });
});
