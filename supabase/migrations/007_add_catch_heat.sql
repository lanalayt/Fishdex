-- Add the "heat" rating to catches: how well a fly produced on a trip.
-- Replaces entering a fish count. Values: 'hot' | 'mild' | 'cold'.
-- Existing rows keep their count; the app reads a count > 0 as "hot".
ALTER TABLE catches ADD COLUMN IF NOT EXISTS heat TEXT;
