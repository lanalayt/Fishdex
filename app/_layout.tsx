import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { runMigrations } from '@/src/db/migrate';
import { useAuthStore } from '@/src/stores/authStore';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import { initConnectivity } from '@/src/utils/connectivity';
import { pushSyncQueue } from '@/src/sync/localCache';
import { colors } from '@/constants/Colors';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { initialize, user } = useAuthStore();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // Initialize database and connectivity
    runMigrations();
    initConnectivity();

    // Initialize auth
    if (SUPABASE_ENABLED) {
      initialize();
    }
  }, []);

  // Push queued offline changes when app comes to foreground
  useEffect(() => {
    if (!SUPABASE_ENABLED || !user) return;

    // Push any queued changes
    pushSyncQueue();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pushSyncQueue();
    });
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip/new"
          options={{
            title: 'Log a Trip',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="trip/[id]"
          options={{
            title: 'Trip Details',
          }}
        />
        <Stack.Screen
          name="river/new"
          options={{
            title: 'Add River',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="river/[id]"
          options={{
            title: 'River',
          }}
        />
        <Stack.Screen
          name="map"
          options={{
            title: 'Map',
          }}
        />
        <Stack.Screen
          name="river-report"
          options={{
            title: 'River Report',
          }}
        />
        <Stack.Screen
          name="fly-box"
          options={{
            title: 'Fly Box',
          }}
        />
      </Stack>
    </>
  );
}
