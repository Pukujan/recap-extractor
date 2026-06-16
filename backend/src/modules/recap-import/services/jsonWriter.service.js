import path from "path";

export class JsonWriterService {
  constructor({ fs }) {
    this.fs = fs;
  }

  async writeJson(filePath, data) {
    await this.fs.mkdir(path.dirname(filePath), { recursive: true });
    await this.fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async writeJsonToFolder(folderPath, fileName, data) {
    const filePath = path.join(folderPath, fileName);
    await this.writeJson(filePath, data);
  }
}
