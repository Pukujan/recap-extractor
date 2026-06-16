import { describe, expect, it } from "vitest";
import { JsonWriterService } from "../../services/jsonWriter.service.js";

describe("JsonWriterService", () => {
  it("writes pretty JSON", async () => {
    const fsMock = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    };

    const writer = new JsonWriterService({ fs: fsMock });

    await writer.writeJson("data/test/output.json", { a: 1 });

    expect(fsMock.mkdir).toHaveBeenCalledWith("data/test", { recursive: true });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      "data/test/output.json",
      JSON.stringify({ a: 1 }, null, 2),
      "utf8"
    );
  });
});
