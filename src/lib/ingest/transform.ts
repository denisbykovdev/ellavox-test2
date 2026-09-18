export type ClaimRow = {
  carrier: string | null;
  group_name: string | null;
  claim_number: string | null;
  subscriber_id: string | null;
  member_id: string | null;
  member_custom_id: string | null;
  incurred_date: string | null;
  paid_date: string | null;
  billed: number | null;
  allowed: number | null;
  paid: number | null;
  member_paid: number | null;
  principal_dx_code: string | null;
  principal_dx_description: string | null;
  dx1_code: string | null;
  dx1_description: string | null;
  dx2_code: string | null;
  dx2_description: string | null;
  dx3_code: string | null;
  dx3_description: string | null;
  cpt_code: string | null;
  cpt_category: string | null;
  cpt_description: string | null;
  icd_procedure_code_1: string | null;
  icd_procedure_description_1: string | null;
  icd_procedure_code_2: string | null;
  icd_procedure_description_2: string | null;
  service_category: string | null;
  drg_code: string | null;
  drg_description: string | null;
  cob: number | null;
  coinsurance: number | null;
  copayment: number | null;
  covered: number | null;
  deductible: number | null;
  discount: number | null;
  not_covered: number | null;
  facility: string | null;
  benefit_package: string | null;
};

export const EXCEL_HEADER_TO_COLUMN: Record<string, keyof ClaimRow> = {
  Carrier_b: "carrier",
  GroupName_b: "group_name",
  ClaimNumber_b: "claim_number",
  SubscriberID_b: "subscriber_id",
  MemberID_b: "member_id",
  MEMBER_CUSTOM_ID_b: "member_custom_id",
  IncurredDate_b: "incurred_date",
  PaidDate_b: "paid_date",
  Billed_b: "billed",
  Allowed_b: "allowed",
  Paid_b: "paid",
  MemberPaid_b: "member_paid",
  "3digitPrincipalDiagnosisCode_b": "principal_dx_code",
  "3digitPrincipalDiagnosisDescription_b": "principal_dx_description",
  DX1CODE_b: "dx1_code",
  DX1_b: "dx1_description",
  DX2CODE_b: "dx2_code",
  DX2_b: "dx2_description",
  DX3CODE_b: "dx3_code",
  DX3_b: "dx3_description",
  CPTProcedureCode_b: "cpt_code",
  CPTProcedureCategory_b: "cpt_category",
  CPTProcedureDescription_b: "cpt_description",
  ICDProcedureCode1_b: "icd_procedure_code_1",
  ICDProcedureDescription1_b: "icd_procedure_description_1",
  ICDProcedureCode2_b: "icd_procedure_code_2",
  ICDProcedureDescription2_b: "icd_procedure_description_2",
  ServiceCategory_b: "service_category",
  DRGCode_b: "drg_code",
  DRGDescription_b: "drg_description",
  COB_b: "cob",
  Coinsurance_b: "coinsurance",
  Copayment_b: "copayment",
  Covered_b: "covered",
  Deductible_b: "deductible",
  Discount_b: "discount",
  NotCovered_b: "not_covered",
  Facility_b: "facility",
  BenefitPackage_b: "benefit_package",
};

const DATE_COLUMNS = new Set<keyof ClaimRow>(["incurred_date", "paid_date"]);

const NUMERIC_COLUMNS = new Set<keyof ClaimRow>([
  "billed",
  "allowed",
  "paid",
  "member_paid",
  "cob",
  "coinsurance",
  "copayment",
  "covered",
  "deductible",
  "discount",
  "not_covered",
]);

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const date = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * MS_PER_DAY);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function isFooterRow(cells: unknown[]): boolean {
  return cells.some(
    (cell) => typeof cell === "string" && cell.trim() === "xxxxx",
  );
}

export function mapExcelRowToClaim(
  headers: string[],
  cells: unknown[],
): ClaimRow | null {
  const row = emptyClaimRow();
  let hasValue = false;

  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    if (!header || header === "0") continue;

    const column = EXCEL_HEADER_TO_COLUMN[header];
    if (!column) continue;

    const raw = cells[i];
    if (raw === null || raw === undefined || raw === "") continue;

    hasValue = true;
    row[column] = coerceValue(column, raw) as never;
  }

  return hasValue ? row : null;
}

function emptyClaimRow(): ClaimRow {
  return {
    carrier: null,
    group_name: null,
    claim_number: null,
    subscriber_id: null,
    member_id: null,
    member_custom_id: null,
    incurred_date: null,
    paid_date: null,
    billed: null,
    allowed: null,
    paid: null,
    member_paid: null,
    principal_dx_code: null,
    principal_dx_description: null,
    dx1_code: null,
    dx1_description: null,
    dx2_code: null,
    dx2_description: null,
    dx3_code: null,
    dx3_description: null,
    cpt_code: null,
    cpt_category: null,
    cpt_description: null,
    icd_procedure_code_1: null,
    icd_procedure_description_1: null,
    icd_procedure_code_2: null,
    icd_procedure_description_2: null,
    service_category: null,
    drg_code: null,
    drg_description: null,
    cob: null,
    coinsurance: null,
    copayment: null,
    covered: null,
    deductible: null,
    discount: null,
    not_covered: null,
    facility: null,
    benefit_package: null,
  };
}

function coerceValue(column: keyof ClaimRow, raw: unknown): string | number | null {
  if (DATE_COLUMNS.has(column)) return toDateString(raw);
  if (NUMERIC_COLUMNS.has(column)) return toNumeric(raw);
  return toText(raw);
}

function toDateString(value: unknown): string | null {
  if (value instanceof Date) return excelSerialToDate(dateToExcelSerial(value));
  if (typeof value === "number") return excelSerialToDate(value);
  if (typeof value === "string" && value.trim() !== "") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return excelSerialToDate(asNumber);
  }
  return null;
}

function dateToExcelSerial(value: Date): number {
  return (Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) - EXCEL_EPOCH_UTC) / MS_PER_DAY;
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return String(value);
}
