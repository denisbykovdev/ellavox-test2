import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIMS_SQL_TEMPLATES } from "@/lib/query/templates";
import { EXAMPLE_QUESTIONS } from "@/lib/query/examples";

const gemini = vi.hoisted(() => ({
  text: "",
  failWith: null as Error | null,
}));

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async () => {
        if (gemini.failWith) throw gemini.failWith;
        return { text: gemini.text };
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: supabase.from,
    rpc: supabase.rpc,
  }),
}));

describe("POST /api/query", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    gemini.text = "";
    gemini.failWith = null;
    supabase.from.mockClear();
    supabase.rpc.mockReset();
    supabase.rpc.mockResolvedValue({
      data: [{ member_count: 4 }],
      error: null,
    });
  });

  it("returns a parsed match and query rows for a valid Gemini template JSON", async () => {
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
    expect(body.status).toBe("ok");
    expect(body.template).toBe("members_over_allowed");
    expect(
      CLAIMS_SQL_TEMPLATES.some((template) => template.id === body.template),
    ).toBe(true);
    expect(body.params).toEqual({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      threshold: 20000,
    });
    expect(body.rows).toEqual([{ member_count: 4 }]);
    expect(body.question).toBe("How many members exceeded $20K in 2025?");
    expect(supabase.rpc).toHaveBeenCalledOnce();
    expect(supabase.rpc.mock.calls[0]?.[0]).toBe("execute_readonly_query");
    expect(String(supabase.rpc.mock.calls[0]?.[1]?.query)).toMatch(/^\s*SELECT/i);
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
      message: "Could not parse that question. Please try again.",
      template: null,
      examples: EXAMPLE_QUESTIONS,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("maps Gemini fetch timeouts to a public unavailable message", async () => {
    const timeout = new Error('HTTP/2: "headers timeout after 300000"');
    (timeout as Error & { code: string }).code = "UND_ERR_HEADERS_TIMEOUT";
    gemini.failWith = Object.assign(new TypeError("fetch failed"), {
      cause: timeout,
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

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      message: "The model is temporarily unavailable. Please try again.",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
