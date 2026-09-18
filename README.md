# Ellavox Claims POC

## What this is

A localhost proof of concept for medical insurance claims reporting. You ask a question in plain English and get a table back — claim counts, allowed vs paid, high-cost members, diagnoses, and similar reports — over a real claims dataset.

**Stack:** Next.js (App Router, TypeScript, Tailwind) + local Supabase (Postgres) + Gemini to interpret the question.

The model does **not** write SQL. A fixed catalog of SELECT-only reporting templates already encodes the metrics (distinct claims vs rows, plan paid vs member paid, periods on `incurred_date`, no raw member ids). Gemini only picks a template and fills typed parameters (`date`, `numeric`, `integer`). The app then validates those values, binds them into the template, and runs the query through a read-only Postgres RPC. That split keeps answers predictable: the AI handles language, the templates handle math and safety.

The home page has three zones: data load status, the question form, and results (question text, period/filters, a short explanation, and the table).

## How to run locally

**Prerequisites:** Node.js 20+, Docker Desktop running, [Supabase CLI](https://supabase.com/docs/guides/cli).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Put `Data_For_AI.xlsx` in the project root (the file is gitignored).

3. Start local Supabase. This boots Postgres and applies migrations under `supabase/migrations/`:

   ```bash
   supabase start
   ```

   If Supabase is already running and you need to apply new migrations:

   ```bash
   supabase migration up --local
   ```

   Useful URLs from `supabase status`: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`.

4. Create `.env.local` (gitignored). Copy the local keys from `supabase status`. Never put `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` in client code.

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
   GEMINI_API_KEY=<your Gemini API key>
   ```

   The anon key is safe for the browser (RLS still applies). The service role key is full database access and is used only on the server (ingest and the read-only query RPC). `GEMINI_API_KEY` is server-only.

5. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The home page calls `GET /api/ingest` once on load. Ask a question in the form.

   Optional checks: `GET /api/health` should return `{ "status": "ok" }`. `npm test` runs the Vitest suite.

## How data is loaded

Place `Data_For_AI.xlsx` in the project root. The homepage triggers `GET /api/ingest`, which streams that file into the `claims` table. The load is **idempotent**: if `claims` already has rows, the route returns `already_loaded` and does not insert again. Writes use the **service role**; the browser never talks to the database for ingest.

Streaming matters because the workbook is large (~70MB, hundreds of thousands of rows). `exceljs` `WorkbookReader` yields rows without loading the whole sheet into memory. Inserts go in batches of 2,000.

### Excel → TypeScript → Postgres

Each Excel line is one `claims` row. That is **not** the same as one claim: several rows can share a `claim_number`. Reporting templates count claims with `COUNT(DISTINCT claim_number)` and members with `COUNT(DISTINCT member_id)`. Money is summed at the row level. **Paid means plan paid** (`paid`), not `member_paid`.

On ingest:

- Skip the leftover Excel header column named `"0"`.
- Skip the footer row that contains the value `xxxxx`.
- Map Excel headers (`Carrier_b`, `IncurredDate_b`, …) to `snake_case` columns via `EXCEL_HEADER_TO_COLUMN` in `src/lib/ingest/transform.ts`.
- Dates in the file are **Excel serials** (epoch `1899-12-30`), not ISO strings. They become `YYYY-MM-DD` and land in Postgres as `date` (`incurred_date`, `paid_date`).
- Money and similar amounts become JS numbers, then Postgres `numeric` (`billed`, `allowed`, `paid`, `member_paid`, cob / coinsurance / copay / etc.).
- IDs, codes, and labels stay `text` (`claim_number`, `member_id`, diagnosis and CPT fields, `benefit_package`, …).

Postgres indexes sit on `incurred_date`, `member_id`, and `claim_number`. RLS is on; `SELECT` is open to `anon` for this POC. Inserts stay closed except through `service_role`.

## Example questions

The catalog covers the reporting cases this POC was built for. Gemini chooses among them; unmatched questions do not run SQL. Try:

- How many members exceeded $20,000 in allowed in 2025?
- Who are the top 20 members by allowed amount in 2025?
- Show a monthly summary of allowed vs paid for 2025
- Show billed, allowed, and member paid by benefit package for 2025
- How many distinct claims and rows are there by service category in 2025?
- Compare year-to-date allowed vs prior year-to-date
- Which members exceeded $20,000 allowed in the last 12 months?
- What is the average allowed per claim by service category in 2025?
- What are the top 20 three-digit diagnoses by allowed in 2025?
- What share of allowed is member paid by benefit package in 2025?

Letting the model invent SQL would be flexible and unsafe (wrong metrics, PII leakage, writes). Hard-coding keyword rules would be safe and brittle (every new phrasing breaks). **Template selection is the middle path:** the AI maps language onto a reviewed query; the database only ever runs that SELECT with validated parameters. That is the most predictable of the three.

If the question does not match a template, the UI says *Could not parse that question. Please try again.* and lists the examples above.

## What was left out on purpose (4-hour timebox)

Two features look small on a homepage and are not.

**Excel upload in the UI.** A real drop zone needs file validation, progress, error states, and Playwright coverage for the browser path. That is a vertical of its own. The POC uses a server `GET /api/ingest` that already streams a known file from disk. Extending that route to accept an uploaded workbook is a small change; building the UI and E2E around it is not.

**Export results to Excel.** This is not a front-end download button. It needs a server route that maps query rows onto sheet structure, generates a real `.xlsx`, streams it for download, plus unit tests for the mapping and mocked tests for the route. That whole slice was skipped so the timebox could cover ingest, templates, NL → SQL, and the results table.

## What I would do next

- **Upload Excel** from the Data Upload zone, wired into the existing ingest pipeline.
- **Export Excel** for the current result set (server-generated workbook, tested mapping).
- **More templates and metrics** as new reporting questions show up, still SELECT-only and still without raw member ids.
