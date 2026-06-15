-- ─────────────────────────────────────────────
-- scrapbook · migration 004 · groups (friends)
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

-- 1. tables
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members(user_id);

create table if not exists public.group_places (
  group_id   uuid not null references public.groups(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  note       text,
  primary key (group_id, place_id)
);

create index if not exists group_places_group_idx on public.group_places(group_id);

-- 2. helper function to break the RLS recursion problem
-- (Checking "is X a member of group Y" inside group_members RLS would recurse.)
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
  );
$$;

-- 3. trigger: auto-add creator as admin
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- 4. RLS — groups
alter table public.groups enable row level security;

drop policy if exists "authenticated users can view groups" on public.groups;
drop policy if exists "users can create groups"            on public.groups;
drop policy if exists "creators can update their groups"   on public.groups;
drop policy if exists "creators can delete their groups"   on public.groups;

-- group rows are minimally identifying (just a name); leave readable to
-- authenticated users so the join page can show "you're joining: X"
create policy "authenticated users can view groups"
  on public.groups for select to authenticated using (true);

create policy "users can create groups"
  on public.groups for insert to authenticated
  with check (auth.uid() = created_by);

create policy "creators can update their groups"
  on public.groups for update to authenticated
  using (auth.uid() = created_by);

create policy "creators can delete their groups"
  on public.groups for delete to authenticated
  using (auth.uid() = created_by);

-- 5. RLS — group_members
alter table public.group_members enable row level security;

drop policy if exists "members can see members of their groups" on public.group_members;
drop policy if exists "users can join groups"                   on public.group_members;
drop policy if exists "users can leave groups"                  on public.group_members;

create policy "members can see members of their groups"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- Anyone with the (unguessable) group UUID can add themselves as a member.
-- They can only add themselves (user_id must be auth.uid()).
create policy "users can join groups"
  on public.group_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "users can leave groups"
  on public.group_members for delete to authenticated
  using (user_id = auth.uid());

-- 6. RLS — group_places
alter table public.group_places enable row level security;

drop policy if exists "members can see shared places" on public.group_places;
drop policy if exists "members can share places"     on public.group_places;
drop policy if exists "users can unshare what they shared" on public.group_places;

create policy "members can see shared places"
  on public.group_places for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

create policy "members can share places"
  on public.group_places for insert to authenticated
  with check (
    added_by = auth.uid()
    and public.is_group_member(group_id, auth.uid())
  );

create policy "users can unshare what they shared"
  on public.group_places for delete to authenticated
  using (added_by = auth.uid());
