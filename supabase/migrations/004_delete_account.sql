-- Account deletion RPC
-- Deletes all of the calling user's personal data and their auth account.
-- Group-shared data (rivers referenced by other members' trips, groups with
-- other members) is preserved; the user's authorship is nulled out.

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS VOID AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's trips (catches and fly_shop_advice cascade)
  DELETE FROM trips WHERE user_id = uid;

  -- Null out authorship on rivers so group data survives
  UPDATE rivers SET created_by = NULL WHERE created_by = uid;

  -- Remove user from any groups
  DELETE FROM group_members WHERE user_id = uid;

  -- Null out group authorship
  UPDATE groups SET created_by = NULL WHERE created_by = uid;

  -- Delete profile (explicit; also cascades from auth.users delete)
  DELETE FROM profiles WHERE id = uid;

  -- Finally, delete the auth user
  DELETE FROM auth.users WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.delete_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
