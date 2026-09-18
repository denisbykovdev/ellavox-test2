import { NextResponse } from "next/server";
import { CLAIMS_SQL_TEMPLATES } from "@/lib/query/templates";
import { selectTemplateWithGemini } from "@/lib/query/gemini";
import { bindTemplateSql } from "@/lib/query/bind-sql";
import { executeReadonlyQuery } from "@/lib/query/run-select";
import { EXAMPLE_QUESTIONS } from "@/lib/query/examples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNRECOGNIZED = {
  status: "question_not_recognized" as const,
  message: "Could not parse that question. Please try again.",
  template: null,
  examples: EXAMPLE_QUESTIONS,
};

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
    const selection = await selectTemplateWithGemini(question, today);

    if (!("templates" in selection)) {
      return NextResponse.json(UNRECOGNIZED);
    }

    const template = CLAIMS_SQL_TEMPLATES.find(
      (item) => item.id === selection.templates,
    );
    if (!template) {
      return NextResponse.json(UNRECOGNIZED);
    }

    const sql = bindTemplateSql(
      template.sql,
      selection.params,
      template.parameters,
    );
    const rows = await executeReadonlyQuery(sql);

    return NextResponse.json({
      status: "ok",
      question,
      template: template.id,
      params: selection.params,
      explanation: selection.explanation,
      rows,
    });
  } catch (error) {
    console.error("query failed", error);
    return NextResponse.json(
      { status: "error", message: publicErrorMessage(error) },
      { status: 500 },
    );
  }
}

const MODEL_UNAVAILABLE =
  "The model is temporarily unavailable. Please try again.";

function publicErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Query failed";
  if (isModelUnavailable(error)) {
    return MODEL_UNAVAILABLE;
  }
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string };
    };
    if (parsed.error?.code === 503 || parsed.error?.code === 504) {
      return MODEL_UNAVAILABLE;
    }
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Keep the original message when it is not a Gemini JSON payload.
  }
  return raw;
}

function isModelUnavailable(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      if ("code" in current && current.code != null) {
        parts.push(String(current.code));
      }
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  const blob = parts.join(" ").toLowerCase();
  return (
    blob.includes("fetch failed") ||
    blob.includes("timeout") ||
    blob.includes("und_err_headers_timeout") ||
    blob.includes("unavailable") ||
    blob.includes("deadline_exceeded")
  );
}
