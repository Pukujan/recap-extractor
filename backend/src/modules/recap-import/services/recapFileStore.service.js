import fs from "fs/promises";
import path from "path";

export class RecapFileStore {
  pathJoin(...parts) {
    return parts.join("/");
  }

  async ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeText(filePath, content) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
  }

  async writeBuffer(filePath, buffer) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);
  }

  async writeJson(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async readText(filePath) {
    return fs.readFile(filePath, "utf8");
  }

  async readJson(filePath) {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(src, dest) {
    await this.ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
  }
}
