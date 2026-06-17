-- ─────────────────────────────────────────────
-- scrapbook · migration 012 · easier friend-making
--
-- create_friendship(friend_user_id) — SECURITY DEFINER RPC that:
--   1. Verifies caller and target are different
--   2. Checks they aren't already friends (sharing any group)
--   3. Creates a 1-on-1 group named "{me} & {them}"
--   4. Auto-adds both users (the trigger adds me; the function adds the friend
--      with security-definer privileges, bypassing the RLS check that would
--      otherwise prevent adding someone else)
-- ─────────────────────────────────────────────

create or replace function public.create_friendship(friend_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  new_group_id uuid;
  my_name text;
  their_name text;
  group_name text;
begin
  me := auth.uid();

  if me is null then
    raise exception 'not authenticated';
  end if;

  if me = friend_user_id then
    raise exception 'cannot friend yourself';
  end if;

  -- Verify the friend exists
  if not exists (select 1 from public.profiles where id = friend_user_id) then
    raise exception 'profile not found';
  end if;

  -- Already friends? (share any group)
  if exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = me and gm2.user_id = friend_user_id
  ) then
    raise exception 'already friends';
  end if;

  -- Build a friendly group name
  select display_name into my_name    from public.profiles where id = me;
  select display_name into their_name from public.profiles where id = friend_user_id;
  group_name := coalesce(my_name, 'friend') || ' & ' || coalesce(their_name, 'friend');

  -- Create the group — handle_new_group trigger adds me as admin
  insert into public.groups (name, created_by)
  values (group_name, me)
  returning id into new_group_id;

  -- Add the friend (security definer bypasses the "can only add self" RLS)
  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, friend_user_id, 'member');

  return new_group_id;
end;
$$;

grant execute on function public.create_friendship(uuid) to authenticated;
