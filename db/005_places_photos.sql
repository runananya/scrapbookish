-- ─────────────────────────────────────────────
-- scrapbook · migration 005 · multi-photo support
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

-- Store the original photos as an array; photo_url stays as the
-- collage thumbnail used in cards and map popups.
alter table public.places
  add column if not exists photos text[];
