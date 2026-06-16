import { describe, expect, it } from "vitest";
import { slugifyForPath } from "../../services/slug.service.js";

describe("slug.service", () => {
  it("converts unsafe case names into safe slugs", () => {
    expect(
      slugifyForPath("Smith / Jones v. New York-Presbyterian Hospital, Inc.")
    ).toBe("smith-jones-v-new-york-presbyterian-hospital-inc");
  });

  it("collapses repeated hyphens", () => {
    expect(slugifyForPath("Smith --- v. --- Hospital")).toBe("smith-v-hospital");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugifyForPath("/// Smith v Hospital ///")).toBe("smith-v-hospital");
  });

  it("truncates very long names", () => {
    const slug = slugifyForPath("A".repeat(300), { maxLength: 80 });
    expect(slug.length).toBeLessThanOrEqual(80);
  });
});
