-- Stock Control Management
-- Run this in the Supabase SQL Editor.
-- The application uses Saturday -> Thursday reporting weeks.
-- Friday is intentionally excluded from reporting periods.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('super_admin','admin','staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_unit as enum ('case','pack','packet','roll','piece','pad','kg','litre','gram','box','bottle','other');
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  unit public.product_unit not null default 'piece',
  full_stock numeric(14,3) not null default 0 check (full_stock >= 0),
  order_point numeric(14,3) not null default 0 check (order_point >= 0),
  low_stock_point numeric(14,3) not null default 0 check (low_stock_point >= 0),
  active boolean not null default true,
  notes text,
  packaging jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_date date not null,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(project_id, assignment_date)
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_for_staff boolean not null default true,
  unique(project_id, report_date)
);

create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id, product_id)
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

create index if not exists idx_memberships_user on public.project_memberships(user_id);
create index if not exists idx_products_project on public.products(project_id);
create index if not exists idx_reports_project_date on public.daily_reports(project_id, report_date);
create index if not exists idx_usage_report on public.daily_usage(report_id);
create index if not exists idx_audit_project_time on public.audit_logs(project_id, created_at desc);

-- Timestamp trigger
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

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists reports_touch on public.daily_reports;
create trigger reports_touch before update on public.daily_reports
for each row execute function public.touch_updated_at();

drop trigger if exists usage_touch on public.daily_usage;
create trigger usage_touch before update on public.daily_usage
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Access helpers
create or replace function public.is_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_memberships pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.active = true
      )
  );
$$;

create or replace function public.is_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_memberships pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and p.active = true
      and p.role in ('admin','super_admin')
  );
$$;

-- Prevent staff from changing a submitted report after submission.
create or replace function public.guard_daily_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r public.app_role;
begin
  select role into r from public.profiles where id = auth.uid();
  if r = 'staff' then
    raise exception 'Staff cannot edit a submitted report';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_report_update on public.daily_reports;
create trigger guard_report_update before update on public.daily_reports
for each row execute function public.guard_daily_report_update();



create table if not exists public.period_initials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_type text not null check (period_type in ('week','month')),
  period_start date not null,
  product_id uuid not null references public.products(id) on delete restrict,
  initial_quantity numeric(14,3) not null default 0 check (initial_quantity >= 0),
  edited_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(project_id,period_type,period_start,product_id)
);
create index if not exists idx_period_initials on public.period_initials(project_id,period_type,period_start);

alter table public.period_initials enable row level security;
drop policy if exists period_initials_member_read on public.period_initials;
create policy period_initials_member_read on public.period_initials for select using (public.is_member(project_id));
drop policy if exists period_initials_manager_write on public.period_initials;
create policy period_initials_manager_write on public.period_initials for all using (public.is_manager(project_id)) with check (public.is_manager(project_id) and edited_by=auth.uid());


create table if not exists public.monthly_usage_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  month_start date not null,
  product_id uuid not null references public.products(id) on delete restrict,
  week_number integer not null check (week_number between 1 and 4),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  edited_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(project_id,month_start,product_id,week_number)
);
alter table public.monthly_usage_overrides enable row level security;
drop policy if exists monthly_override_manager_all on public.monthly_usage_overrides;
create policy monthly_override_manager_all on public.monthly_usage_overrides for all
using (public.is_manager(project_id))
with check (public.is_manager(project_id) and edited_by=auth.uid());
drop policy if exists monthly_override_member_read on public.monthly_usage_overrides;
create policy monthly_override_member_read on public.monthly_usage_overrides for select
using (public.is_member(project_id));

-- RLS
alter table public.companies enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.project_memberships enable row level security;
alter table public.products enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_usage enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists companies_member_read on public.companies;
create policy companies_member_read on public.companies for select
using (exists (
  select 1 from public.projects pr
  join public.project_memberships pm on pm.project_id = pr.id
  where pr.company_id = companies.id and pm.user_id = auth.uid()
));

