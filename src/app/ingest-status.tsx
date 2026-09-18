"use client";

import { useEffect, useState } from "react";

let ingestRequest: Promise<string> | null = null;

function loadIngestStatus(): Promise<string> {
  if (!ingestRequest) {
    ingestRequest = fetch("/api/ingest")
      .then(async (response) => {
        const data = (await response.json()) as {
          status?: string;
          inserted?: number;
          message?: string;
        };

        if (data.status === "already_loaded") return "already_loaded";
        if (data.status === "loaded") return `loaded ${data.inserted ?? 0} rows`;
        return data.message ?? "error";
      })
      .catch(() => "error");
  }

  return ingestRequest;
}

export function IngestStatus() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    loadIngestStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="mt-2 text-sm text-zinc-500">{status}</p>;
}
