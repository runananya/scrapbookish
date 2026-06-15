-- ─────────────────────────────────────────────
-- scrapbook · migration 006 · plans (group events)
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────


-- 1. plans table
create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  title            text not null,
  description      text,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  location_name    text,
  location_address text,
  lat              numeric(9, 6),
  lng              numeric(9, 6),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists plans_group_idx  on public.plans(group_id);
create index if not exists plans_starts_idx on public.plans(starts_at);

-- 2. plan_attendees — supports both existing users and external emails
create table if not exists public.plan_attendees (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans(id) on delete cascade,
  email        text not null,
  user_id      uuid references auth.users(id) on delete set null,
  rsvp_status  text not null default 'pending' check (rsvp_status in ('pending', 'yes', 'no', 'maybe')),
  invited_at   timestamptz not null default now(),
  unique (plan_id, email)
);

create index if not exists plan_attendees_plan_idx on public.plan_attendees(plan_id);

-- 3. RLS — plans
alter table public.plans enable row level security;

drop policy if exists "group members can view plans"   on public.plans;
drop policy if exists "group members can create plans" on public.plans;
drop policy if exists "creators can update plans"      on public.plans;
drop policy if exists "creators can delete plans"      on public.plans;

create policy "group members can view plans"
  on public.plans for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

create policy "group members can create plans"
  on public.plans for insert to authenticated
  with check (
    public.is_group_member(group_id, auth.uid())
    and auth.uid() = created_by
  );

create policy "creators can update plans"
  on public.plans for update to authenticated
  using (auth.uid() = created_by);

create policy "creators can delete plans"
  on public.plans for delete to authenticated
  using (auth.uid() = created_by);

-- 4. RLS — plan_attendees
alter table public.plan_attendees enable row level security;

drop policy if exists "group members can see attendees"      on public.plan_attendees;
drop policy if exists "group members can invite attendees"   on public.plan_attendees;
drop policy if exists "creators can remove attendees"        on public.plan_attendees;
drop policy if exists "attendees can update their rsvp"      on public.plan_attendees;

create policy "group members can see attendees"
  on public.plan_attendees for select to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_attendees.plan_id
        and public.is_group_member(p.group_id, auth.uid())
    )
  );

create policy "group members can invite attendees"
  on public.plan_attendees for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
      where p.id = plan_attendees.plan_id
        and public.is_group_member(p.group_id, auth.uid())
    )
  );

create policy "creators can remove attendees"
  on public.plan_attendees for delete to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_attendees.plan_id
        and p.created_by = auth.uid()
    )
  );

create policy "attendees can update their rsvp"
  on public.plan_attendees for update to authenticated
  using (user_id = auth.uid());
