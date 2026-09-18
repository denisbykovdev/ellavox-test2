"use client";

import { useEffect, useState } from "react";
import { formatDisplayLabel } from "@/lib/format";

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

        if (data.status === "already_loaded") return "Already loaded";
        if (data.status === "loaded") {
          const count = data.inserted ?? 0;
          return `Loaded ${count.toLocaleString("en-US")} rows`;
        }
        if (data.message) return formatDisplayLabel(data.message);
        return "Error";
      })
      .catch(() => "Error");
  }

  return ingestRequest;
}

export function IngestStatus() {
  const [status, setStatus] = useState("Loading");

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
