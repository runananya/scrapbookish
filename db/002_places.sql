-- ─────────────────────────────────────────────
-- scrapbook · migration 002 · places + photo storage
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

-- 1. places table
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  location    text,
  photo_url   text,
  rating      smallint check (rating is null or (rating between 1 and 5)),
  review      text,
  status      text not null check (status in ('visited', 'wishlist', 'recommended')),
  created_at  timestamptz not null default now()
);

create index if not exists places_user_id_idx    on public.places(user_id);
create index if not exists places_created_at_idx on public.places(created_at desc);

-- 2. row-level security
alter table public.places enable row level security;

drop policy if exists "places are viewable by everyone"  on public.places;
drop policy if exists "users can insert their own places" on public.places;
drop policy if exists "users can update their own places" on public.places;
drop policy if exists "users can delete their own places" on public.places;

create policy "places are viewable by everyone"
  on public.places for select using (true);

create policy "users can insert their own places"
  on public.places for insert with check (auth.uid() = user_id);

create policy "users can update their own places"
  on public.places for update using (auth.uid() = user_id);

create policy "users can delete their own places"
  on public.places for delete using (auth.uid() = user_id);

-- 3. storage bucket for place photos
insert into storage.buckets (id, name, public)
  values ('place-photos', 'place-photos', true)
  on conflict (id) do nothing;

drop policy if exists "anyone can view place photos"      on storage.objects;
drop policy if exists "users can upload their own photos" on storage.objects;
drop policy if exists "users can delete their own photos" on storage.objects;

create policy "anyone can view place photos"
  on storage.objects for select
  using (bucket_id = 'place-photos');

create policy "users can upload their own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'place-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete their own photos"
  on storage.objects for delete
  using (
    bucket_id = 'place-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
