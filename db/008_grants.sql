-- ─────────────────────────────────────────────
-- scrapbook · migration 008 · table & function grants
--
-- Fixes "permission denied for table X" errors when authenticated users
-- try to insert/update/delete. Postgres requires both a GRANT (table-level
-- permission) AND an RLS policy that allows the row. The policies were
-- correct; this migration adds the missing grants.
-- ─────────────────────────────────────────────

-- schema usage (Supabase usually has this; included for safety)
grant usage on schema public to anon, authenticated;

-- profiles: public read, owner-only write
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

-- places: public read (so non-members can view shared recs), owner-only write
grant select on public.places to anon;
grant select, insert, update, delete on public.places to authenticated;

-- groups + memberships + shared places: members only (RLS handles who)
grant select, insert, update, delete on public.groups        to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_places  to authenticated;

-- plans + attendees: group members (RLS handles who)
grant select, insert, update, delete on public.plans          to authenticated;
grant select, insert, update, delete on public.plan_attendees to authenticated;

-- helper function called from inside RLS policies — needs EXECUTE for the
-- evaluating user
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

-- (handle_new_user + handle_new_group are SECURITY DEFINER triggers, run
-- as the function owner — no GRANT needed for them)
