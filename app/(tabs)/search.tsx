import React, { useState, useEffect, useMemo } from 'react';
import { View, FlatList, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { TripCard } from '@/src/components/TripCard';
import { EmptyState } from '@/src/components/EmptyState';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';

export default function SearchScreen() {
  const router = useRouter();
  const { trips, loadTrips } = useTripStore();
  const { loadRivers } = useRiverStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadRivers();
    loadTrips();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return trips;
    const q = query.toLowerCase();
    return trips.filter(
      (t) =>
        (t.riverName ?? '').toLowerCase().includes(q) ||
        (t.locationOnRiver ?? '').toLowerCase().includes(q) ||
        (t.weather ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q) ||
        t.catches.some(
          (c) =>
            (c.flyPattern ?? '').toLowerCase().includes(q) ||
            (c.notes ?? '').toLowerCase().includes(q)
        ) ||
        t.flyShopAdvice.some(
          (a) =>
            (a.shopName ?? '').toLowerCase().includes(q) ||
            (a.advice ?? '').toLowerCase().includes(q)
        )
    );
  }, [trips, query]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rivers, flies, weather..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          selectionColor={colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />
        )}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="search-outline"
              title="No results"
              subtitle={`Nothing matched "${query}"`}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Search your trips"
              subtitle="Search by river, fly pattern, weather, or anything else"
            />
          )
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
});
