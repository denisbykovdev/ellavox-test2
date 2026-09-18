import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { excelFilePath } from "@/lib/ingest/excel-path";
import { streamExcelRows } from "@/lib/ingest/stream-xlsx-rows";
import {
  isFooterRow,
  mapExcelRowToClaim,
  type ClaimRow,
} from "@/lib/ingest/transform";

const BATCH_SIZE = 2000;

export type IngestResult = {
  status: "loaded" | "already_loaded";
  inserted: number;
  skipped: number;
  rowCount?: number;
};

export async function ingestClaims(): Promise<IngestResult> {
  const supabase = createServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from("claims")
    .select("*", { count: "exact", head: true });

  if (countError) {
    const detail = [countError.code, countError.message, countError.details, countError.hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(detail || "Failed to count claims");
  }

  if ((count ?? 0) > 0) {
    return {
      status: "already_loaded",
      inserted: 0,
      skipped: 0,
      rowCount: count ?? 0,
    };
  }

  let headers: string[] | null = null;
  let inserted = 0;
  let skipped = 0;
  let batch: ClaimRow[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase.from("claims").insert(batch);
    if (error) {
      throw new Error(error.message || error.code || JSON.stringify(error));
    }
    inserted += batch.length;
    batch = [];
  };

  for await (const cells of streamExcelRows(excelFilePath())) {
    if (!headers) {
      headers = cells.map((cell) => (cell == null ? "" : String(cell)));
      continue;
    }

    if (isFooterRow(cells)) {
      skipped += 1;
      continue;
    }

    const claim = mapExcelRowToClaim(headers, cells);
    if (!claim) {
      skipped += 1;
      continue;
    }

    batch.push(claim);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  return { status: "loaded", inserted, skipped };
}
