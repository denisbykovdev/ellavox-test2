import { describe, expect, it } from "vitest";
import { CLAIMS_SQL_TEMPLATES } from "./templates";
import { assertSelectOnly, bindTemplateSql } from "./bind-sql";

describe("assertSelectOnly", () => {
  it("allows a SELECT", () => {
    expect(() => assertSelectOnly("SELECT 1")).not.toThrow();
  });

  it("rejects writes", () => {
    expect(() => assertSelectOnly("INSERT INTO claims VALUES (1)")).toThrow(
      /SELECT/,
    );
    expect(() => assertSelectOnly("DELETE FROM claims")).toThrow(/SELECT/);
  });
});

describe("bindTemplateSql", () => {
  const template = CLAIMS_SQL_TEMPLATES.find(
    (item) => item.id === "members_over_allowed",
  )!;

  it("substitutes typed params into a SELECT", () => {
    const sql = bindTemplateSql(
      template.sql,
      {
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        threshold: 20000,
      },
      template.parameters,
    );

    expect(sql).toContain("CAST('2025-01-01' AS date)");
    expect(sql).toContain("CAST(20000 AS numeric)");
    expect(sql).not.toMatch(/:start_date|:end_date|:threshold/);
    expect(sql.trim().startsWith("SELECT")).toBe(true);
  });
});
