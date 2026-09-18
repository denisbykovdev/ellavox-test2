import { describe, expect, it } from "vitest";
import {
  excelSerialToDate,
  isFooterRow,
  mapExcelRowToClaim,
} from "./transform";

describe("excelSerialToDate", () => {
  it("converts serial 45546 to 2024-09-11", () => {
    expect(excelSerialToDate(45546)).toBe("2024-09-11");
  });

  it("converts serial 45551 to 2024-09-16", () => {
    expect(excelSerialToDate(45551)).toBe("2024-09-16");
  });

  it("uses the Excel epoch 1899-12-30", () => {
    expect(excelSerialToDate(0)).toBe("1899-12-30");
  });

  it("returns null for non-finite values", () => {
    expect(excelSerialToDate(Number.NaN)).toBeNull();
    expect(excelSerialToDate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("isFooterRow", () => {
  it("returns true when a text cell is xxxxx", () => {
    expect(isFooterRow(["BCBS of Texas", "xxxxx", 434])).toBe(true);
  });

  it("trims whitespace around xxxxx", () => {
    expect(isFooterRow(["  xxxxx  "])).toBe(true);
  });

  it("returns false for a normal data row", () => {
    expect(isFooterRow(["BCBS of Texas", 222060554618, 45546, 434])).toBe(
      false,
    );
  });
});

describe("mapExcelRowToClaim", () => {
  const headers = [
    "Carrier_b",
    "ClaimNumber_b",
    "IncurredDate_b",
    "Billed_b",
    "Allowed_b",
    "0",
  ];

  it("maps Excel headers to snake_case database fields", () => {
    const claim = mapExcelRowToClaim(headers, [
      "BCBS of Texas",
      222060554618,
      45546,
      "434",
      52.2,
      99,
    ]);

    expect(claim).toMatchObject({
      carrier: "BCBS of Texas",
      claim_number: "222060554618",
      incurred_date: "2024-09-11",
      billed: 434,
      allowed: 52.2,
    });
  });

  it("drops the junk header column 0", () => {
    const claim = mapExcelRowToClaim(headers, [
      "BCBS of Texas",
      222060554618,
      45546,
      434,
      52.2,
      99,
    ]);

    expect(claim).not.toBeNull();
    expect(claim).not.toHaveProperty("0");
    expect(Object.keys(claim ?? {})).not.toContain("0");
    expect(Object.values(claim ?? {})).not.toContain(99);
  });

  it("coerces money fields to numbers", () => {
    const claim = mapExcelRowToClaim(
      ["Billed_b", "Allowed_b", "Paid_b", "MemberPaid_b"],
      ["434", "52.2", 0, "67.28"],
    );

    expect(claim?.billed).toBe(434);
    expect(claim?.allowed).toBe(52.2);
    expect(claim?.paid).toBe(0);
    expect(claim?.member_paid).toBe(67.28);
    expect(typeof claim?.billed).toBe("number");
    expect(typeof claim?.allowed).toBe("number");
  });
});
