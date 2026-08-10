-- Row Level Security Policies
-- Users can only see/edit data within their groups

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fly_shop_advice ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read any profile in their groups, edit their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can view group members profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT gm2.user_id FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
    )
  );

-- Groups: members can view their groups
CREATE POLICY "Members can view their groups"
  ON groups FOR SELECT
  USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update their groups"
  ON groups FOR UPDATE
  USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Group members: visible to group members
CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage group members"
  ON group_members FOR ALL
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Rivers: visible and editable by group members
CREATE POLICY "Group members can view rivers"
  ON rivers FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR group_id IS NULL
  );

CREATE POLICY "Group members can create rivers"
  ON rivers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group members can update rivers"
  ON rivers FOR UPDATE
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

-- Trips: visible to group members
CREATE POLICY "Group members can view trips"
  ON trips FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can create trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (user_id = auth.uid());

-- Catches: follow trip access
CREATE POLICY "Users can view catches for accessible trips"
  ON catches FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
        OR user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage catches on own trips"
  ON catches FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

-- Fly shop advice: follow trip access
CREATE POLICY "Users can view advice for accessible trips"
  ON fly_shop_advice FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
        OR user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage advice on own trips"
  ON fly_shop_advice FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );
