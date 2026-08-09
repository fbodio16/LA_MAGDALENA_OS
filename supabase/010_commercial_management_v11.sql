begin;
create extension if not exists pgcrypto;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  sale_date date not null default current_date,
  due_date date,
  payment_terms text default 'Contado',
  invoice_number text,
  delivery_note text,
  status text not null default 'Pendiente' check (status in ('Pendiente','Parcial','Cobrado','Anulada')),
  total_amount numeric not null default 0 check (total_amount >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales_orders(id) on delete cascade,
  cut_id uuid references public.alfalfa_cuts(id) on delete set null,
  description text not null default 'Rollos de alfalfa',
  quantity_rolls integer not null check (quantity_rolls > 0),
  weight_per_roll_kg numeric not null default 500 check (weight_per_roll_kg > 0),
  price_mode text not null default 'Por rollo' check (price_mode in ('Por rollo','Por tonelada')),
  unit_price numeric not null default 0 check (unit_price >= 0),
  ton_price numeric not null default 0 check (ton_price >= 0),
  line_total numeric not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales_orders(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric not null check (amount > 0),
  payment_method text default 'Transferencia',
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sales_orders_company_date_idx on public.sales_orders(company_id,sale_date desc);
create index if not exists sales_orders_client_idx on public.sales_orders(company_id,client_id);
create index if not exists sales_order_items_sale_idx on public.sales_order_items(sale_id);
create index if not exists sales_payments_sale_idx on public.sales_payments(sale_id,payment_date desc);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sales_orders','sales_order_items','sales_payments'] loop
    execute format('drop policy if exists %I on public.%I',t||'_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))',t||'_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_operate_company(company_id))',t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_operate_company(company_id)) with check (public.can_operate_company(company_id))',t||'_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_company_admin(company_id))',t||'_delete',t);
  end loop;
end $$;

create or replace function public.register_alfalfa_sale(
  p_company_id uuid, p_client_id uuid, p_client_name text, p_cut_id uuid,
  p_sale_date date, p_due_date date, p_payment_terms text,
  p_quantity integer, p_weight_per_roll numeric, p_price_mode text,
  p_unit_price numeric, p_ton_price numeric, p_invoice_number text,
  p_delivery_note text, p_initial_payment numeric, p_payment_method text, p_notes text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_sale_id uuid; v_total numeric; v_available integer; v_status text;
begin
  if not public.can_operate_company(p_company_id) then raise exception 'Sin permiso para operar esta empresa'; end if;
  if p_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  select greatest(0, coalesce(c.bales,c.rolls,0) +
    coalesce((select sum(case when m.movement_type='Ingreso' then m.quantity else -m.quantity end) from public.alfalfa_stock_movements m where m.cut_id=c.id),0))
    into v_available from public.alfalfa_cuts c where c.id=p_cut_id and c.company_id=p_company_id;
  if v_available is null then raise exception 'Partida no encontrada'; end if;
  if p_quantity > v_available then raise exception 'Stock insuficiente: hay % rollos disponibles',v_available; end if;
  v_total := case when p_price_mode='Por tonelada' then (p_quantity*p_weight_per_roll/1000.0)*p_ton_price else p_quantity*p_unit_price end;
  if v_total <= 0 then raise exception 'El precio debe ser mayor que cero'; end if;
  v_status := case when coalesce(p_initial_payment,0)>=v_total then 'Cobrado' when coalesce(p_initial_payment,0)>0 then 'Parcial' else 'Pendiente' end;
  insert into public.sales_orders(company_id,client_id,client_name,sale_date,due_date,payment_terms,invoice_number,delivery_note,status,total_amount,paid_amount,notes)
  values(p_company_id,p_client_id,nullif(trim(p_client_name),''),p_sale_date,p_due_date,p_payment_terms,nullif(trim(p_invoice_number),''),nullif(trim(p_delivery_note),''),v_status,v_total,least(v_total,greatest(0,coalesce(p_initial_payment,0))),p_notes)
  returning id into v_sale_id;
  insert into public.sales_order_items(company_id,sale_id,cut_id,quantity_rolls,weight_per_roll_kg,price_mode,unit_price,ton_price,line_total)
  values(p_company_id,v_sale_id,p_cut_id,p_quantity,p_weight_per_roll,p_price_mode,coalesce(p_unit_price,0),coalesce(p_ton_price,0),v_total);
  insert into public.alfalfa_stock_movements(company_id,cut_id,movement_date,movement_type,reason,quantity,customer_id,customer_name,unit_price,ton_price,payment_status,due_date,notes)
  values(p_company_id,p_cut_id,p_sale_date,'Salida','Venta',p_quantity,p_client_id,p_client_name,coalesce(p_unit_price,0),coalesce(p_ton_price,0),v_status,p_due_date,'Venta '||v_sale_id::text);
  if coalesce(p_initial_payment,0)>0 then
    insert into public.sales_payments(company_id,sale_id,payment_date,amount,payment_method,notes)
    values(p_company_id,v_sale_id,p_sale_date,least(v_total,p_initial_payment),coalesce(p_payment_method,'Transferencia'),'Cobro inicial');
    insert into public.financial_movements(company_id,movement_date,concept,income,cost,notes)
    values(p_company_id,p_sale_date,'Cobro venta de alfalfa - '||p_client_name,least(v_total,p_initial_payment),0,'Venta '||v_sale_id::text);
  end if;
  return v_sale_id;
end $$;

grant execute on function public.register_alfalfa_sale(uuid,uuid,text,uuid,date,date,text,integer,numeric,text,numeric,numeric,text,text,numeric,text,text) to authenticated;

create or replace function public.register_sale_payment(
  p_sale_id uuid, p_payment_date date, p_amount numeric, p_payment_method text, p_reference text, p_notes text
) returns void
language plpgsql security definer set search_path=public as $$
declare v_sale public.sales_orders%rowtype; v_new_paid numeric; v_status text;
begin
  select * into v_sale from public.sales_orders where id=p_sale_id;
  if v_sale.id is null then raise exception 'Venta no encontrada'; end if;
  if not public.can_operate_company(v_sale.company_id) then raise exception 'Sin permiso para operar esta empresa'; end if;
  if p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if v_sale.paid_amount+p_amount > v_sale.total_amount then raise exception 'El cobro supera el saldo pendiente'; end if;
  insert into public.sales_payments(company_id,sale_id,payment_date,amount,payment_method,reference,notes)
  values(v_sale.company_id,p_sale_id,p_payment_date,p_amount,p_payment_method,p_reference,p_notes);
  v_new_paid:=v_sale.paid_amount+p_amount;
  v_status:=case when v_new_paid>=v_sale.total_amount then 'Cobrado' else 'Parcial' end;
  update public.sales_orders set paid_amount=v_new_paid,status=v_status,updated_at=now() where id=p_sale_id;
  insert into public.financial_movements(company_id,movement_date,concept,income,cost,notes)
  values(v_sale.company_id,p_payment_date,'Cobro venta - '||v_sale.client_name,p_amount,0,'Venta '||p_sale_id::text||coalesce(' · '||p_reference,''));
end $$;
grant execute on function public.register_sale_payment(uuid,date,numeric,text,text,text) to authenticated;

create or replace view public.sales_account_summary_v11 as
select company_id, client_id, client_name,
       count(*) as sales_count, sum(total_amount) as invoiced,
       sum(paid_amount) as collected, sum(total_amount-paid_amount) as balance,
       min(due_date) filter(where total_amount>paid_amount) as oldest_due_date
from public.sales_orders where status<>'Anulada'
group by company_id,client_id,client_name;

commit;
select to_regclass('public.sales_orders') as sales_table,
       to_regclass('public.sales_order_items') as sale_items_table,
       to_regclass('public.sales_payments') as payments_table,
       to_regclass('public.sales_account_summary_v11') as account_summary_view;
