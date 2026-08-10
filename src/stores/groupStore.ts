import { create } from 'zustand';
import { supabase } from '../supabase/client';

// Helper to bypass strict typing until we generate Supabase types
const sb = () => supabase as any;

interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
}

interface GroupMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
}

interface GroupStore {
  currentGroup: Group | null;
  members: GroupMember[];
  loading: boolean;
  createGroup: (name: string) => Promise<Group>;
  joinGroup: (inviteCode: string) => Promise<void>;
  loadCurrentGroup: () => Promise<void>;
  loadMembers: () => Promise<void>;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  currentGroup: null,
  members: [],
  loading: false,

  createGroup: async (name) => {
    if (!supabase) throw new Error('Not connected');
    set({ loading: true });

    try {
      const { data: { user } } = await sb().auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Create the group
      const { data: group, error } = await sb()
        .from('groups')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      // Add creator as admin
      await sb()
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'admin' });

      const newGroup: Group = {
        id: group.id,
        name: group.name,
        inviteCode: group.invite_code,
        createdBy: group.created_by,
      };

      set({ currentGroup: newGroup });
      await get().loadMembers();
      return newGroup;
    } finally {
      set({ loading: false });
    }
  },

  joinGroup: async (inviteCode) => {
    if (!supabase) throw new Error('Not connected');
    set({ loading: true });

    try {
      const { data, error } = await sb().rpc('join_group', { code: inviteCode });
      if (error) throw error;

      await get().loadCurrentGroup();
      await get().loadMembers();
    } finally {
      set({ loading: false });
    }
  },

  loadCurrentGroup: async () => {
    if (!supabase) return;

    const { data: { user } } = await sb().auth.getUser();
    if (!user) return;

    // Get user's first group
    const { data: membership } = await sb()
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      set({ currentGroup: null });
      return;
    }

    const { data: group } = await sb()
      .from('groups')
      .select('*')
      .eq('id', membership.group_id)
      .single();

    if (group) {
      set({
        currentGroup: {
          id: group.id,
          name: group.name,
          inviteCode: group.invite_code,
          createdBy: group.created_by,
        },
      });
    }
  },

  loadMembers: async () => {
    if (!supabase) return;
    const group = get().currentGroup;
    if (!group) return;

    const { data } = await sb()
      .from('group_members')
      .select(`
        id,
        user_id,
        role,
        profiles:user_id (display_name, email)
      `)
      .eq('group_id', group.id);

    if (data) {
      set({
        members: data.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          displayName: m.profiles?.display_name ?? 'Unknown',
          email: m.profiles?.email ?? '',
          role: m.role,
        })),
      });
    }
  },
}));
