begin;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'Planificada',
  start_date date not null,
  end_date date,
  crop text,
  target_rolls integer not null default 0,
  target_revenue numeric not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_dates_v13 check (end_date is null or end_date >= start_date),
  constraint campaigns_status_v13 check (status in ('Planificada','Activa','Cerrada'))
);

alter table public.lots add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.alfalfa_cuts add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.sales_orders add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.transport_trips add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create unique index if not exists campaigns_company_name_v13_idx on public.campaigns(company_id,lower(name));
create index if not exists campaigns_company_status_v13_idx on public.campaigns(company_id,status,start_date desc);
create index if not exists lots_campaign_v13_idx on public.lots(company_id,campaign_id);
create index if not exists cuts_campaign_v13_idx on public.alfalfa_cuts(company_id,campaign_id,cut_date desc);
create index if not exists sales_campaign_v13_idx on public.sales_orders(company_id,campaign_id,sale_date desc);
create index if not exists trips_campaign_v13_idx on public.transport_trips(company_id,campaign_id,trip_date desc);

create or replace function public.set_campaign_updated_at_v13() returns trigger
language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists campaign_updated_at_v13 on public.campaigns;
create trigger campaign_updated_at_v13 before update on public.campaigns
for each row execute function public.set_campaign_updated_at_v13();

alter table public.campaigns enable row level security;
drop policy if exists campaigns_select_company_v13 on public.campaigns;
create policy campaigns_select_company_v13 on public.campaigns for select using (
  exists(select 1 from public.company_members cm where cm.company_id=campaigns.company_id and cm.user_id=auth.uid())
);
drop policy if exists campaigns_write_company_v13 on public.campaigns;
create policy campaigns_write_company_v13 on public.campaigns for all using (
  exists(select 1 from public.company_members cm where cm.company_id=campaigns.company_id and cm.user_id=auth.uid() and cm.role in ('Superadministrador','Administrador','Encargado'))
) with check (
  exists(select 1 from public.company_members cm where cm.company_id=campaigns.company_id and cm.user_id=auth.uid() and cm.role in ('Superadministrador','Administrador','Encargado'))
);

create or replace view public.campaign_summary_v13 as
select c.id,c.company_id,c.name,c.status,c.start_date,c.end_date,c.crop,c.target_rolls,c.target_revenue,
       count(distinct l.id) as lots_count,
       coalesce(sum(distinct l.hectares),0) as hectares,
       count(distinct ac.id) as cuts_count,
       coalesce(sum(ac.bales),0) as rolls,
       coalesce(sum(ac.total_kg),0)/1000.0 as tons,
       coalesce((select sum(so.total_amount) from public.sales_orders so where so.campaign_id=c.id and so.status<>'Anulada'),0) as sales_revenue,
       coalesce((select sum(so.paid_amount) from public.sales_orders so where so.campaign_id=c.id and so.status<>'Anulada'),0) as collected,
       coalesce((select sum(tt.income-tt.cost) from public.transport_trips tt where tt.campaign_id=c.id and tt.status<>'Cancelado'),0) as transport_margin
from public.campaigns c
left join public.lots l on l.campaign_id=c.id
left join public.alfalfa_cuts ac on ac.campaign_id=c.id
group by c.id;

commit;

select to_regclass('public.campaigns') as campaigns_table,
       to_regclass('public.campaign_summary_v13') as summary_view,
       count(*) as existing_campaigns
from public.campaigns;
