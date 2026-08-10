import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { useAuthStore } from '@/src/stores/authStore';
import { TripCard } from '@/src/components/TripCard';
import { EmptyState } from '@/src/components/EmptyState';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

export default function TripsScreen() {
  const router = useRouter();
  const { trips, loading, loadTrips } = useTripStore();
  const { loadRivers } = useRiverStore();
  const { user } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadRivers();
    loadTrips();
  }, []);

  const handleNewTrip = useCallback(() => {
    router.push('/trip/new');
  }, [router]);

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push(`/trip/${tripId}`);
    },
    [router]
  );

  // Get unique users from trips
  const userFilters = useMemo(() => {
    const users = new Map<string, string>(); // userId -> displayName
    for (const trip of trips) {
      const uid = (trip as any).userId || (trip as any).user_id;
      if (uid && !users.has(uid)) {
        // Try to figure out display name
        // For now, use "My Trips" for current user, userId for others
        if (user && uid === user.id) {
          users.set(uid, 'My Trips');
        } else {
          users.set(uid, uid.substring(0, 8) + '...');
        }
      }
    }
    return users;
  }, [trips, user]);

  // Load display names from profiles for group members
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Try to load display names from Supabase profiles
    const loadNames = async () => {
      try {
        const { supabase } = require('@/src/supabase/client');
        const { SUPABASE_ENABLED } = require('@/src/supabase/config');
        if (!SUPABASE_ENABLED || !supabase) return;

        const userIds = [...userFilters.keys()];
        if (userIds.length === 0) return;

        const { data } = await (supabase as any).from('profiles')
          .select('id, display_name')
          .in('id', userIds);

        if (data) {
          const names = new Map<string, string>();
          for (const p of data) {
            if (user && p.id === user.id) {
              names.set(p.id, 'My Trips');
            } else {
              names.set(p.id, p.display_name || 'Unknown');
            }
          }
          setUserNames(names);
        }
      } catch {}
    };
    loadNames();
  }, [userFilters, user]);

  // Build filter tabs
  const filterTabs = useMemo(() => {
    const tabs: { key: string; label: string }[] = [{ key: 'all', label: 'All' }];

    for (const [uid] of userFilters) {
      const name = userNames.get(uid) || (user && uid === user.id ? 'My Trips' : uid.substring(0, 8));
      tabs.push({ key: uid, label: name });
    }

    return tabs;
  }, [userFilters, userNames, user]);

  // Filter trips
  const filteredTrips = useMemo(() => {
    if (selectedFilter === 'all') return trips;
    return trips.filter(t => {
      const uid = (t as any).userId || (t as any).user_id;
      return uid === selectedFilter;
    });
  }, [trips, selectedFilter]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => handleTripPress(item.id)} />
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.headerSection}>
              <Text style={styles.heroTitle}>Trips</Text>
              <Text style={styles.heroSubtitle}>
                {filteredTrips.length === 0
                  ? 'No trips yet'
                  : `${filteredTrips.length} ${filteredTrips.length === 1 ? 'trip' : 'trips'}`}
              </Text>
            </View>

            {/* User filter tabs */}
            {filterTabs.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContent}
              >
                {filterTabs.map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[styles.filterTab, selectedFilter === tab.key && styles.filterTabSelected]}
                    onPress={() => setSelectedFilter(tab.key)}
                  >
                    <Text style={[styles.filterTabText, selectedFilter === tab.key && styles.filterTabTextSelected]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="fish-outline"
            title="No trips yet"
            subtitle="Tap the button below to log your first fishing trip"
          />
        }
        contentContainerStyle={filteredTrips.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleNewTrip}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  filterTabTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.lg,
  },
  fabPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.95 }],
  },
});
