-- ─────────────────────────────────────────────
-- scrapbook · migration 001 · profiles
-- Paste this into Supabase SQL Editor and click Run.
-- Safe to re-run: uses "if not exists" where possible.
-- ─────────────────────────────────────────────

-- 1. profiles table, linked 1:1 to auth.users
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- 2. row-level security — only YOU can edit your row
alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone"   on public.profiles;
drop policy if exists "users can insert their own profile"  on public.profiles;
drop policy if exists "users can update their own profile"  on public.profiles;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 3. trigger: auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
