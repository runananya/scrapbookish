-- ─────────────────────────────────────────────
-- scrapbook · migration 009 · friend-to-friend recommendations
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

create table if not exists public.recommendations (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  from_user_id  uuid not null references auth.users(id) on delete cascade,
  to_user_id    uuid not null references auth.users(id) on delete cascade,
  note          text,
  status        text not null default 'pending' check (status in ('pending', 'added', 'dismissed')),
  created_at    timestamptz not null default now(),
  unique (place_id, from_user_id, to_user_id)
);

create index if not exists recs_recipient_idx on public.recommendations(to_user_id, status);
create index if not exists recs_sender_idx    on public.recommendations(from_user_id);

alter table public.recommendations enable row level security;

drop policy if exists "recipient and sender can view recs"   on public.recommendations;
drop policy if exists "users can send recs"                  on public.recommendations;
drop policy if exists "recipient can update their own recs"  on public.recommendations;
drop policy if exists "recipient can delete their own recs"  on public.recommendations;

create policy "recipient and sender can view recs"
  on public.recommendations for select to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "users can send recs"
  on public.recommendations for insert to authenticated
  with check (auth.uid() = from_user_id);

create policy "recipient can update their own recs"
  on public.recommendations for update to authenticated
  using (auth.uid() = to_user_id);

create policy "recipient can delete their own recs"
  on public.recommendations for delete to authenticated
  using (auth.uid() = to_user_id);

grant select, insert, update, delete on public.recommendations to authenticated;
