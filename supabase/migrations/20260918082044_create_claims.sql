-- claims: one row per Excel line (not per claim_number).
-- Excel header column "0" is omitted.

create table public.claims (
  id bigint generated always as identity primary key,

  carrier text,
  group_name text,
  claim_number text,
  subscriber_id text,
  member_id text,
  member_custom_id text,
  incurred_date date,
  paid_date date,

  billed numeric,
  allowed numeric,
  paid numeric,
  member_paid numeric,

  principal_dx_code text,
  principal_dx_description text,
  dx1_code text,
  dx1_description text,
  dx2_code text,
  dx2_description text,
  dx3_code text,
  dx3_description text,

  cpt_code text,
  cpt_category text,
  cpt_description text,
  icd_procedure_code_1 text,
  icd_procedure_description_1 text,
  icd_procedure_code_2 text,
  icd_procedure_description_2 text,

  service_category text,
  drg_code text,
  drg_description text,

  cob numeric,
  coinsurance numeric,
  copayment numeric,
  covered numeric,
  deductible numeric,
  discount numeric,
  not_covered numeric,

  facility text,
  benefit_package text
);

create index claims_incurred_date_idx on public.claims (incurred_date);
create index claims_member_id_idx on public.claims (member_id);
create index claims_claim_number_idx on public.claims (claim_number);

alter table public.claims enable row level security;
