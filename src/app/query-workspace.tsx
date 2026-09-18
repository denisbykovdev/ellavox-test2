"use client";

import { useState, type FormEvent } from "react";
import { formatParamLabel } from "@/lib/format";

type QuerySuccess = {
  status: "ok";
  question: string;
  template: string;
  params: Record<string, string | number>;
  explanation: string;
  rows: Record<string, unknown>[];
};

type QueryUnrecognized = {
  status: "question_not_recognized";
  message: string;
  template: null;
  examples: string[];
};

type QueryError = {
  status: "error";
  message: string;
};

type QueryResponse = QuerySuccess | QueryUnrecognized | QueryError;

export function QueryWorkspace() {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;

    setPending(true);
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await response.json()) as QueryResponse;
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Could not run that question." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-6">
        <h2 className="text-lg font-medium text-zinc-900">Question</h2>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="Ask a claims question, for example: How many members exceeded $20,000 in allowed in 2025?"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={pending || !question.trim()}
            className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Asking" : "Ask"}
          </button>
        </form>
      </section>

      <section className="min-h-64 rounded-xl border border-dashed border-zinc-300 bg-white p-6">
        <h2 className="text-lg font-medium text-zinc-900">Results</h2>
        <div className="mt-4">
          {pending ? (
            <p className="text-sm text-zinc-500">Loading</p>
          ) : (
            <QueryResult result={result} />
          )}
        </div>
      </section>
    </>
  );
}

function QueryResult({ result }: { result: QueryResponse | null }) {
  if (!result) {
    return (
      <p className="text-sm text-zinc-500">Ask a question to see a report.</p>
    );
  }

  if (result.status === "question_not_recognized") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-800">
          Could not parse that question. Please try again.
        </p>
        <p className="text-sm font-medium text-zinc-900">Try questions like:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
          {result.examples.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <p className="text-sm text-zinc-800">{result.message}</p>
    );
  }

  const columns = result.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-medium text-zinc-900">Question: </span>
          <span className="text-zinc-700">{result.question}</span>
        </p>
        <p>
          <span className="font-medium text-zinc-900">Period and filters: </span>
          <span className="text-zinc-700">
            {formatFilters(result.params)}
          </span>
        </p>
        <p>
          <span className="font-medium text-zinc-900">How it was calculated: </span>
          <span className="text-zinc-700">{result.explanation}</span>
        </p>
      </div>

      {result.rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No rows</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-3 py-2 font-medium text-zinc-900"
                  >
                    {formatParamLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-b border-zinc-100">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2 text-zinc-700">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatFilters(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([name, value]) => `${formatParamLabel(name)}: ${value}`)
    .join(" · ");
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}
