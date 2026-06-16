import { createHash } from "crypto";
import fs from "fs/promises";

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return sha256Buffer(buffer);
}
