import { create } from 'zustand';
import { Platform } from 'react-native';
import { db } from '../db/client';
import { rivers, type River, type NewRiver } from '../db/schema';
export type { River } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateId, now } from '../utils/id';
import { supabase } from '../supabase/client';
import { SUPABASE_ENABLED } from '../supabase/config';

const isWeb = Platform.OS === 'web';
const sb = () => supabase as any;

interface RiverStore {
  rivers: River[];
  loading: boolean;
  loadRivers: () => void;
  createRiver: (data: { name: string; region?: string; state?: string; notes?: string; latitude?: number; longitude?: number }) => Promise<River>;
  updateRiver: (id: string, data: { name: string; region?: string; state?: string; latitude?: number; longitude?: number }) => void;
  deleteRiver: (id: string) => void;
  getRiver: (id: string) => River | undefined;
}

export const useRiverStore = create<RiverStore>((set, get) => ({
  rivers: [],
  loading: false,

  loadRivers: () => {
    set({ loading: true });

    if (SUPABASE_ENABLED && supabase) {
      // Load from Supabase (web and native when signed in)
      sb().from('rivers')
        .select('*')
        .eq('is_deleted', false)
        .order('name')
        .then(({ data, error }: any) => {
          if (!error && data) {
            const mapped = data.map((r: any) => ({
              id: r.id,
              name: r.name,
              region: r.region,
              state: r.state,
              notes: r.notes,
              groupId: r.group_id,
              createdBy: r.created_by,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
              imageUrl: r.image_url || null,
              latitude: r.latitude || null,
              longitude: r.longitude || null,
              usgsSiteId: r.usgs_site_id || null,
              usgsSiteName: r.usgs_site_name || null,
              gaugeSource: r.gauge_source || 'usgs',
              isDeleted: r.is_deleted ? 1 : 0,
              syncedAt: r.updated_at,
            }));
            set({ rivers: mapped, loading: false });
          } else {
            set({ loading: false });
          }
        });
    } else {
      // Native: load from SQLite
      const result = db
        .select()
        .from(rivers)
        .where(eq(rivers.isDeleted, 0))
        .orderBy(rivers.name)
        .all();
      set({ rivers: result, loading: false });
    }
  },

  createRiver: async (data) => {
    const timestamp = now();
    const newRiver: any = {
      id: generateId(),
      name: data.name,
      region: data.region || null,
      state: data.state || null,
      notes: data.notes || null,
      isDeleted: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (SUPABASE_ENABLED && supabase) {
      const { data: authData } = await sb().auth.getUser();
      const user = authData?.user;

      if (!user) {
        throw new Error('Not signed in. Please sign in and try again.');
      }

      // Get user's group so the river is visible to group members
      const { data: membership } = await sb()
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const { error } = await sb().from('rivers').insert({
        id: newRiver.id,
        name: newRiver.name,
        region: newRiver.region,
        state: newRiver.state,
        notes: newRiver.notes,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        created_by: user.id,
        group_id: membership?.group_id || null,
        created_at: timestamp,
        updated_at: timestamp,
      });

      if (error) {
        throw new Error(error.message || 'Failed to save river');
      }

      get().loadRivers();
    } else {
      // Native: insert into SQLite
      db.insert(rivers).values(newRiver).run();
      get().loadRivers();
    }

    return newRiver as River;
  },

  updateRiver: (id, data) => {
    const timestamp = now();

    if (SUPABASE_ENABLED && supabase) {
      sb().from('rivers').update({
        name: data.name,
        region: data.region || null,
        state: data.state || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        updated_at: timestamp,
      }).eq('id', id).then(() => {
        get().loadRivers();
      });
    } else {
      db.update(rivers).set({
        name: data.name,
        region: data.region || null,
        state: data.state || null,
        updatedAt: timestamp,
        syncedAt: null,
      }).where(eq(rivers.id, id)).run();
      get().loadRivers();
    }
  },

  deleteRiver: (id) => {
    const timestamp = now();

    if (SUPABASE_ENABLED && supabase) {
      sb().from('rivers').update({ is_deleted: true, updated_at: timestamp })
        .eq('id', id).then(() => {
          get().loadRivers();
        });
    } else {
      db.update(rivers).set({ isDeleted: 1, updatedAt: timestamp, syncedAt: null })
        .where(eq(rivers.id, id)).run();
      get().loadRivers();
    }
  },

  getRiver: (id) => {
    return get().rivers.find((r) => r.id === id);
  },
}));
