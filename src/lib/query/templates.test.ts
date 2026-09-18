import { describe, expect, it } from "vitest";
import { coerceSqlParamValue } from "./templates";

describe("coerceSqlParamValue", () => {
  it("keeps YYYY-MM-DD dates as strings", () => {
    expect(coerceSqlParamValue("date", "2025-12-31")).toBe("2025-12-31");
  });

  it("parses integers for year and limit", () => {
    expect(coerceSqlParamValue("integer", "20")).toBe(20);
    expect(coerceSqlParamValue("integer", 2025)).toBe(2025);
  });

  it("parses numeric money thresholds including decimals", () => {
    expect(coerceSqlParamValue("numeric", "20000.5")).toBe(20000.5);
  });

  it("rejects a decimal when the type is integer", () => {
    expect(() => coerceSqlParamValue("integer", 20.5)).toThrow(/integer/);
  });
});
