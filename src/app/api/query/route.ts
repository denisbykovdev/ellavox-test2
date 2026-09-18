import { NextResponse } from "next/server";
import { selectTemplateWithGemini } from "@/lib/query/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: unknown };
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = await selectTemplateWithGemini(question, today);
    return NextResponse.json(result);
  } catch (error) {
    console.error("query failed", error);
    const message =
      error instanceof Error ? error.message : "Query selection failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