drop policy if exists projects_member_read on public.projects;
create policy projects_member_read on public.projects for select
using (public.is_member(id));

drop policy if exists projects_manager_write on public.projects;
create policy projects_manager_write on public.projects for all
using (public.is_manager(id)) with check (public.is_manager(id));

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1 from public.project_memberships pm
    where pm.user_id = profiles.id
      and public.is_manager(pm.project_id)
  )
);

drop policy if exists profiles_manager_write on public.profiles;
create policy profiles_manager_write on public.profiles for all
using (
  id = auth.uid()
  or exists (
    select 1 from public.project_memberships pm
    where pm.user_id = profiles.id
      and public.is_manager(pm.project_id)
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1 from public.project_memberships pm
    where pm.user_id = profiles.id
      and public.is_manager(pm.project_id)
  )
);

drop policy if exists memberships_read on public.project_memberships;
create policy memberships_read on public.project_memberships for select
using (user_id = auth.uid() or public.is_manager(project_id));

drop policy if exists memberships_manager_write on public.project_memberships;
create policy memberships_manager_write on public.project_memberships for all
using (public.is_manager(project_id))
with check (public.is_manager(project_id));

drop policy if exists products_member_read on public.products;
create policy products_member_read on public.products for select using (public.is_member(project_id));

drop policy if exists products_manager_write on public.products;
create policy products_manager_write on public.products for all
using (public.is_manager(project_id))
with check (public.is_manager(project_id));

drop policy if exists assignments_member_read on public.staff_assignments;
create policy assignments_member_read on public.staff_assignments for select using (public.is_member(project_id));

drop policy if exists assignments_manager_write on public.staff_assignments;
create policy assignments_manager_write on public.staff_assignments for all
using (public.is_manager(project_id))
with check (public.is_manager(project_id));

drop policy if exists reports_member_read on public.daily_reports;
create policy reports_member_read on public.daily_reports for select using (public.is_manager(project_id));

drop policy if exists reports_staff_insert on public.daily_reports;
create policy reports_staff_insert on public.daily_reports for insert
with check (
  public.is_member(project_id)
  and submitted_by = auth.uid()
  and extract(dow from report_date) <> 5
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true)
);

drop policy if exists reports_manager_write on public.daily_reports;
create policy reports_manager_write on public.daily_reports for update
using (public.is_manager(project_id))
with check (public.is_manager(project_id));

drop policy if exists usage_member_read on public.daily_usage;
create policy usage_member_read on public.daily_usage for select
using (exists (
  select 1 from public.daily_reports r
  where r.id = daily_usage.report_id and public.is_manager(r.project_id)
));

drop policy if exists usage_staff_insert on public.daily_usage;
create policy usage_staff_insert on public.daily_usage for insert
with check (exists (
  select 1 from public.daily_reports r
  where r.id = daily_usage.report_id and public.is_member(r.project_id)
));

drop policy if exists usage_manager_write on public.daily_usage;
create policy usage_manager_write on public.daily_usage for update
using (exists (
  select 1 from public.daily_reports r where r.id=daily_usage.report_id and public.is_manager(r.project_id)
))
with check (exists (
  select 1 from public.daily_reports r where r.id=daily_usage.report_id and public.is_manager(r.project_id)
));

drop policy if exists adjustments_manager_all on public.stock_adjustments;
create policy adjustments_manager_all on public.stock_adjustments for all
using (public.is_manager(project_id))
with check (public.is_manager(project_id) and created_by = auth.uid());

drop policy if exists audit_manager_read on public.audit_logs;
create policy audit_manager_read on public.audit_logs for select using (public.is_manager(project_id));

drop policy if exists audit_manager_insert on public.audit_logs;
create policy audit_manager_insert on public.audit_logs for insert with check (public.is_manager(project_id) and actor_id=auth.uid());

