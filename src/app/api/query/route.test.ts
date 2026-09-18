import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIMS_SQL_TEMPLATES } from "@/lib/query/templates";

const gemini = vi.hoisted(() => ({
  text: "",
}));

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async () => ({ text: gemini.text }),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({ from: supabase.from }),
}));

describe("POST /api/query", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    gemini.text = "";
    supabase.from.mockClear();
  });

  it("returns a parsed match for a valid Gemini template JSON", async () => {
    gemini.text = JSON.stringify({
      template: "members_over_allowed",
      params: {
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        threshold: 20000,
      },
      explanation: "Count members whose allowed total exceeded 20000 in 2025.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "How many members exceeded $20K in 2025?",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.templates).toBe("members_over_allowed");
    expect(
      CLAIMS_SQL_TEMPLATES.some((template) => template.id === body.templates),
    ).toBe(true);
    expect(body.params).toEqual({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      threshold: 20000,
    });
    expect(body.explanation).toContain("allowed");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns question not recognized when Gemini picks no template", async () => {
    gemini.text = JSON.stringify({ template: null });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "What is the weather in Austin?",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "question_not_recognized",
      message: "Question not recognized",
      template: null,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
