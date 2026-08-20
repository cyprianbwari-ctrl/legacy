-- STOCK CONTROL v5 REDO
-- Saturday -> Thursday reporting.
-- Friday is never a valid submission day.
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('super_admin','admin','staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_unit as enum (
    'case','pack','packet','roll','piece','pad','kg','litre','gram','box','bottle','other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  role public.app_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id)
);

alter table public.project_memberships
  add column if not exists active boolean not null default true;

alter table public.project_memberships
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  unit public.product_unit not null default 'piece',
  full_stock numeric(14,3) not null default 0 check(full_stock >= 0),
  order_point numeric(14,3) not null default 0 check(order_point >= 0),
  low_stock_point numeric(14,3) not null default 0 check(low_stock_point >= 0),
  active boolean not null default true,
  notes text,
  packaging jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,name)
);

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_date date not null,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(project_id,assignment_date)
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_for_staff boolean not null default true,
  unique(project_id,report_date)
);

create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null default 0 check(quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id,product_id)
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_delta numeric(14,3) not null,
  reason text not null,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_correction_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_usage jsonb not null,
  notes text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.daily_correction_requests
  drop constraint if exists daily_correction_requests_status_check;
alter table public.daily_correction_requests
  add constraint daily_correction_requests_status_check
  check(status in ('pending','approved','rejected','completed'));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.period_initials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_type text not null check(period_type in ('week','month')),
  period_start date not null,
  product_id uuid not null references public.products(id) on delete restrict,
  initial_quantity numeric(14,3) not null default 0 check(initial_quantity >= 0),
  edited_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(project_id,period_type,period_start,product_id)
);

create table if not exists public.monthly_usage_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  month_start date not null,
  product_id uuid not null references public.products(id) on delete restrict,
  week_number integer not null check(week_number between 1 and 4),
  quantity numeric(14,3) not null default 0 check(quantity >= 0),
  edited_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(project_id,month_start,product_id,week_number)
);

