-- Add missing columns to rivers table that the app expects
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS usgs_site_id TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS usgs_site_name TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS gauge_source TEXT DEFAULT 'usgs';
