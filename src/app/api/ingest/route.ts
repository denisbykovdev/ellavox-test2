import { NextResponse } from "next/server";
import { ingestClaims, type IngestResult } from "@/lib/ingest/load-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

let inFlight: Promise<IngestResult> | null = null;

export async function GET() {
  try {
    if (!inFlight) {
      inFlight = ingestClaims().finally(() => {
        inFlight = null;
      });
    }

    const result = await inFlight;
    return NextResponse.json(result);
  } catch (error) {
    console.error("ingest failed", error);
    const message =
      error instanceof Error
        ? error.message || error.stack || "Ingest failed"
        : String(error);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