create index if not exists idx_memberships_user on public.project_memberships(user_id);
create index if not exists idx_memberships_project_active on public.project_memberships(project_id,active);
create index if not exists idx_products_project on public.products(project_id);
create index if not exists idx_reports_project_date on public.daily_reports(project_id,report_date);
create index if not exists idx_usage_report on public.daily_usage(report_id);
create index if not exists idx_correction_requests_report on public.daily_correction_requests(report_id,created_at desc);
create index if not exists idx_audit_project_time on public.audit_logs(project_id,created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists memberships_touch on public.project_memberships;
create trigger memberships_touch before update on public.project_memberships
for each row execute function public.touch_updated_at();

drop trigger if exists reports_touch on public.daily_reports;
create trigger reports_touch before update on public.daily_reports
for each row execute function public.touch_updated_at();

drop trigger if exists usage_touch on public.daily_usage;
create trigger usage_touch before update on public.daily_usage
for each row execute function public.touch_updated_at();

create or replace function public.is_member(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.project_memberships pm
    join public.profiles p on p.id=pm.user_id
    where pm.project_id=p_project_id
      and pm.user_id=auth.uid()
      and pm.active=true
      and p.active=true
  );
$$;

create or replace function public.is_manager(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.project_memberships pm
    join public.profiles p on p.id=pm.user_id
    where pm.project_id=p_project_id
      and pm.user_id=auth.uid()
      and pm.active=true
      and p.active=true
      and p.role in ('admin','super_admin')
  );
$$;

create or replace function public.my_profile()
returns table(
  id uuid,
  full_name text,
  username text,
  role public.app_role,
  active boolean
)
language sql stable security definer
set search_path=public
as $$
  select p.id,p.full_name,p.username,p.role,p.active
  from public.profiles p
  where p.id=auth.uid();
$$;

create or replace function public.my_projects()
returns table(
  id uuid,
  name text,
  company_id uuid,
  company_name text
)
language sql stable security definer
set search_path=public
as $$
  select pr.id,pr.name,pr.company_id,c.name
  from public.projects pr
  join public.companies c on c.id=pr.company_id
  join public.project_memberships pm on pm.project_id=pr.id
  where pm.user_id=auth.uid()
    and pm.active=true
    and pr.active=true;
$$;

revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

revoke all on function public.my_projects() from public;
grant execute on function public.my_projects() to authenticated;

-- First-time application setup.
-- The Auth user must already exist. This avoids client-side signUp/email rate-limit issues.
create or replace function public.complete_first_super_admin(
  p_full_name text,
  p_username text,
  p_company_name text,
  p_project_name text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  current_user_id uuid := auth.uid();
  company_id uuid;
  project_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to complete setup';
  end if;

  if exists(select 1 from public.profiles limit 1) then
    raise exception 'Super Admin setup has already been completed';
  end if;

  insert into public.profiles(id,full_name,username,role,active)
  values(current_user_id,trim(p_full_name),trim(p_username),'super_admin',true);

  select c.id into company_id
  from public.companies c
  where lower(c.name)=lower(trim(p_company_name))
  order by c.created_at
  limit 1;

  if company_id is null then
    insert into public.companies(name)
    values(trim(p_company_name))
    returning id into company_id;
  end if;

  select p.id into project_id
  from public.projects p
  where p.company_id=company_id
    and lower(p.name)=lower(trim(p_project_name))
  order by p.created_at
  limit 1;

  if project_id is null then
    insert into public.projects(company_id,name)
    values(company_id,trim(p_project_name))
    returning id into project_id;
  end if;

  insert into public.project_memberships(project_id,user_id,active)
  values(project_id,current_user_id,true)
  on conflict(project_id,user_id)
  do update set active=true;

  insert into public.audit_logs(project_id,actor_id,action,entity_type,entity_id,details)
  values(
    project_id,
    current_user_id,
    'super_admin.setup_completed',
    'profile',
    current_user_id,
    jsonb_build_object('username',trim(p_username))
  );

  return project_id;
end;
$$;

revoke all on function public.complete_first_super_admin(text,text,text,text) from public;

create or replace function public.delete_product(
  p_project_id uuid,
  p_product_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_name text;
  v_unit public.product_unit;
  v_full_stock numeric;
  v_order_point numeric;
  v_low_stock_point numeric;
begin
  if auth.uid() is null or p_actor_id is null or auth.uid() <> p_actor_id then
    raise exception 'You must be signed in as the acting user.';
  end if;

  if not public.is_manager(p_project_id) then
    raise exception 'You are not authorized to delete products in this project.';
  end if;

  select name, unit, full_stock, order_point, low_stock_point
    into v_name, v_unit, v_full_stock, v_order_point, v_low_stock_point
  from public.products
  where id = p_product_id
    and project_id = p_project_id
  for update;

  if v_name is null then
    raise exception 'Product not found in the selected project.';
  end if;

  insert into public.audit_logs(project_id, actor_id, action, entity_type, entity_id, details)
  values (
    p_project_id,
    p_actor_id,
    'product.deleted',
    'product',
    p_product_id,
    jsonb_build_object(
      'name', v_name,
      'unit', v_unit,
      'full_stock', v_full_stock,
      'order_point', v_order_point,
      'low_stock_point', v_low_stock_point
    )
  );

  begin
    delete from public.products
    where id = p_product_id
      and project_id = p_project_id;
  exception
    when foreign_key_violation then
      raise exception 'This product has historical records and cannot be deleted. Deactivate it instead.';
  end;
end;
$$;

revoke all on function public.delete_product(uuid,uuid,uuid) from public;
grant execute on function public.delete_product(uuid,uuid,uuid) to authenticated;

grant execute on function public.complete_first_super_admin(text,text,text,text) to authenticated;

create or replace function public.create_project(p_company_id uuid,p_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_project_id uuid;
begin
  if not exists(
    select 1
    from public.project_memberships pm
    join public.projects pr on pr.id=pm.project_id
    join public.profiles p on p.id=pm.user_id
    where pm.user_id=auth.uid()
      and pm.active=true
      and pr.company_id=p_company_id
      and p.active=true
      and p.role in ('admin','super_admin')
  ) then
    raise exception 'Not authorized to create a project for this company';
  end if;

  insert into public.projects(company_id,name)
  values(p_company_id,trim(p_name))
  returning id into new_project_id;

  insert into public.project_memberships(project_id,user_id,active)
  values(new_project_id,auth.uid(),true);

  insert into public.audit_logs(project_id,actor_id,action,entity_type,entity_id,details)
  values(
    new_project_id,
    auth.uid(),
    'project.created',
    'project',
    new_project_id,
    jsonb_build_object('name',trim(p_name))
  );

  return new_project_id;
end;
$$;

revoke all on function public.create_project(uuid,text) from public;
grant execute on function public.create_project(uuid,text) to authenticated;

create or replace function public.my_submission_status(
  p_project_id uuid,
  p_report_date date
)
returns table(submitted boolean,submitted_at timestamptz)
language sql stable security definer
set search_path=public
as $$
  select
    exists(
      select 1
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=p_report_date
        and r.submitted_by=auth.uid()
    ),
    (
      select r.submitted_at
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=p_report_date
        and r.submitted_by=auth.uid()
      limit 1
    );
$$;

revoke all on function public.my_submission_status(uuid,date) from public;
grant execute on function public.my_submission_status(uuid,date) to authenticated;


create or replace function public.daily_submission_status(
  p_project_id uuid,
  p_report_date date
)
returns table(
  day_submitted boolean,
  submitted_by_me boolean,
  my_submitted_at timestamptz
)
language sql stable security definer
set search_path=public
as $$
  select
    exists(
      select 1
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=p_report_date
    ),
    exists(
      select 1
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=p_report_date
        and r.submitted_by=auth.uid()
    ),
    (
      select r.submitted_at
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=p_report_date
        and r.submitted_by=auth.uid()
      limit 1
    );
$$;

revoke all on function public.daily_submission_status(uuid,date) from public;
grant execute on function public.daily_submission_status(uuid,date) to authenticated;

create or replace function public.submit_daily_report(
  p_project_id uuid,
  p_report_date date,
  p_submitted_by uuid,
  p_usage jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  report_id uuid;
  report_time timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_submitted_by then
    raise exception 'You may only submit under your own account';
  end if;

  if not public.is_member(p_project_id) then
    raise exception 'You are not a member of this project';
  end if;

  if (extract(dow from p_report_date)) = 5 then
    raise exception 'Friday is an off day and does not accept reports';
  end if;

  if exists(
    select 1 from public.daily_reports
    where project_id=p_project_id
      and report_date=p_report_date
  ) then
    raise exception 'This day has already been submitted';
  end if;

  insert into public.daily_reports(project_id,report_date,submitted_by,locked_for_staff)
  values(p_project_id,p_report_date,p_submitted_by,true)
  returning id,submitted_at into report_id,report_time;

  insert into public.daily_usage(report_id,product_id,quantity)
  select
    report_id,
    (item->>'product_id')::uuid,
    greatest(0,(item->>'quantity')::numeric)
  from jsonb_array_elements(p_usage) item;

  insert into public.audit_logs(project_id,actor_id,action,entity_type,entity_id,details)
  values(
    p_project_id,
    p_submitted_by,
    'daily_report.submitted',
    'daily_report',
    report_id,
    jsonb_build_object('reportDate',p_report_date)
  );

  return jsonb_build_object(
    'id',report_id,
    'report_date',p_report_date,
    'submitted_by',p_submitted_by,
    'submitted_at',report_time
  );
end;
$$;

revoke all on function public.submit_daily_report(uuid,date,uuid,jsonb) from public;
grant execute on function public.submit_daily_report(uuid,date,uuid,jsonb) to authenticated;

create or replace function public.admin_replace_daily_report(
  p_report_id uuid,
  p_editor_id uuid,
  p_usage jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  project_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_editor_id then
    raise exception 'Invalid editor';
  end if;

  select r.project_id into project_id
  from public.daily_reports r
  where r.id=p_report_id;

  if project_id is null or not public.is_manager(project_id) then
    raise exception 'Not authorized to edit this report';
  end if;

  delete from public.daily_usage where report_id=p_report_id;

  insert into public.daily_usage(report_id,product_id,quantity)
  select
    p_report_id,
    (item->>'product_id')::uuid,
    greatest(0,(item->>'quantity')::numeric)
  from jsonb_array_elements(p_usage) item;

  update public.daily_reports
  set updated_at=now()
  where id=p_report_id;

  insert into public.audit_logs(project_id,actor_id,action,entity_type,entity_id,details)
  values(
    project_id,
    p_editor_id,
    'daily_report.edited',
    'daily_report',
    p_report_id,
    jsonb_build_object('usage',p_usage)
  );
end;
$$;

revoke all on function public.admin_replace_daily_report(uuid,uuid,jsonb) from public;
grant execute on function public.admin_replace_daily_report(uuid,uuid,jsonb) to authenticated;

create or replace function public.admin_save_week(
  p_project_id uuid,
  p_week_start date,
  p_editor_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  row jsonb;
  product_id uuid;
  initial_quantity numeric;
  day_index integer;
  report_date date;
  report_id uuid;
  existing_report_id uuid;
  quantity numeric;
begin
  if auth.uid() is null or auth.uid() <> p_editor_id or not public.is_manager(p_project_id) then
    raise exception 'Not authorized to edit this week';
  end if;

  for row in select * from jsonb_array_elements(p_rows)
  loop
    product_id := (row->>'product_id')::uuid;
    initial_quantity := greatest(0,(row->>'initial')::numeric);

    insert into public.period_initials(
      project_id,period_type,period_start,product_id,initial_quantity,edited_by
    )
    values(
      p_project_id,'week',p_week_start,product_id,initial_quantity,p_editor_id
    )
    on conflict(project_id,period_type,period_start,product_id)
    do update set
      initial_quantity=excluded.initial_quantity,
      edited_by=excluded.edited_by,
      updated_at=now();

    for day_index in 0..5
    loop
      report_date := p_week_start + day_index;

      select r.id into existing_report_id
      from public.daily_reports r
      where r.project_id=p_project_id
        and r.report_date=report_date;

      if existing_report_id is null then
        insert into public.daily_reports(
          project_id,report_date,submitted_by,locked_for_staff
        )
        values(
          p_project_id,
          report_date,
          p_editor_id,
          true
        )
        returning id into report_id;
      else
        report_id := existing_report_id;
      end if;

      quantity := greatest(
        0,
        coalesce(
          ((row->'daily')->>day_index)::numeric,
          0
        )
      );

      insert into public.daily_usage(report_id,product_id,quantity)
      values(report_id,product_id,quantity)
      on conflict(report_id,product_id)
      do update set quantity=excluded.quantity,updated_at=now();
    end loop;
  end loop;

  insert into public.audit_logs(project_id,actor_id,action,entity_type,details)
  values(
    p_project_id,
    p_editor_id,
    'week.edited',
    'weekly_usage',
    jsonb_build_object('weekStart',p_week_start,'rows',p_rows)
  );
end;
$$;

revoke all on function public.admin_save_week(uuid,date,uuid,jsonb) from public;
grant execute on function public.admin_save_week(uuid,date,uuid,jsonb) to authenticated;

create or replace function public.admin_save_month(
  p_project_id uuid,
  p_month_start date,
  p_editor_id uuid,
  p_rows jsonb,
  p_initials jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  row jsonb;
  initial_row jsonb;
  product_id uuid;
  week_no integer;
begin
  if auth.uid() is null or auth.uid() <> p_editor_id or not public.is_manager(p_project_id) then
    raise exception 'Not authorized to edit this month';
  end if;

  for initial_row in select * from jsonb_array_elements(p_initials)
  loop
    insert into public.period_initials(
      project_id,period_type,period_start,product_id,initial_quantity,edited_by
    )
    values(
      p_project_id,
      'month',
      p_month_start,
      (initial_row->>'product_id')::uuid,
      greatest(0,(initial_row->>'initial_quantity')::numeric),
      p_editor_id
    )
    on conflict(project_id,period_type,period_start,product_id)
    do update set
      initial_quantity=excluded.initial_quantity,
      edited_by=excluded.edited_by,
      updated_at=now();
  end loop;

  for row in select * from jsonb_array_elements(p_rows)
  loop
    product_id := (row->>'product_id')::uuid;

    for week_no in 1..4
    loop
      insert into public.monthly_usage_overrides(
        project_id,month_start,product_id,week_number,quantity,edited_by
      )
      values(
        p_project_id,
        p_month_start,
        product_id,
        week_no,
        greatest(0,coalesce((row->>('week_'||week_no))::numeric,0)),
        p_editor_id
      )
      on conflict(project_id,month_start,product_id,week_number)
      do update set
        quantity=excluded.quantity,
        edited_by=excluded.edited_by,
        updated_at=now();
    end loop;
  end loop;

  insert into public.audit_logs(project_id,actor_id,action,entity_type,details)
  values(
    p_project_id,
    p_editor_id,
    'month.edited',
    'monthly_usage',
    jsonb_build_object('monthStart',p_month_start)
  );
end;
$$;

revoke all on function public.admin_save_month(uuid,date,uuid,jsonb,jsonb) from public;
grant execute on function public.admin_save_month(uuid,date,uuid,jsonb,jsonb) to authenticated;

create or replace function public.my_daily_report(p_project_id uuid,p_report_date date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select jsonb_build_object('id',r.id,'submitted_at',r.submitted_at,'submitted_by_me',true,'daily_usage',coalesce(jsonb_agg(jsonb_build_object('product_id',u.product_id,'quantity',u.quantity)) filter(where u.id is not null),'[]'::jsonb)) into result from daily_reports r left join daily_usage u on u.report_id=r.id where r.project_id=p_project_id and r.report_date=p_report_date and r.submitted_by=auth.uid() group by r.id;
  return result;
end; $$;
revoke all on function public.my_daily_report(uuid,date) from public;
grant execute on function public.my_daily_report(uuid,date) to authenticated;

create or replace function public.request_daily_correction(p_project_id uuid,p_report_id uuid,p_requested_usage jsonb,p_notes text,p_requester_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare request_id uuid;
begin
  if auth.uid() is null or auth.uid()<>p_requester_id then raise exception 'You may only request a correction for yourself'; end if;
  if not exists(select 1 from daily_reports where id=p_report_id and project_id=p_project_id and submitted_by=auth.uid()) then raise exception 'You may only request a correction for your own report'; end if;
  insert into daily_correction_requests(project_id,report_id,requested_by,requested_usage,notes) values(p_project_id,p_report_id,auth.uid(),p_requested_usage,p_notes) returning id into request_id;
  insert into audit_logs(project_id,actor_id,action,entity_type,entity_id,details) values(p_project_id,auth.uid(),'daily_report.correction_requested','daily_correction_request',request_id,jsonb_build_object('reportId',p_report_id,'notes',p_notes));
  return request_id;
end; $$;
revoke all on function public.request_daily_correction(uuid,uuid,jsonb,text,uuid) from public;
grant execute on function public.request_daily_correction(uuid,uuid,jsonb,text,uuid) to authenticated;

create or replace function public.resolve_daily_correction(p_request_id uuid,p_decision text,p_editor_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare req daily_correction_requests%rowtype;
begin
  if auth.uid() is null or auth.uid()<>p_editor_id then raise exception 'Invalid editor'; end if;
  select * into req from daily_correction_requests where id=p_request_id for update;
  if req.id is null or not is_manager(req.project_id) then raise exception 'Not authorized to review this request'; end if;
  if req.status<>'pending' or p_decision not in ('approved','rejected') then raise exception 'This request cannot be processed'; end if;
  if p_decision='approved' then
    delete from daily_usage where report_id=req.report_id;
    insert into daily_usage(report_id,product_id,quantity)
    select req.report_id,(item->>'product_id')::uuid,greatest(0,(item->>'quantity')::numeric)
    from jsonb_array_elements(req.requested_usage) item;
    update daily_reports set updated_at=now() where id=req.report_id;
  end if;
  update daily_correction_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now() where id=req.id;
  insert into audit_logs(project_id,actor_id,action,entity_type,entity_id,details) values(req.project_id,auth.uid(),case when p_decision='approved' then 'daily_report.correction_approved' else 'daily_report.correction_rejected' end,'daily_correction_request',req.id,jsonb_build_object('reportId',req.report_id));
end; $$;
revoke all on function public.resolve_daily_correction(uuid,text,uuid) from public;
grant execute on function public.resolve_daily_correction(uuid,text,uuid) to authenticated;

create or replace function public.staff_correction_permission(p_project_id uuid,p_report_id uuid)
returns table(allowed boolean) language sql stable security definer set search_path=public as $$
  select exists(select 1 from daily_correction_requests where project_id=p_project_id and report_id=p_report_id and requested_by=auth.uid() and status='approved');
$$;
revoke all on function public.staff_correction_permission(uuid,uuid) from public;
grant execute on function public.staff_correction_permission(uuid,uuid) to authenticated;

create or replace function public.staff_replace_daily_report(p_project_id uuid,p_report_id uuid,p_usage jsonb,p_staff_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or auth.uid()<>p_staff_id then raise exception 'Invalid staff member'; end if;
  if not exists(select 1 from daily_correction_requests where project_id=p_project_id and report_id=p_report_id and requested_by=auth.uid() and status='approved') then raise exception 'This correction has not been approved'; end if;
  delete from daily_usage where report_id=p_report_id;
  insert into daily_usage(report_id,product_id,quantity) select p_report_id,(item->>'product_id')::uuid,greatest(0,(item->>'quantity')::numeric) from jsonb_array_elements(p_usage) item;
  update daily_correction_requests set status='completed', reviewed_at=now() where project_id=p_project_id and report_id=p_report_id and requested_by=auth.uid() and status='approved';
  update daily_reports set updated_at=now() where id=p_report_id and project_id=p_project_id;
  insert into audit_logs(project_id,actor_id,action,entity_type,entity_id,details) values(p_project_id,auth.uid(),'daily_report.corrected_by_staff','daily_report',p_report_id,jsonb_build_object('usage',p_usage));
end; $$;
revoke all on function public.staff_replace_daily_report(uuid,uuid,jsonb,uuid) from public;
grant execute on function public.staff_replace_daily_report(uuid,uuid,jsonb,uuid) to authenticated;

-- RLS
alter table public.companies enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.project_memberships enable row level security;
alter table public.products enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_usage enable row level security;
alter table public.daily_correction_requests enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.period_initials enable row level security;
alter table public.monthly_usage_overrides enable row level security;

drop policy if exists companies_member_read on public.companies;
create policy companies_member_read on public.companies for select
using(
  exists(
    select 1
    from public.projects pr
    join public.project_memberships pm on pm.project_id=pr.id
    where pr.company_id=companies.id
      and pm.user_id=auth.uid()
      and pm.active=true
  )
);

drop policy if exists projects_member_read on public.projects;
create policy projects_member_read on public.projects for select
using(public.is_member(id));

drop policy if exists projects_manager_write on public.projects;
create policy projects_manager_write on public.projects for all
using(public.is_manager(id))
with check(public.is_manager(id));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
using(
  id=auth.uid()
  or exists(
    select 1
    from public.project_memberships pm
    where pm.user_id=profiles.id
      and pm.active=true
      and public.is_manager(pm.project_id)
  )
);

drop policy if exists profiles_client_write on public.profiles;
-- Profile creation, role changes and password changes happen only through the
-- controlled Edge Function or first-setup RPC.

drop policy if exists memberships_read on public.project_memberships;
create policy memberships_read on public.project_memberships for select
using(user_id=auth.uid() or public.is_manager(project_id));

drop policy if exists memberships_manager_write on public.project_memberships;
create policy memberships_manager_write on public.project_memberships for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id));

drop policy if exists products_member_read on public.products;
create policy products_member_read on public.products for select
using(public.is_member(project_id));

drop policy if exists products_manager_write on public.products;
create policy products_manager_write on public.products for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id));

drop policy if exists assignments_member_read on public.staff_assignments;
create policy assignments_member_read on public.staff_assignments for select
using(public.is_member(project_id));

drop policy if exists assignments_manager_write on public.staff_assignments;
create policy assignments_manager_write on public.staff_assignments for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id));

drop policy if exists reports_manager_read on public.daily_reports;
create policy reports_manager_read on public.daily_reports for select
using(public.is_manager(project_id));

drop policy if exists reports_manager_update on public.daily_reports;
create policy reports_manager_update on public.daily_reports for update
using(public.is_manager(project_id))
with check(public.is_manager(project_id));

drop policy if exists usage_manager_read on public.daily_usage;
create policy usage_manager_read on public.daily_usage for select
using(
  exists(
    select 1 from public.daily_reports r
    where r.id=daily_usage.report_id
      and public.is_manager(r.project_id)
  )
);

drop policy if exists usage_manager_write on public.daily_usage;
create policy usage_manager_write on public.daily_usage for all
using(
  exists(
    select 1 from public.daily_reports r
    where r.id=daily_usage.report_id
      and public.is_manager(r.project_id)
  )
)
with check(
  exists(
    select 1 from public.daily_reports r
    where r.id=daily_usage.report_id
      and public.is_manager(r.project_id)
  )
);

drop policy if exists adjustments_manager_all on public.stock_adjustments;
create policy adjustments_manager_all on public.stock_adjustments for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id) and created_by=auth.uid());

drop policy if exists correction_requests_manager_read on public.daily_correction_requests;
create policy correction_requests_manager_read on public.daily_correction_requests for select
using(public.is_manager(project_id));

drop policy if exists audit_manager_read on public.audit_logs;
create policy audit_manager_read on public.audit_logs for select
using(public.is_manager(project_id));

drop policy if exists audit_manager_insert on public.audit_logs;
create policy audit_manager_insert on public.audit_logs for insert
with check(public.is_manager(project_id) and actor_id=auth.uid());

drop policy if exists period_initials_manager_all on public.period_initials;
create policy period_initials_manager_all on public.period_initials for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id) and edited_by=auth.uid());

drop policy if exists monthly_override_manager_all on public.monthly_usage_overrides;
create policy monthly_override_manager_all on public.monthly_usage_overrides for all
using(public.is_manager(project_id))
with check(public.is_manager(project_id) and edited_by=auth.uid());

-- Important: this table is manager-only for usage editing. Staff only use the
-- my_submission_status RPC and the daily submission RPC.

-- Remove legacy policies that could expose staff submission details.
drop policy if exists reports_member_read on public.daily_reports;
drop policy if exists reports_staff_insert on public.daily_reports;
drop policy if exists reports_manager_write on public.daily_reports;
drop policy if exists usage_member_read on public.daily_usage;
drop policy if exists usage_staff_insert on public.daily_usage;

-- Compatibility: ensure the current project/user can continue using existing data.
-- No sample users are created here.
