-- ─────────────────────────────────────────────
-- scrapbook · migration 011 · place comments (friend notes)
-- Comments friends can leave on each other's scrapbook entries.
-- ─────────────────────────────────────────────

create table if not exists public.place_comments (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists place_comments_place_idx on public.place_comments(place_id, created_at desc);

alter table public.place_comments enable row level security;

drop policy if exists "anyone authenticated can read comments" on public.place_comments;
drop policy if exists "users can leave comments"               on public.place_comments;
drop policy if exists "users can edit their own comments"     on public.place_comments;
drop policy if exists "users can delete their own comments"   on public.place_comments;

create policy "anyone authenticated can read comments"
  on public.place_comments for select to authenticated using (true);

create policy "users can leave comments"
  on public.place_comments for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can edit their own comments"
  on public.place_comments for update to authenticated
  using (auth.uid() = user_id);

create policy "users can delete their own comments"
  on public.place_comments for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.place_comments to authenticated;
