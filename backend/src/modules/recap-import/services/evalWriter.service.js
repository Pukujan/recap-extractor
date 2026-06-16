import path from "path";

export class EvalWriter {
  constructor(fileStore) {
    this.fileStore = fileStore;
  }

  async writeEvalManifest(folderPath, data) {
    const filePath = path.join(folderPath, "prompt_eval_versions.json");
    await this.fileStore.writeJson(filePath, data);
  }
}
