-- LA MAGDALENA OS 3.2.0 — Gestión de usuarios e invitaciones
-- Ejecutar después de 002_security_saas_roles.sql
begin;

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'Operario'
    check (role in ('Superadministrador','Administrador','Encargado','Operario','Asesor','Cliente')),
  status text not null default 'Pendiente'
    check (status in ('Pendiente','Aceptada','Revocada','Vencida')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists company_invitations_pending_unique
on public.company_invitations(company_id, lower(email))
where status='Pendiente';

alter table public.company_invitations enable row level security;

drop policy if exists company_invitations_select on public.company_invitations;
drop policy if exists company_invitations_insert on public.company_invitations;
drop policy if exists company_invitations_update on public.company_invitations;
drop policy if exists company_invitations_delete on public.company_invitations;

create policy company_invitations_select on public.company_invitations
for select to authenticated
using (
  public.is_company_admin(company_id)
  or lower(email)=lower(coalesce(auth.jwt()->>'email',''))
);

create policy company_invitations_insert on public.company_invitations
for insert to authenticated
with check (
  public.is_company_admin(company_id)
  and invited_by=auth.uid()
);

create policy company_invitations_update on public.company_invitations
for update to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy company_invitations_delete on public.company_invitations
for delete to authenticated
using (public.is_company_admin(company_id));

create or replace function public.claim_company_invitations()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  claimed integer := 0;
  user_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null or user_email='' then return 0; end if;

  insert into public.company_members(company_id,user_id,email,full_name,role)
  select i.company_id,auth.uid(),user_email,
         coalesce(i.full_name,auth.jwt()->'user_metadata'->>'full_name',user_email),i.role
  from public.company_invitations i
  where lower(i.email)=user_email
    and i.status='Pendiente'
    and i.expires_at>now()
  on conflict (company_id,user_id) do nothing;

  get diagnostics claimed = row_count;

  update public.company_invitations
  set status='Aceptada',accepted_at=now()
  where lower(email)=user_email and status='Pendiente' and expires_at>now();

  update public.company_invitations
  set status='Vencida'
  where status='Pendiente' and expires_at<=now();

  return claimed;
end;
$$;

grant execute on function public.claim_company_invitations() to authenticated;

commit;
select 'LA MAGDALENA OS 3.2.0: usuarios e invitaciones aplicados' as resultado;
