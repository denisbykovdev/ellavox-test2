import { describe, expect, it } from "vitest";
import {
  buildSelectPrompt,
  catalogForPrompt,
  normalizeGeminiSelection,
} from "./select-template";
import { CLAIMS_SQL_TEMPLATES } from "./templates";

describe("catalogForPrompt", () => {
  it("sends ids, descriptions, and params but not SQL", () => {
    const catalog = catalogForPrompt();
    expect(catalog).toHaveLength(CLAIMS_SQL_TEMPLATES.length);
    expect(JSON.stringify(catalog)).not.toContain("SELECT");
    expect(catalog[0]).toHaveProperty("id");
    expect(catalog[0]).toHaveProperty("description");
    expect(catalog[0]).toHaveProperty("parameters");
  });
});

describe("buildSelectPrompt", () => {
  it("includes today's date and the user question", () => {
    const prompt = buildSelectPrompt(
      "How many members exceeded $20K in the last 12 months?",
      "2026-09-18",
    );
    expect(prompt).toContain("2026-09-18");
    expect(prompt).toContain("How many members exceeded $20K");
    expect(prompt).toContain("members_over_allowed");
    expect(prompt).not.toMatch(/\bSELECT\b/);
  });
});

describe("normalizeGeminiSelection", () => {
  it("accepts a matching templates id and coerces params", () => {
    const result = normalizeGeminiSelection({
      templates: "members_over_allowed",
      params: {
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        threshold: "20000",
      },
      explanation: "Count members whose allowed total is over 20000 in 2025.",
    });

    expect(result).toEqual({
      templates: "members_over_allowed",
      params: {
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        threshold: 20000,
      },
      explanation: "Count members whose allowed total is over 20000 in 2025.",
    });
  });

  it("returns template null when none match", () => {
    expect(normalizeGeminiSelection({ template: null })).toEqual({
      template: null,
    });
  });

  it("returns template null for an unknown id", () => {
    expect(
      normalizeGeminiSelection({ templates: "not_a_template", params: {} }),
    ).toEqual({ template: null });
  });
});
