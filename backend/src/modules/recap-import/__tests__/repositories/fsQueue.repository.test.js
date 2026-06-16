import { describe, expect, it } from 'vitest';
import { FsQueueRepository } from '../../repositories/fsQueue.repository.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'queue-test-'));
  return { repo: new FsQueueRepository({ queueDir: dir }), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('FsQueueRepository', () => {
  it('creates and retrieves a job', async () => {
    const { repo, cleanup } = createTempRepo();
    try {
      const job = await repo.createJob({ searchTerms: 'motion', targetCount: 5 });
      expect(job.id).toBeDefined();
      expect(job.searchTerms).toBe('motion');
      expect(job.status).toBe('pending');

      const got = await repo.getJob(job.id);
      expect(got.id).toBe(job.id);
    } finally {
      cleanup();
    }
  });

  it('enqueues and claims tasks', async () => {
    const { repo, cleanup } = createTempRepo();
    try {
      const job = await repo.createJob({ searchTerms: 'motion', targetCount: 2 });
      const candidates = [
        { recapDocumentId: '1', description: 'Doc 1', caseName: 'A v B', docketId: '10' },
        { recapDocumentId: '2', description: 'Doc 2', caseName: 'C v D', docketId: '20' },
      ];
      await repo.enqueueDocuments(job.id, candidates);

      const task = await repo.claimNext(job.id);
      expect(task).not.toBeNull();
      expect(task.recapDocumentId).toBe('1');
      expect(task.status).toBe('running');

      const tasks = await repo.listTasks(job.id);
      expect(tasks).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('marks task complete and failed', async () => {
    const { repo, cleanup } = createTempRepo();
    try {
      const job = await repo.createJob({ searchTerms: 'test', targetCount: 1 });
      await repo.enqueueDocuments(job.id, [{ recapDocumentId: '1', description: 'Test' }]);
      const task = await repo.claimNext(job.id);

      await repo.markComplete(task.id, { reviewRequired: true, folderPath: 'data/output/' });
      const updated = await repo.getTask(task.id);
      expect(updated.status).toBe('review_needed');
      expect(updated.folderPath).toBe('data/output/');

      const job2 = await repo.createJob({ searchTerms: 'fail', targetCount: 1 });
      await repo.enqueueDocuments(job2.id, [{ recapDocumentId: '2', description: 'Fail doc' }]);
      const task2 = await repo.claimNext(job2.id);
      await repo.markFailed(task2.id, new Error('something broke'));
      const failed = await repo.getTask(task2.id);
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('something broke');
    } finally {
      cleanup();
    }
  });
});
