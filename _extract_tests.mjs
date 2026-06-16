import fs from "fs";
import path from "path";

const md = fs.readFileSync("projectplan/update.md", "utf-8");
const regex = /## `([^`]+)`\n\n```js\n([\s\S]*?)```/g;

const base = "backend/src/modules/recap-import/__tests__";
let match;

while ((match = regex.exec(md)) !== null) {
  const relPath = match[1].replace("backend/src/modules/recap-import/__tests__/", "");
  const absPath = path.join(base, relPath);
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath, match[2].trim() + "\n");
  console.log("Wrote:", absPath);
}

console.log("Done extracting tests.");
