-- ============================================================
-- LA MAGDALENA OS 7.0.1 · AUDITORÍA DE DATOS (CORREGIDO)
-- Ejecutar este archivo COMPLETO en una consulta nueva de Supabase.
-- Es seguro volver a ejecutarlo: reemplaza función, políticas y triggers.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "company members read audit logs" on public.audit_logs;

-- La política se crea únicamente cuando existe company_members.
do $policy$
begin
  if to_regclass('public.company_members') is not null then
    execute $sql$
      create policy "company members read audit logs"
      on public.audit_logs
      for select
      using (
        exists (
          select 1
          from public.company_members cm
          where cm.company_id = audit_logs.company_id
            and cm.user_id = auth.uid()
        )
      )
    $sql$;
  end if;
end
$policy$;

create or replace function public.lmos_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  payload jsonb;
  cid uuid;
  rid text;
begin
  payload := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;

  begin
    cid := nullif(payload ->> 'company_id', '')::uuid;
  exception when invalid_text_representation then
    cid := null;
  end;

  rid := coalesce(nullif(payload ->> 'id', ''), '');

  insert into public.audit_logs (
    company_id,
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    changed_by
  ) values (
    cid,
    tg_table_name,
    rid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

do $triggers$
declare
  t text;
begin
  foreach t in array array[
    'lots',
    'lot_geometries',
    'precision_analyses',
    'precision_orders',
    'clients',
    'irrigation_events',
    'alfalfa_cuts',
    'transport_trips',
    'financial_movements'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', 'lmos_audit_' || t, t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.lmos_audit_row()',
        'lmos_audit_' || t,
        t
      );
    end if;
  end loop;
end
$triggers$;

create index if not exists audit_logs_company_changed_idx
  on public.audit_logs (company_id, changed_at desc);

commit;

-- Verificación: debe devolver una fila con audit_table = audit_logs.
select
  to_regclass('public.audit_logs') as audit_table,
  count(*) filter (where trigger_name like 'lmos_audit_%') as active_audit_triggers
from information_schema.triggers;
