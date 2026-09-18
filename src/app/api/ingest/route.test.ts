import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const fixture = vi.hoisted(() => ({ path: "" }));

const supabase = vi.hoisted(() => {
  const inserted: Record<string, unknown>[] = [];
  let count = 0;
  let insertCalls = 0;

  return {
    inserted,
    get count() {
      return count;
    },
    get insertCalls() {
      return insertCalls;
    },
    client: {
      from() {
        return {
          select: async () => ({ count, error: null }),
          insert: async (batch: Record<string, unknown>[]) => {
            insertCalls += 1;
            inserted.push(...batch);
            count += batch.length;
            return { error: null };
          },
        };
      },
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => supabase.client,
}));

vi.mock("@/lib/ingest/excel-path", () => ({
  excelFilePath: () => fixture.path,
}));

async function writeFixtureXlsx(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow([
    "Carrier_b",
    "ClaimNumber_b",
    "IncurredDate_b",
    "Billed_b",
    "Allowed_b",
    "0",
  ]);
  sheet.addRow(["BCBS of Texas", 222060554618, 45546, "434", 52.2, 99]);
  sheet.addRow(["BCBS of Texas", 225760440462, 45609, 45, 21.21, 0]);
  sheet.addRow(["xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx"]);
  await workbook.xlsx.writeFile(filePath);
}

describe("GET /api/ingest", () => {
  beforeAll(async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "claims-ingest-"));
    fixture.path = path.join(dir, "claims-sample.xlsx");
    await writeFixtureXlsx(fixture.path);
  });

  it("inserts data rows, skips the xxxxx footer, and stays idempotent", async () => {
    const { GET } = await import("./route");

    const first = await GET();
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody).toEqual({
      status: "loaded",
      inserted: 2,
      skipped: 1,
    });
    expect(supabase.inserted).toHaveLength(2);
    expect(supabase.inserted[0]).toMatchObject({
      carrier: "BCBS of Texas",
      claim_number: "222060554618",
      incurred_date: "2024-09-11",
      billed: 434,
      allowed: 52.2,
    });
    expect(supabase.inserted[0]).not.toHaveProperty("0");
    expect(typeof supabase.inserted[0]?.billed).toBe("number");

    const insertCallsAfterLoad = supabase.insertCalls;

    const second = await GET();
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody).toEqual({
      status: "already_loaded",
      inserted: 0,
      skipped: 0,
      rowCount: 2,
    });
    expect(supabase.inserted).toHaveLength(2);
    expect(supabase.insertCalls).toBe(insertCallsAfterLoad);
  });
});
