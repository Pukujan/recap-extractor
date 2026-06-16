export class RecapImportController {
  constructor({ recapImportService, config }) {
    this.recapImportService = recapImportService;
    this.config = config;
  }

  async createJob(req, res) {
    try {
      const env = this.config || process.env;

      if (!env.COURTLISTENER_API_TOKEN) {
        return res.status(400).json({ error: "COURTLISTENER_API_TOKEN is required" });
      }
      if (!env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: "OPENROUTER_API_KEY is required" });
      }

      const { searchTerms, court, ocrMode } = req.body;
      let { targetCount } = req.body;

      if (!searchTerms) {
        return res.status(400).json({ error: "searchTerms is required" });
      }

      if (targetCount === undefined || targetCount === null) {
        targetCount = 10;
      }

      targetCount = Number(targetCount);

      if (!Number.isFinite(targetCount) || targetCount < 1) {
        return res.status(400).json({ error: "targetCount must be at least 1" });
      }
      if (targetCount > 100) {
        return res.status(400).json({ error: "targetCount must not exceed 100" });
      }

      const result = await this.recapImportService.createJob({
        searchTerms,
        court,
        targetCount,
        ocrMode: ocrMode || "recap_text_first",
      });

      return res.status(201).json({
        jobId: result.jobId,
        targetCount,
        queueConcurrency: 1,
      });
    } catch (error) {
      console.error('createJob error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const status = await this.recapImportService.getJobStatus(jobId);
      const tasks = await this.recapImportService.listTasks(jobId);

      const internalFiles = ["source.pdf", "parsed.md", "extracted_legal.json", "prompt_eval_versions.json", "layout_boxes.json", "review_flags.json"];

      const caseFolders = tasks
        .filter((t) => t.folderPath)
        .map((t) => {
          const clean = { folderPath: t.folderPath };
          internalFiles.forEach((file) => {
            delete clean[file];
          });
          return clean;
        });

      return res.json({ ...status, caseFolders });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async processNext(req, res) {
    try {
      const { jobId } = req.params;
      const result = await this.recapImportService.processNextDocument(jobId);
      return res.json(result);
    } catch (error) {
      console.error('processNext error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
