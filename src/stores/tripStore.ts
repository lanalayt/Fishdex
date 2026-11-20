import { create } from 'zustand';
import { Platform } from 'react-native';
import { db } from '../db/client';
import { trips, catches, flyShopAdvice, rivers, type Trip, type Catch, type FlyShopAdvice } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { generateId, now } from '../utils/id';
import { supabase } from '../supabase/client';
import { SUPABASE_ENABLED } from '../supabase/config';
import { readFromSupabaseOrLocal, writeToSupabase, pushSyncQueue } from '../sync/localCache';

const isWeb = Platform.OS === 'web';
const sb = () => supabase as any;

export interface TripWithDetails extends Trip {
  riverName: string;
  riverCity: string | null;
  riverState: string | null;
  catches: Catch[];
  flyShopAdvice: FlyShopAdvice[];
  catchCount: number;
}

export interface CatchInput {
  flyPattern: string;
  flySize?: string;
  flyColor?: string;
  leaderLength?: string;
  tippetSize?: string;
  heat?: 'hot' | 'mild' | 'cold';
  count?: number;
  notes?: string;
}

export interface AdviceInput {
  shopName: string;
  advice?: string;
  recommendedFlies?: string;
}

export interface TripInput {
  riverId: string;
  date: string;
  locationOnRiver?: string;
  weather?: string;
  temperature?: string;
  flowCfs?: number;
  leaderLength?: string;
  tippetSize?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  catches: CatchInput[];
  flyShopAdvice: AdviceInput[];
}

interface TripStore {
  trips: TripWithDetails[];
  loading: boolean;
  loadTrips: () => void;
  createTrip: (data: TripInput) => Promise<string>;
  updateTrip: (id: string, data: TripInput) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  getTrip: (id: string) => TripWithDetails | undefined;
  getTripsByRiver: (riverId: string) => TripWithDetails[];
}

// ── Native helpers (SQLite via Drizzle) ──

function loadTripDetailsNative(tripRows: Trip[]): TripWithDetails[] {
  return tripRows.map((trip) => {
    const riverRow = db.select().from(rivers).where(eq(rivers.id, trip.riverId)).get();
    const catchRows = db.select().from(catches)
      .where(and(eq(catches.tripId, trip.id), eq(catches.isDeleted, 0))).all();
    const adviceRows = db.select().from(flyShopAdvice)
      .where(and(eq(flyShopAdvice.tripId, trip.id), eq(flyShopAdvice.isDeleted, 0))).all();

    return {
      ...trip,
      riverName: riverRow?.name ?? 'Unknown River',
      riverCity: riverRow?.region ?? null,
      riverState: riverRow?.state ?? null,
      catches: catchRows,
      flyShopAdvice: adviceRows,
      catchCount: catchRows.reduce((sum, c) => sum + (c.count ?? 0), 0),
    };
  });
}

// ── Web helpers (Supabase) ──

function mapSupabaseTrip(t: any, riverName: string, riverCity: string | null, riverState: string | null, catchRows: any[], adviceRows: any[]): TripWithDetails {
  return {
    id: t.id,
    riverId: t.river_id,
    groupId: t.group_id,
    userId: t.user_id,
    date: t.date,
    locationOnRiver: t.location_on_river,
    weather: t.weather,
    temperature: t.temperature,
    flowCfs: t.flow_cfs,
    leaderLength: t.leader_length,
    tippetSize: t.tippet_size,
    latitude: t.latitude ? String(t.latitude) : null,
    longitude: t.longitude ? String(t.longitude) : null,
    notes: t.notes,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    syncedAt: t.updated_at,
    isDeleted: t.is_deleted ? 1 : 0,
    riverName,
    riverCity,
    riverState,
    catches: catchRows.map((c: any) => ({
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
      syncedAt: c.updated_at,
      isDeleted: c.is_deleted ? 1 : 0,
    })),
    flyShopAdvice: adviceRows.map((a: any) => ({
      id: a.id,
      tripId: a.trip_id,
      shopName: a.shop_name,
      advice: a.advice,
      recommendedFlies: a.recommended_flies,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      syncedAt: a.updated_at,
      isDeleted: a.is_deleted ? 1 : 0,
    })),
    catchCount: catchRows.reduce((sum: number, c: any) => sum + (c.count ?? 0), 0),
  } as any;
}

// ── SQLite local insert (offline fallback) ──

