import { Platform } from 'react-native';
import { supabase } from '../supabase/client';
import { SUPABASE_ENABLED } from '../supabase/config';

// Helper to bypass strict typing until we generate Supabase types
const sb = () => supabase as any;
import { db } from '../db/client';
import { trips, rivers, catches, flyShopAdvice } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'fishdex_last_sync';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';

let currentStatus: SyncStatus = SUPABASE_ENABLED ? 'idle' : 'disabled';
const listeners: Set<(status: SyncStatus) => void> = new Set();

function setStatus(s: SyncStatus) {
  currentStatus = s;
  listeners.forEach((fn) => fn(s));
}

export function getSyncStatus() { return currentStatus; }
export function onSyncStatusChange(fn: (status: SyncStatus) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Push unsynced local records to Supabase
async function pushRecords() {
  if (!supabase || Platform.OS === 'web') return;

  const { data: { user } } = await sb().auth.getUser();
  if (!user) return;

  // Push unsynced rivers
  const unsyncedRivers = db.select().from(rivers)
    .where(isNull(rivers.syncedAt))
    .all();

  for (const river of unsyncedRivers) {
    if (river.isDeleted) continue;
    const { error } = await sb().from('rivers').upsert({
      id: river.id,
      name: river.name,
      region: river.region,
      state: river.state,
      notes: river.notes,
      group_id: river.groupId,
      created_by: user.id,
      created_at: river.createdAt,
      updated_at: river.updatedAt,
      is_deleted: !!river.isDeleted,
    });

    if (!error) {
      db.update(rivers)
        .set({ syncedAt: new Date().toISOString() })
        .where(eq(rivers.id, river.id))
        .run();
    }
  }

  // Push unsynced trips
  const unsyncedTrips = db.select().from(trips)
    .where(isNull(trips.syncedAt))
    .all();

  for (const trip of unsyncedTrips) {
    if (trip.isDeleted) continue;
    const { error } = await sb().from('trips').upsert({
      id: trip.id,
      river_id: trip.riverId,
      group_id: trip.groupId,
      user_id: user.id,
      date: trip.date,
      location_on_river: trip.locationOnRiver,
      weather: trip.weather,
      flow_cfs: trip.flowCfs,
      leader_length: trip.leaderLength,
      tippet_size: trip.tippetSize,
      latitude: trip.latitude ? parseFloat(trip.latitude) : null,
      longitude: trip.longitude ? parseFloat(trip.longitude) : null,
      notes: trip.notes,
      created_at: trip.createdAt,
      updated_at: trip.updatedAt,
      is_deleted: !!trip.isDeleted,
    });

    if (!error) {
      db.update(trips)
        .set({ syncedAt: new Date().toISOString() })
        .where(eq(trips.id, trip.id))
        .run();
    }
  }

  // Push unsynced catches
  const unsyncedCatches = db.select().from(catches)
    .where(isNull(catches.syncedAt))
    .all();

  for (const c of unsyncedCatches) {
    if (c.isDeleted) continue;
    const { error } = await sb().from('catches').upsert({
      id: c.id,
      trip_id: c.tripId,
      fly_pattern: c.flyPattern,
      fly_size: c.flySize,
      fly_color: c.flyColor,
      heat: c.heat,
      count: c.count,
      notes: c.notes,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      is_deleted: !!c.isDeleted,
    });

    if (!error) {
      db.update(catches)
        .set({ syncedAt: new Date().toISOString() })
        .where(eq(catches.id, c.id))
        .run();
    }
  }

  // Push unsynced fly shop advice
  const unsyncedAdvice = db.select().from(flyShopAdvice)
    .where(isNull(flyShopAdvice.syncedAt))
    .all();

  for (const a of unsyncedAdvice) {
    if (a.isDeleted) continue;
    const { error } = await sb().from('fly_shop_advice').upsert({
      id: a.id,
      trip_id: a.tripId,
      shop_name: a.shopName,
      advice: a.advice,
      recommended_flies: a.recommendedFlies,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
      is_deleted: !!a.isDeleted,
    });

    if (!error) {
      db.update(flyShopAdvice)
        .set({ syncedAt: new Date().toISOString() })
        .where(eq(flyShopAdvice.id, a.id))
        .run();
    }
  }
}

// Pull records from Supabase that are newer than our last sync
async function pullRecords() {
  if (!supabase || Platform.OS === 'web') return;

  const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const since = lastSync || '2000-01-01T00:00:00Z';

  const { data: { user } } = await sb().auth.getUser();
  if (!user) return;

  // Pull rivers
  const { data: remoteRivers } = await sb()
    .from('rivers')
    .select('*')
    .gte('updated_at', since);

  if (remoteRivers) {
    for (const r of remoteRivers) {
      const existing = db.select().from(rivers).where(eq(rivers.id, r.id)).get();
      if (!existing) {
        db.insert(rivers).values({
          id: r.id,
          name: r.name,
          region: r.region,
          state: r.state,
          notes: r.notes,
          groupId: r.group_id,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: r.is_deleted ? 1 : 0,
        }).run();
      } else if (new Date(r.updated_at) > new Date(existing.updatedAt)) {
        db.update(rivers).set({
          name: r.name,
          region: r.region,
          state: r.state,
          notes: r.notes,
          updatedAt: r.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: r.is_deleted ? 1 : 0,
        }).where(eq(rivers.id, r.id)).run();
      }
    }
  }

  // Pull trips
  const { data: remoteTrips } = await sb()
    .from('trips')
    .select('*')
    .gte('updated_at', since);

  if (remoteTrips) {
    for (const t of remoteTrips) {
      const existing = db.select().from(trips).where(eq(trips.id, t.id)).get();
      if (!existing) {
        db.insert(trips).values({
          id: t.id,
          riverId: t.river_id,
          groupId: t.group_id,
          userId: t.user_id,
          date: t.date,
          locationOnRiver: t.location_on_river,
          weather: t.weather,
          flowCfs: t.flow_cfs,
          leaderLength: t.leader_length,
          tippetSize: t.tippet_size,
          latitude: t.latitude ? String(t.latitude) : null,
          longitude: t.longitude ? String(t.longitude) : null,
          notes: t.notes,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: t.is_deleted ? 1 : 0,
        }).run();
      } else if (new Date(t.updated_at) > new Date(existing.updatedAt)) {
        db.update(trips).set({
          locationOnRiver: t.location_on_river,
          weather: t.weather,
          flowCfs: t.flow_cfs,
          leaderLength: t.leader_length,
          tippetSize: t.tippet_size,
          latitude: t.latitude ? String(t.latitude) : null,
          longitude: t.longitude ? String(t.longitude) : null,
          notes: t.notes,
          updatedAt: t.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: t.is_deleted ? 1 : 0,
        }).where(eq(trips.id, t.id)).run();
      }
    }
  }

  // Pull catches
  const { data: remoteCatches } = await sb()
    .from('catches')
    .select('*')
    .gte('updated_at', since);

  if (remoteCatches) {
    for (const c of remoteCatches) {
      const existing = db.select().from(catches).where(eq(catches.id, c.id)).get();
      if (!existing) {
        db.insert(catches).values({
          id: c.id,
          tripId: c.trip_id,
          flyPattern: c.fly_pattern,
          flySize: c.fly_size,
          flyColor: c.fly_color,
          heat: c.heat,
          count: c.count,
          notes: c.notes,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: c.is_deleted ? 1 : 0,
        }).run();
      }
    }
  }

  // Pull fly shop advice
  const { data: remoteAdvice } = await sb()
    .from('fly_shop_advice')
    .select('*')
    .gte('updated_at', since);

  if (remoteAdvice) {
    for (const a of remoteAdvice) {
      const existing = db.select().from(flyShopAdvice).where(eq(flyShopAdvice.id, a.id)).get();
      if (!existing) {
        db.insert(flyShopAdvice).values({
          id: a.id,
          tripId: a.trip_id,
          shopName: a.shop_name,
          advice: a.advice,
          recommendedFlies: a.recommended_flies,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          syncedAt: new Date().toISOString(),
          isDeleted: a.is_deleted ? 1 : 0,
        }).run();
      }
    }
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

// Main sync function
export async function sync() {
  if (!SUPABASE_ENABLED || !supabase || Platform.OS === 'web') {
    return;
  }

  try {
    setStatus('syncing');
    await pushRecords();
    await pullRecords();
    setStatus('idle');
  } catch (e) {
    console.warn('Sync error:', e);
    setStatus('error');
  }
}
