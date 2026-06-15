-- ─────────────────────────────────────────────
-- scrapbook · migration 003 · coordinates for places
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

alter table public.places
  add column if not exists lat numeric(9, 6),
  add column if not exists lng numeric(9, 6);

create index if not exists places_coords_idx
  on public.places(lat, lng)
  where lat is not null and lng is not null;
