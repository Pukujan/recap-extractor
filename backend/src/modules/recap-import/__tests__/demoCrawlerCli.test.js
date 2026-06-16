import { describe, it, expect } from "vitest";
import { parseCrawlerCliArgs } from "../../../../../scripts/demo-crawl-courtlistener.js";

describe("demo crawler CLI", () => {
  it("defaults to motion to compel query when no args provided", () => {
    const args = parseCrawlerCliArgs([]);
    expect(args.query).toBe('motion to compel');
    expect(args.maxPages).toBe(20);
  });

  it("parses query and maxPages", () => {
    const args = parseCrawlerCliArgs([
      "--query=motion to compel",
      "--maxPages=5"
    ]);

    expect(args.query).toBe("motion to compel");
    expect(args.maxPages).toBe(5);
  });

  it("rejects maxPages above hard limit at CLI boundary", () => {
    expect(() =>
      parseCrawlerCliArgs([
        "--query=motion to compel",
        "--maxPages=100"
      ])
    ).toThrow(/hard limit/i);
  });

  it("parses direct public URL mode", () => {
    const args = parseCrawlerCliArgs([
      "--url=https://www.courtlistener.com/recap/",
      "--maxPages=3"
    ]);

    expect(args.url).toBe("https://www.courtlistener.com/recap/");
    expect(args.maxPages).toBe(3);
  });
});
