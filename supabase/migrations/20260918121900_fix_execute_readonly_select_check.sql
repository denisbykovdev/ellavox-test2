-- PostgreSQL \b is a backspace, not a word boundary, so the original
-- '^\\s*select\\b' check rejected every SELECT. Use \y instead.

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
  if trimmed !~* '^select\y' then
    raise exception 'only SELECT is allowed';
  end if;
  if position(';' in rtrim(trimmed, ';')) > 0 then
    raise exception 'only a single SELECT statement is allowed';
  end if;
  execute
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from ('
    || rtrim(trimmed, ';')
    || ') as t'
    into result;
  return result;
end;
$$;

revoke all on function public.execute_readonly_query(text) from public;
grant execute on function public.execute_readonly_query(text) to service_role;
