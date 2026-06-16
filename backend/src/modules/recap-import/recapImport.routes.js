import { Router } from "express";

export function createRecapImportRouter(controller) {
  const router = Router();

  router.post("/jobs", (req, res) => controller.createJob(req, res));
  router.get("/jobs/:jobId", (req, res) => controller.getJobStatus(req, res));
  router.post("/jobs/:jobId/process", (req, res) => controller.processNext(req, res));

  return router;
}
