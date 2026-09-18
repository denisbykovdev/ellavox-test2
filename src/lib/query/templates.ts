export type SqlParamType = "date" | "numeric" | "integer";

export type SqlParam = {
  name: string;
  type: SqlParamType;
  defaultValue: string | number;
};

export type SqlTemplate = {
  id: string;
  description: string;
  sql: string;
  parameters: SqlParam[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function coerceSqlParamValue(
  type: SqlParamType,
  value: unknown,
): string | number {
  switch (type) {
    case "date": {
      const text = String(value);
      if (!DATE_RE.test(text)) {
        throw new Error(`Expected date YYYY-MM-DD, got ${String(value)}`);
      }
      const [year, month, day] = text.split("-").map(Number);
      const utc = new Date(Date.UTC(year, month - 1, day));
      if (
        utc.getUTCFullYear() !== year ||
        utc.getUTCMonth() !== month - 1 ||
        utc.getUTCDate() !== day
      ) {
        throw new Error(`Invalid calendar date ${text}`);
      }
      return text;
    }
    case "integer": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n)) {
        throw new Error(`Expected integer, got ${String(value)}`);
      }
      return n;
    }
    case "numeric": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new Error(`Expected numeric, got ${String(value)}`);
      }
      return n;
    }
  }
}

export const CLAIMS_SQL_TEMPLATES: SqlTemplate[] = [
  {
    id: "members_over_allowed",
    description:
      "Count of members whose total allowed exceeded a threshold in a period",
    sql: `SELECT COUNT(*) AS member_count
FROM (
  SELECT member_id
  FROM claims
  WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
  GROUP BY member_id
  HAVING SUM(allowed) > CAST(:threshold AS numeric)
) high_cost_members`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
      { name: "threshold", type: "numeric", defaultValue: 20000 },
    ],
  },
  {
    id: "top_members_by_allowed",
    description:
      "Top N members by total allowed in a period (raw member ids are not returned)",
    sql: `SELECT
  ROW_NUMBER() OVER (ORDER BY SUM(allowed) DESC) AS member_rank,
  SUM(allowed) AS allowed_sum,
  COUNT(DISTINCT claim_number) AS claim_count
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
GROUP BY member_id
ORDER BY allowed_sum DESC
LIMIT CAST(:limit AS integer)`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
      { name: "limit", type: "integer", defaultValue: 20 },
    ],
  },
  {
    id: "monthly_allowed_vs_paid",
    description: "Monthly allowed vs plan paid for a calendar year",
    sql: `SELECT
  CAST(date_trunc('month', incurred_date) AS date) AS month,
  SUM(allowed) AS allowed_sum,
  SUM(paid) AS paid_sum
FROM claims
WHERE EXTRACT(YEAR FROM incurred_date) = CAST(:year AS integer)
GROUP BY CAST(date_trunc('month', incurred_date) AS date)
ORDER BY month`,
    parameters: [{ name: "year", type: "integer", defaultValue: 2025 }],
  },
  {
    id: "amounts_by_benefit_package",
    description: "Billed, allowed, and member paid totals by benefit package",
    sql: `SELECT
  benefit_package,
  SUM(billed) AS billed_sum,
  SUM(allowed) AS allowed_sum,
  SUM(member_paid) AS member_paid_sum
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
GROUP BY benefit_package
ORDER BY allowed_sum DESC`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
    ],
  },
  {
    id: "claims_and_rows_by_service_category",
    description:
      "Distinct claim count and row count by service category for a period",
    sql: `SELECT
  service_category,
  COUNT(DISTINCT claim_number) AS claim_count,
  COUNT(*) AS row_count
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
GROUP BY service_category
ORDER BY claim_count DESC`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
    ],
  },
  {
    id: "ytd_vs_prior_ytd_allowed",
    description: "Year-to-date allowed vs the same span in the prior year",
    sql: `SELECT
  SUM(allowed) FILTER (
    WHERE incurred_date >= CAST(date_trunc('year', CAST(:as_of_date AS date)) AS date)
      AND incurred_date <= CAST(:as_of_date AS date)
  ) AS ytd_allowed,
  SUM(allowed) FILTER (
    WHERE incurred_date >= CAST(date_trunc('year', CAST(:as_of_date AS date)) - INTERVAL '1 year' AS date)
      AND incurred_date <= CAST(CAST(:as_of_date AS date) - INTERVAL '1 year' AS date)
  ) AS prior_ytd_allowed
FROM claims`,
    parameters: [
      { name: "as_of_date", type: "date", defaultValue: "2025-12-31" },
    ],
  },
  {
    id: "high_cost_members_rolling_12m",
    description:
      "Members whose allowed exceeded a threshold in the rolling 12 months ending on as_of_date (raw member ids are not returned)",
    sql: `SELECT
  ROW_NUMBER() OVER (ORDER BY SUM(allowed) DESC) AS member_rank,
  SUM(allowed) AS allowed_sum,
  COUNT(DISTINCT claim_number) AS claim_count
FROM claims
WHERE incurred_date > CAST(:as_of_date AS date) - INTERVAL '12 months'
  AND incurred_date <= CAST(:as_of_date AS date)
GROUP BY member_id
HAVING SUM(allowed) > CAST(:threshold AS numeric)
ORDER BY allowed_sum DESC`,
    parameters: [
      { name: "as_of_date", type: "date", defaultValue: "2025-12-31" },
      { name: "threshold", type: "numeric", defaultValue: 20000 },
    ],
  },
  {
    id: "avg_allowed_per_claim_by_service_category",
    description: "Average allowed per distinct claim by service category",
    sql: `SELECT
  service_category,
  SUM(allowed) / NULLIF(COUNT(DISTINCT claim_number), 0) AS avg_allowed_per_claim,
  COUNT(DISTINCT claim_number) AS claim_count
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
GROUP BY service_category
ORDER BY avg_allowed_per_claim DESC NULLS LAST`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
    ],
  },
  {
    id: "top_diagnoses_by_allowed",
    description: "Top N 3-digit principal diagnoses by total allowed",
    sql: `SELECT
  principal_dx_code,
  MAX(principal_dx_description) AS principal_dx_description,
  SUM(allowed) AS allowed_sum,
  COUNT(DISTINCT claim_number) AS claim_count
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
  AND principal_dx_code IS NOT NULL
GROUP BY principal_dx_code
ORDER BY allowed_sum DESC
LIMIT CAST(:limit AS integer)`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
      { name: "limit", type: "integer", defaultValue: 20 },
    ],
  },
  {
    id: "member_paid_share_by_benefit_package",
    description: "Member paid as a share of allowed by benefit package",
    sql: `SELECT
  benefit_package,
  SUM(member_paid) AS member_paid_sum,
  SUM(allowed) AS allowed_sum,
  SUM(member_paid) / NULLIF(SUM(allowed), 0) AS member_paid_share
FROM claims
WHERE incurred_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
GROUP BY benefit_package
ORDER BY member_paid_share DESC NULLS LAST`,
    parameters: [
      { name: "start_date", type: "date", defaultValue: "2025-01-01" },
      { name: "end_date", type: "date", defaultValue: "2025-12-31" },
    ],
  },
];
