import { describe, expect, it } from "vitest";
import { CaseFolderAgent } from "../../agents/caseFolder.agent.js";
import { createMockFileStore } from "../testHelpers.js";

describe("CaseFolderAgent", () => {
  it("creates safe case and document folder paths", async () => {
    const fileStore = createMockFileStore();
    const agent = new CaseFolderAgent({
      outputRoot: "data/recap-imports",
      fileStore,
    });

    const result = await agent.run({
      metadata: {
        caseName: "Smith / Jones v. New York-Presbyterian Hospital, Inc.",
        courtId: "nysd",
        docketId: "12345",
        description: "Motion to Compel / Sanctions",
      },
      task: {
        sequenceNumber: 1,
      },
    });

    expect(result.caseFolderPath).toBe(
      "data/recap-imports/smith-jones-v-new-york-presbyterian-hospital-inc__nysd__docket-12345/"
    );
    expect(result.documentFolderPath).toBe(
      "data/recap-imports/smith-jones-v-new-york-presbyterian-hospital-inc__nysd__docket-12345/documents/doc-001-motion-to-compel-sanctions/"
    );
    expect(fileStore.ensureDir).toHaveBeenCalledWith(result.caseFolderPath);
    expect(fileStore.ensureDir).toHaveBeenCalledWith(result.documentFolderPath);
  });

  it("dedupes folder name collisions", async () => {
    const fileStore = createMockFileStore({
      existsSequence: [true, false],
    });

    const agent = new CaseFolderAgent({
      outputRoot: "data/recap-imports",
      fileStore,
    });

    const result = await agent.run({
      metadata: {
        caseName: "Smith v Hospital",
        courtId: "nysd",
        docketId: "12345",
        description: "Complaint",
      },
      task: {
        sequenceNumber: 1,
      },
    });

    expect(result.caseFolderPath).toContain("__2");
  });
});
