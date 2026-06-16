const PROMPT_VERSION = "1.0.0";
const SCHEMA_VERSION = "1.0.0";
const EVAL_VERSION = "1.0.0";

export class ManifestAgent {
  constructor({ writer }) {
    this.writer = writer;
  }

  async run(input) {
    const { task, metadata, folders, fetched, parsed, extraction, review } = input;

    const manifest = {
      jobId: task.jobId,
      taskId: task.id,
      status: "complete",
      source: {
        provider: metadata.source || "courtlistener",
        recapDocumentId: metadata.recapDocumentId || null,
        docketId: metadata.docketId || null,
        docketEntryId: metadata.docketEntryId || null,
        documentNumber: metadata.documentNumber || null,
      },
      folders: {
        caseFolderPath: folders.caseFolderPath,
        documentFolderPath: folders.documentFolderPath,
      },
      hashes: fetched?.hashes || {},
      versions: {
        visionModel: parsed?.model || null,
        legalExtractionModel: extraction?.model || null,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        evalVersion: EVAL_VERSION,
      },
      review: {
        reviewRequired: review?.reviewRequired ?? false,
        flagCount: review?.flags?.length || 0,
      },
      timestamps: {
        completedAt: new Date().toISOString(),
      },
    };

    const manifestPath = `${folders.documentFolderPath}manifest/document_manifest.json`;
    await this.writer.writeJson(manifestPath, manifest);

    const promptVersionsPath = `${folders.documentFolderPath}manifest/prompt_eval_versions.json`;
    await this.writer.writeJson(promptVersionsPath, {
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      evalVersion: EVAL_VERSION,
    });

    return manifest;
  }

  async runError({ task, error, folders }) {
    const docPath = folders ? `${folders.documentFolderPath}` : null;

    const manifest = {
      jobId: task.jobId,
      taskId: task.id,
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack || null,
      },
      folders: docPath ? { documentFolderPath: docPath } : null,
      versions: {
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        evalVersion: EVAL_VERSION,
      },
      timestamps: {
        failedAt: new Date().toISOString(),
      },
    };

    if (docPath) {
      const manifestPath = `${docPath}manifest/document_manifest.json`;
      await this.writer.writeJson(manifestPath, manifest);

      const promptVersionsPath = `${docPath}manifest/prompt_eval_versions.json`;
      await this.writer.writeJson(promptVersionsPath, {
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        evalVersion: EVAL_VERSION,
      });
    }

    return manifest;
  }
}
