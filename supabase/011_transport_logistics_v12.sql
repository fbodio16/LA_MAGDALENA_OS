begin;

alter table public.transport_trips add column if not exists sale_id uuid references public.sales_orders(id) on delete set null;
alter table public.transport_trips add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.transport_trips add column if not exists client_name text;
alter table public.transport_trips add column if not exists origin text default 'Santiago Temple';
alter table public.transport_trips add column if not exists cargo_type text default 'Rollos de alfalfa';
alter table public.transport_trips add column if not exists rolls integer default 0;
alter table public.transport_trips add column if not exists fuel_liters numeric default 0;
alter table public.transport_trips add column if not exists fuel_price numeric default 0;
alter table public.transport_trips add column if not exists tolls numeric default 0;
alter table public.transport_trips add column if not exists driver_cost numeric default 0;
alter table public.transport_trips add column if not exists maintenance_cost numeric default 0;
alter table public.transport_trips add column if not exists other_cost numeric default 0;
alter table public.transport_trips add column if not exists vehicle_id uuid references public.equipment(id) on delete set null;
alter table public.transport_trips add column if not exists vehicle_name text;
alter table public.transport_trips add column if not exists trailer text;
alter table public.transport_trips add column if not exists driver_id uuid references public.personnel(id) on delete set null;
alter table public.transport_trips add column if not exists driver_name text;
alter table public.transport_trips add column if not exists status text default 'Planificado';
alter table public.transport_trips add column if not exists payment_status text default 'Pendiente';
alter table public.transport_trips add column if not exists invoice_number text;
alter table public.transport_trips add column if not exists delivery_note text;
alter table public.transport_trips add column if not exists observations text;
alter table public.transport_trips add column if not exists updated_at timestamptz not null default now();

update public.transport_trips
set client_name=coalesce(client_name,client),
    origin=coalesce(nullif(origin,''),'Santiago Temple'),
    vehicle_name=coalesce(nullif(vehicle_name,''),'Scania R450'),
    driver_name=coalesce(nullif(driver_name,''),'Franco Bodio')
where client_name is null or origin is null or vehicle_name is null or driver_name is null;

create index if not exists transport_trips_company_date_v12_idx on public.transport_trips(company_id,trip_date desc);
create index if not exists transport_trips_sale_v12_idx on public.transport_trips(company_id,sale_id);
create index if not exists transport_trips_status_v12_idx on public.transport_trips(company_id,status,payment_status);

create or replace function public.set_transport_trip_updated_at_v12() returns trigger
language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists transport_trip_updated_at_v12 on public.transport_trips;
create trigger transport_trip_updated_at_v12 before update on public.transport_trips
for each row execute function public.set_transport_trip_updated_at_v12();

create or replace view public.transport_summary_v12 as
select company_id,
       count(*) as trips_count,
       count(*) filter(where status='Completado') as completed_trips,
       coalesce(sum(kilometers),0) as total_km,
       coalesce(sum(tons),0) as total_tons,
       coalesce(sum(rolls),0) as total_rolls,
       coalesce(sum(fuel_liters),0) as total_fuel_liters,
       coalesce(sum(income),0) as total_income,
       coalesce(sum(cost),0) as total_cost,
       coalesce(sum(income-cost),0) as total_margin,
       case when coalesce(sum(kilometers),0)>0 then sum(cost)/sum(kilometers) else 0 end as cost_per_km,
       case when coalesce(sum(kilometers),0)>0 then sum(fuel_liters)*100/sum(kilometers) else 0 end as liters_per_100km
from public.transport_trips
group by company_id;

commit;

select to_regclass('public.transport_trips') as trips_table,
       to_regclass('public.transport_summary_v12') as summary_view,
       count(*) as existing_trips,
       count(*) filter(where company_id is null) as trips_without_company
from public.transport_trips;
