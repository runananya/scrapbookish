-- ─────────────────────────────────────────────
-- scrapbook · migration 013 · tighten privacy on places + comments
--
-- BEFORE: places were "viewable by everyone" — any logged-in user could read
-- any place row including photos, location, review text, decorations. That
-- doesn't match the friends-only social model.
--
-- AFTER: a place is visible only to its owner OR users who share at least one
-- group with the owner (i.e. "friends"). Comments cascade — you can read
-- comments only if you can read the place.
--
-- Other tables we considered:
-- - groups stay readable by all authenticated users so group invite-link
--   landing pages can show the group name. Group names aren't sensitive;
--   actual membership and shared places are.
-- - group_members, group_places, plans, plan_attendees, recommendations are
--   already member-only via existing RLS.
-- - profiles stay readable so friend-link landing pages can show the
--   inviter's name + avatar.
-- ─────────────────────────────────────────────

-- Helper: does the viewer share at least one group with the other user?
-- SECURITY DEFINER so it can read group_members without recursive RLS issues.
create or replace function public.shares_group_with(_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
      and gm2.user_id = _other_user_id
  );
$$;

grant execute on function public.shares_group_with(uuid) to authenticated;

-- ─── places ─────────────────────────────────
-- Replace the "viewable by everyone" policy with friends-only visibility.
drop policy if exists "places are viewable by everyone"  on public.places;
drop policy if exists "places visible to owner and friends" on public.places;

create policy "places visible to owner and friends"
  on public.places for select to authenticated
  using (
    user_id = auth.uid()
    or public.shares_group_with(user_id)
  );

-- Anonymous (logged-out) users no longer get any place data
revoke select on public.places from anon;

-- ─── place_comments ────────────────────────
-- Tighten: you can read a comment only if you can read its place.
drop policy if exists "anyone authenticated can read comments" on public.place_comments;
drop policy if exists "comments visible if place visible" on public.place_comments;

create policy "comments visible if place visible"
  on public.place_comments for select to authenticated
  using (
    exists (
      select 1 from public.places p
      where p.id = place_comments.place_id
        and (p.user_id = auth.uid() or public.shares_group_with(p.user_id))
    )
  );
