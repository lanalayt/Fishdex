-- Fix data privacy: remove overly permissive policies that were manually
-- created in the Supabase dashboard, allowing any authenticated user to
-- see all data. After this migration, users only see data they created
-- or data shared via their group.

-- Drop leaky manually-created policies on rivers
DROP POLICY IF EXISTS "Group members can view rivers" ON rivers;
DROP POLICY IF EXISTS "Group members can update rivers" ON rivers;
DROP POLICY IF EXISTS "read_rivers" ON rivers;
DROP POLICY IF EXISTS "insert_rivers" ON rivers;
DROP POLICY IF EXISTS "update_rivers" ON rivers;

-- Drop leaky manually-created policies on trips
DROP POLICY IF EXISTS "read_trips" ON trips;
DROP POLICY IF EXISTS "insert_trips" ON trips;
DROP POLICY IF EXISTS "update_own_trips" ON trips;
DROP POLICY IF EXISTS "delete_trips" ON trips;

-- Drop leaky manually-created policies on catches
DROP POLICY IF EXISTS "read_catches" ON catches;
DROP POLICY IF EXISTS "insert_catches" ON catches;
DROP POLICY IF EXISTS "update_catches" ON catches;
DROP POLICY IF EXISTS "delete_catches" ON catches;

-- Drop leaky manually-created policies on fly_shop_advice
DROP POLICY IF EXISTS "read_advice" ON fly_shop_advice;
DROP POLICY IF EXISTS "insert_advice" ON fly_shop_advice;
DROP POLICY IF EXISTS "update_advice" ON fly_shop_advice;
DROP POLICY IF EXISTS "delete_advice" ON fly_shop_advice;

-- Correct rivers policies: owner or group members only
CREATE POLICY "Users can view own or group rivers"
  ON rivers FOR SELECT
  USING (
    created_by = auth.uid()
    OR (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own or group rivers"
  ON rivers FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own rivers"
  ON rivers FOR DELETE
  USING (created_by = auth.uid());
