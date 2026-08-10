import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './config';

let supabase: ReturnType<typeof createClient> | null = null;

if (SUPABASE_ENABLED) {
  const options: any = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  };

  // Use SecureStore on native for token storage
  if (Platform.OS !== 'web') {
    try {
      const SecureStore = require('expo-secure-store');
      options.auth.storage = {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
    } catch {}
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
}

export { supabase };
