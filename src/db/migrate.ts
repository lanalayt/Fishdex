import { Platform } from 'react-native';
import { expo } from './client';

// Run migrations manually since we're not using drizzle-kit push for mobile
// This creates tables if they don't exist
export function runMigrations() {
  if (Platform.OS === 'web' || !expo) return;
  expo.execSync(`
    CREATE TABLE IF NOT EXISTS rivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT,
      state TEXT,
      notes TEXT,
      group_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      is_deleted INTEGER DEFAULT 0
    );
  `);

  expo.execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      river_id TEXT NOT NULL REFERENCES rivers(id),
      group_id TEXT,
      user_id TEXT,
      date TEXT NOT NULL,
      location_on_river TEXT,
      weather TEXT,
      temperature TEXT,
      flow_cfs INTEGER,
      leader_length TEXT,
      tippet_size TEXT,
      latitude TEXT,
      longitude TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      is_deleted INTEGER DEFAULT 0
    );
  `);

  expo.execSync(`
    CREATE TABLE IF NOT EXISTS catches (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id),
      fly_pattern TEXT NOT NULL,
      fly_size TEXT,
      fly_color TEXT,
      heat TEXT,
      count INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      is_deleted INTEGER DEFAULT 0
    );
  `);

  expo.execSync(`
    CREATE TABLE IF NOT EXISTS fly_shop_advice (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id),
      shop_name TEXT NOT NULL,
      advice TEXT,
      recommended_flies TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      is_deleted INTEGER DEFAULT 0
    );
  `);

  expo.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT
    );
  `);

  // Indexes for common queries
  expo.execSync(`CREATE INDEX IF NOT EXISTS idx_trips_river_id ON trips(river_id);`);
  expo.execSync(`CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);`);
  expo.execSync(`CREATE INDEX IF NOT EXISTS idx_catches_trip_id ON catches(trip_id);`);
  expo.execSync(`CREATE INDEX IF NOT EXISTS idx_fly_shop_advice_trip_id ON fly_shop_advice(trip_id);`);

  // Migration: add columns that may not exist on older installs
  try { expo.execSync(`ALTER TABLE trips ADD COLUMN temperature TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE trips ADD COLUMN leader_length TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE trips ADD COLUMN tippet_size TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE trips ADD COLUMN latitude TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE trips ADD COLUMN longitude TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE catches ADD COLUMN fly_color TEXT;`); } catch {}
  try { expo.execSync(`ALTER TABLE catches ADD COLUMN heat TEXT;`); } catch {}
}
