-- Read-only SQL runner for bound SELECT templates. service_role only.

create or replace function public.execute_readonly_query(query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text;
  result jsonb;
begin
  trimmed := btrim(query);
  if trimmed is null or trimmed = '' then
    raise exception 'empty query';
  end if;
  if trimmed !~* '^\s*select\b' then
    raise exception 'only SELECT is allowed';
  end if;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (%s) as t',
    query
  ) into result;
  return result;
end;
$$;

revoke all on function public.execute_readonly_query(text) from public;
grant execute on function public.execute_readonly_query(text) to service_role;
