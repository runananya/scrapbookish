-- ─────────────────────────────────────────────
-- scrapbook · migration 007 · ai-generated invitation background
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────

alter table public.plans
  add column if not exists bg_image_url text;