-- Secure helper to get a user's role.
create or replace function public.my_profile()
returns table (
  id uuid,
  full_name text,
  username text,
  role public.app_role,
  active boolean
)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,p.full_name,p.username,p.role,p.active
  from public.profiles p
  where p.id=auth.uid();
$$;

-- Secure helper for project membership selection.
create or replace function public.my_projects()
returns table (
  id uuid,
  name text,
  company_id uuid,
  company_name text
)
language sql
stable
security definer
set search_path=public
as $$
  select pr.id,pr.name,pr.company_id,c.name
  from public.projects pr
  join public.companies c on c.id=pr.company_id
  join public.project_memberships pm on pm.project_id=pr.id
  where pm.user_id=auth.uid() and pr.active=true;
$$;

-- Seed the checklist products. These are intentionally marked as a legacy import
-- so the first Admin can verify the handwritten quantities before activating them.
insert into public.companies(name)
select 'Legacy Checklist Company'
where not exists (select 1 from public.companies where name='Legacy Checklist Company');

insert into public.projects(company_id,name)
select c.id,'Legacy Checklist Project'
from public.companies c
where c.name='Legacy Checklist Company'
and not exists (
  select 1 from public.projects p where p.company_id=c.id and p.name='Legacy Checklist Project'
);

-- Product seed is completed by the optional import CSV in /public/data/legacy_products.csv
-- after the first project is created and authenticated.


-- First-account bootstrap. Run the whole schema before using the setup screen.
create or replace function public.bootstrap_super_admin(
  p_user_id uuid,
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
  c_id uuid;
  pr_id uuid;
begin
  if exists (select 1 from public.profiles limit 1) then
    raise exception 'Super Admin setup has already been completed';
  end if;

  insert into public.profiles(id,full_name,username,role,active)
  values(p_user_id,p_full_name,p_username,'super_admin',true);

  insert into public.companies(name) values(p_company_name) returning id into c_id;
  insert into public.projects(company_id,name) values(c_id,p_project_name) returning id into pr_id;
  insert into public.project_memberships(project_id,user_id) values(pr_id,p_user_id);

  return pr_id;
end;
$$;

revoke all on function public.bootstrap_super_admin(uuid,text,text,text,text) from public;
grant execute on function public.bootstrap_super_admin(uuid,text,text,text,text) to authenticated;


create or replace function public.my_submission_status(p_project_id uuid, p_report_date date)
returns table (submitted boolean, submitted_at timestamptz)
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.daily_reports
    where project_id=p_project_id and report_date=p_report_date and submitted_by=auth.uid()
  ) as submitted,
  (select r.submitted_at from public.daily_reports r
   where r.project_id=p_project_id and r.report_date=p_report_date and r.submitted_by=auth.uid()
   limit 1) as submitted_at;
$$;
revoke all on function public.my_submission_status(uuid,date) from public;
grant execute on function public.my_submission_status(uuid,date) to authenticated;


create or replace function public.create_project(p_company_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_id uuid;
begin
  if not exists (
    select 1 from public.project_memberships pm
    join public.projects pr on pr.id=pm.project_id
    join public.profiles p on p.id=pm.user_id
    where pm.user_id=auth.uid() and pr.company_id=p_company_id and p.role in ('admin','super_admin') and p.active=true
  ) then
    raise exception 'Not authorized to create a project for this company';
  end if;
  insert into public.projects(company_id,name) values(p_company_id,p_name) returning id into new_id;
  insert into public.project_memberships(project_id,user_id) values(new_id,auth.uid());
  insert into public.audit_logs(project_id,actor_id,action,entity_type,entity_id,details)
  values(new_id,auth.uid(),'project.created','project',new_id,jsonb_build_object('name',p_name));
  return new_id;
end;
$$;
revoke all on function public.create_project(uuid,text) from public;
grant execute on function public.create_project(uuid,text) to authenticated;