function createTripLocal(tripId: string, data: TripInput, timestamp: string) {
  if (isWeb) return;
  db.insert(trips).values({
    id: tripId, riverId: data.riverId, date: data.date,
    locationOnRiver: data.locationOnRiver || null, weather: data.weather || null,
    temperature: data.temperature || null,
    flowCfs: data.flowCfs || null, leaderLength: data.leaderLength || null,
    tippetSize: data.tippetSize || null,
    latitude: data.latitude ? String(data.latitude) : null,
    longitude: data.longitude ? String(data.longitude) : null,
    notes: data.notes || null, createdAt: timestamp, updatedAt: timestamp,
  }).run();

  for (const c of data.catches) {
    if (!c.flyPattern?.trim()) continue;
    db.insert(catches).values({
      id: generateId(), tripId, flyPattern: c.flyPattern,
      flySize: c.flySize || null, flyColor: c.flyColor || null,
      heat: c.heat || null, count: c.count ?? 0, notes: c.notes || null,
      createdAt: timestamp, updatedAt: timestamp,
    }).run();
  }

  for (const a of data.flyShopAdvice) {
    if (!a.shopName?.trim()) continue;
    db.insert(flyShopAdvice).values({
      id: generateId(), tripId, shopName: a.shopName,
      advice: a.advice || null, recommendedFlies: a.recommendedFlies || null,
      createdAt: timestamp, updatedAt: timestamp,
    }).run();
  }
}

