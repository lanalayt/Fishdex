-- Fix infinite recursion in RLS policies
-- The profiles policy was referencing group_members which referenced profiles

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view group members profiles" ON profiles;
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Admins can manage group members" ON group_members;

-- Recreate without circular references
CREATE POLICY "Users can view profiles in their groups"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT gm.user_id FROM group_members gm
      WHERE gm.group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own group membership"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete group members"
  ON group_members FOR DELETE
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
