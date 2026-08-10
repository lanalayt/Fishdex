import { create } from 'zustand';
import { supabase } from '../supabase/client';
import * as auth from '../supabase/auth';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      const session = await auth.getSession();
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            displayName: session.user.user_metadata?.display_name ?? session.user.email?.split('@')[0] ?? 'Angler',
          },
          initialized: true,
        });
      } else {
        set({ user: null, initialized: true });
      }
    } catch {
      set({ user: null, initialized: true });
    }

    // Listen for auth changes
    auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            displayName: session.user.user_metadata?.display_name ?? session.user.email?.split('@')[0] ?? 'Angler',
          },
        });
      } else {
        set({ user: null });
      }
    });
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true });
    try {
      const data = await auth.signUp(email, password, displayName);
      // Auto sign-in after signup
      if (data?.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email ?? '',
            displayName: data.user.user_metadata?.display_name ?? displayName,
          },
        });
      } else {
        // Try signing in explicitly
        try {
          await auth.signIn(email, password);
        } catch {}
      }
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      await auth.signIn(email, password);
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await auth.signOut();
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },

  deleteAccount: async (password: string) => {
    set({ loading: true });
    try {
      await auth.deleteAccount(password);
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
}));