// ── Store ──

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  loading: false,

  loadTrips: async () => {
    set({ loading: true });

    // Also push any queued offline changes
    try { await pushSyncQueue(); } catch {}

    if (SUPABASE_ENABLED) {
      try {
        // Use cache layer — tries Supabase, falls back to local
        const tripData = await readFromSupabaseOrLocal('trips', undefined, 'date', false);
        const riverData = await readFromSupabaseOrLocal('rivers');
        const catchData = await readFromSupabaseOrLocal('catches');
        const adviceData = await readFromSupabaseOrLocal('fly_shop_advice');

        if (!tripData || tripData.length === 0) {
          set({ trips: [], loading: false });
          return;
        }

        const riverMap = new Map<string, any>((riverData || []).map((r: any) => [r.id, r]));

        const tripsWithDetails = tripData.map((t: any) => {
          const river = riverMap.get(t.river_id);
          const tripCatches = (catchData || []).filter((c: any) => c.trip_id === t.id);
          const tripAdvice = (adviceData || []).filter((a: any) => a.trip_id === t.id);
          return mapSupabaseTrip(
            t,
            river?.name || 'Unknown River',
            river?.region || null,
            river?.state || null,
            tripCatches,
            tripAdvice
          );
        });

        set({ trips: tripsWithDetails, loading: false });
      } catch (e) {
        console.error('Failed to load trips:', e);
        set({ loading: false });
      }
    } else if (!isWeb) {
      // No Supabase — load from SQLite directly
      const tripRows = db.select().from(trips)
        .where(eq(trips.isDeleted, 0)).orderBy(desc(trips.date)).all();
      set({ trips: loadTripDetailsNative(tripRows), loading: false });
    }
  },

  createTrip: async (data) => {
    const timestamp = now();
    const tripId = generateId();

    try {
      // Get user ID and group
      let userId = '';
      let groupId: string | null = null;
      if (SUPABASE_ENABLED && supabase) {
        try {
          const { data: { user } } = await sb().auth.getUser();
          userId = user?.id || '';
          if (userId) {
            const { data: membership } = await sb()
              .from('group_members')
              .select('group_id')
              .eq('user_id', userId)
              .limit(1)
              .single();
            groupId = membership?.group_id || null;
          }
        } catch {}
      }

      // Write trip — goes to Supabase if online, queued if offline
      await writeToSupabase('trips', 'insert', {
        id: tripId,
        river_id: data.riverId,
        user_id: userId,
        group_id: groupId,
        date: data.date,
        location_on_river: data.locationOnRiver || null,
        weather: data.weather || null,
        temperature: data.temperature || null,
        flow_cfs: data.flowCfs || null,
        leader_length: data.leaderLength || null,
        tippet_size: data.tippetSize || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        notes: data.notes || null,
      });

      // Write catches
      for (const c of data.catches) {
        if (!c.flyPattern?.trim()) continue;
        await writeToSupabase('catches', 'insert', {
          id: generateId(),
          trip_id: tripId,
          fly_pattern: c.flyPattern,
          fly_size: c.flySize || null,
          fly_color: c.flyColor || null,
          heat: c.heat || null,
          count: c.count ?? 0,
          notes: c.notes || null,
        });
      }

      // Write fly shop advice
      for (const a of data.flyShopAdvice) {
        if (!a.shopName?.trim()) continue;
        await writeToSupabase('fly_shop_advice', 'insert', {
          id: generateId(),
          trip_id: tripId,
          shop_name: a.shopName,
          advice: a.advice || null,
          recommended_flies: a.recommendedFlies || null,
        });
      }

      // Also save locally on native for offline access
      if (!isWeb) {
        try { createTripLocal(tripId, data, timestamp); } catch {}
      }

      await get().loadTrips();
    } catch (e) {
      console.error('Failed to create trip:', e);
      // Save locally as fallback
      if (!isWeb) {
        try { createTripLocal(tripId, data, timestamp); } catch {}
      }
    }

    return tripId;
  },

  updateTrip: async (id, data) => {
    const timestamp = now();

    if (SUPABASE_ENABLED && supabase) {
      try {
          await sb().from('trips').update({
            river_id: data.riverId, date: data.date,
            location_on_river: data.locationOnRiver || null,
            weather: data.weather || null, temperature: data.temperature || null, flow_cfs: data.flowCfs || null,
            leader_length: data.leaderLength || null, tippet_size: data.tippetSize || null,
            latitude: data.latitude || null, longitude: data.longitude || null,
            notes: data.notes || null, updated_at: timestamp,
          }).eq('id', id);

          // Delete old catches and advice
          await sb().from('catches').update({ is_deleted: true }).eq('trip_id', id);
          await sb().from('fly_shop_advice').update({ is_deleted: true }).eq('trip_id', id);

          // Re-insert
          for (const c of data.catches) {
            if (!c.flyPattern?.trim()) continue;
            await sb().from('catches').insert({
              id: generateId(), trip_id: id,
              fly_pattern: c.flyPattern, fly_size: c.flySize || null,
              fly_color: c.flyColor || null, heat: c.heat || null, count: c.count ?? 0, notes: c.notes || null,
            });
          }

          for (const a of data.flyShopAdvice) {
            if (!a.shopName?.trim()) continue;
            await sb().from('fly_shop_advice').insert({
              id: generateId(), trip_id: id,
              shop_name: a.shopName, advice: a.advice || null,
              recommended_flies: a.recommendedFlies || null,
            });
          }

        await get().loadTrips();
      } catch (e) {
        console.error('Failed to update trip:', e);
      }
    } else {
      db.update(trips).set({
        riverId: data.riverId, date: data.date,
        locationOnRiver: data.locationOnRiver || null, weather: data.weather || null, temperature: data.temperature || null,
        flowCfs: data.flowCfs || null, leaderLength: data.leaderLength || null,
        tippetSize: data.tippetSize || null,
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
        notes: data.notes || null, updatedAt: timestamp, syncedAt: null,
      }).where(eq(trips.id, id)).run();

      db.update(catches).set({ isDeleted: 1, updatedAt: timestamp }).where(eq(catches.tripId, id)).run();
      db.update(flyShopAdvice).set({ isDeleted: 1, updatedAt: timestamp }).where(eq(flyShopAdvice.tripId, id)).run();

      for (const c of data.catches) {
        if (!c.flyPattern?.trim()) continue;
        db.insert(catches).values({
          id: generateId(), tripId: id, flyPattern: c.flyPattern,
          flySize: c.flySize || null, flyColor: c.flyColor || null,
          heat: c.heat || null, count: c.count ?? 0, notes: c.notes || null,
          createdAt: timestamp, updatedAt: timestamp,
        }).run();
      }

      for (const a of data.flyShopAdvice) {
        if (!a.shopName?.trim()) continue;
        db.insert(flyShopAdvice).values({
          id: generateId(), tripId: id, shopName: a.shopName,
          advice: a.advice || null, recommendedFlies: a.recommendedFlies || null,
          createdAt: timestamp, updatedAt: timestamp,
        }).run();
      }

      get().loadTrips();
    }
  },

  deleteTrip: async (id) => {
    try {
      await writeToSupabase('trips', 'delete', { id });
      await get().loadTrips();
    } catch (e) {
      console.error('Failed to delete trip:', e);
    }
  },

  getTrip: (id) => {
    return get().trips.find((t) => t.id === id);
  },

  getTripsByRiver: (riverId) => {
    return get().trips.filter((t) => t.riverId === riverId);
  },
}));
