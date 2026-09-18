import { IngestStatus } from "./ingest-status";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Claims Query
        </h1>

        <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-6">
          <h2 className="text-lg font-medium text-zinc-900">Data Upload</h2>
          <IngestStatus />
        </section>

        <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-6">
          <h2 className="text-lg font-medium text-zinc-900">Question</h2>
        </section>

        <section className="min-h-64 rounded-xl border border-dashed border-zinc-300 bg-white p-6">
          <h2 className="text-lg font-medium text-zinc-900">Results</h2>
        </section>
      </div>
    </main>
  );
}
