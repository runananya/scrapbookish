-- ─────────────────────────────────────────────
-- scrapbook · migration 010 · decorations on places
-- Cute stickers + text overlays drawn on top of each place page.
-- Stored as a JSONB array: { id, type, emoji|content, x%, y%, rotation, size, color }
-- ─────────────────────────────────────────────

alter table public.places
  add column if not exists decorations jsonb not null default '[]'::jsonb;
