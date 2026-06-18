-- ─────────────────────────────────────────────
-- scrapbook · migration 014 · lock profiles from anonymous reads
--
-- BEFORE: anon role could SELECT from profiles. Anyone with the public
-- anon key (which is embedded in our client JS bundle) could scrape
-- all profiles by hitting /rest/v1/profiles?select=* without logging in.
--
-- AFTER: anon SELECT revoked. Profiles are still readable to ALL authenticated
-- users (needed for friend-link / group-invite landing pages that show the
-- inviter's name + avatar). If we want to further tighten to "friends only"
-- we'd need a SECURITY DEFINER function for the invite-landing exceptions.
-- ─────────────────────────────────────────────

-- Drop the policy that explicitly allows anon, then revoke the table grant.
drop policy if exists "profiles are viewable by everyone" on public.profiles;

create policy "authenticated users can view profiles"
  on public.profiles for select to authenticated
  using (true);

revoke select on public.profiles from anon;
