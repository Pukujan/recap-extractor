import { describe, expect, it } from "vitest";
import { sha256Buffer } from "../../services/hash.service.js";

describe("hash.service", () => {
  it("returns stable sha256 hash for buffer", () => {
    const hash1 = sha256Buffer(Buffer.from("hello"));
    const hash2 = sha256Buffer(Buffer.from("hello"));

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
