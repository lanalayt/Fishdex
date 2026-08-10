import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ScrollView, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTripStore } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { useAuthStore } from '@/src/stores/authStore';
import { supabase } from '@/src/supabase/client';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import { FLY_PATTERNS, categoryColors, categoryLabels, type FlyCategory } from '@/src/data/flyPatterns';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';

interface FlyStats {
  name: string;
  category: FlyCategory;
  totalFish: number;
  tripCount: number;
  rivers: string[];
  sizes: string[];
  flyColors: string[];
  fishPerTrip: number;
}

export default function FlyBoxScreen() {
  const { trips, loadTrips } = useTripStore();
  const { rivers, loadRivers } = useRiverStore();
  const { user } = useAuthStore();
  const [filterCategory, setFilterCategory] = useState<FlyCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'fish' | 'trips' | 'rate'>('fish');
  const [selectedUser, setSelectedUser] = useState('all');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [shopNeeds, setShopNeeds] = useState('');
  const [shopNeedsExpanded, setShopNeedsExpanded] = useState(false);
  const shopNeedsLoaded = useRef(false);

  const shopNeedsKey = useMemo(
    () => `fishdex:flyShopNeeds:${user?.id ?? 'local'}`,
    [user?.id]
  );

  useEffect(() => {
    loadTrips();
    loadRivers();
  }, []);

  // Load saved shop needs
  useEffect(() => {
    shopNeedsLoaded.current = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(shopNeedsKey);
        setShopNeeds(saved ?? '');
      } catch {
        setShopNeeds('');
      } finally {
        shopNeedsLoaded.current = true;
      }
    })();
  }, [shopNeedsKey]);

  // Persist on change (after initial load)
  useEffect(() => {
    if (!shopNeedsLoaded.current) return;
    AsyncStorage.setItem(shopNeedsKey, shopNeeds).catch(() => {});
  }, [shopNeeds, shopNeedsKey]);

  // Get unique users and load display names
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of trips) {
      const uid = (t as any).userId || (t as any).user_id;
      if (uid) ids.add(uid);
    }
    return [...ids];
  }, [trips]);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase || userIds.length === 0) return;
    (async () => {
      try {
        const { data } = await (supabase as any).from('profiles').select('id, display_name').in('id', userIds);
        if (data) {
          const names = new Map<string, string>();
          for (const p of data) {
            names.set(p.id, user && p.id === user.id ? 'My Fly Box' : p.display_name || 'Unknown');
          }
          setUserNames(names);
        }
      } catch {}
    })();
  }, [userIds, user]);

  const userTabs = useMemo(() => {
    const tabs: { key: string; label: string }[] = [{ key: 'all', label: 'All' }];
    for (const uid of userIds) {
      tabs.push({
        key: uid,
        label: userNames.get(uid) || (user && uid === user.id ? 'My Fly Box' : uid.substring(0, 8)),
      });
    }
    return tabs;
  }, [userIds, userNames, user]);

  // Filter trips by selected user
  const filteredTrips = useMemo(() => {
    if (selectedUser === 'all') return trips;
    return trips.filter(t => {
      const uid = (t as any).userId || (t as any).user_id;
      return uid === selectedUser;
    });
  }, [trips, selectedUser]);

  const flyStats = useMemo(() => {
    const map = new Map<string, FlyStats>();

    for (const trip of filteredTrips) {
      for (const c of trip.catches) {
        const name = (c.flyPattern || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();

        if (!map.has(key)) {
          // Find category from built-in patterns
          const builtIn = FLY_PATTERNS.find(f => f.name.toLowerCase() === key);
          map.set(key, {
            name,
            category: builtIn?.category || 'other',
            totalFish: 0,
            tripCount: 0,
            rivers: [],
            sizes: [],
            flyColors: [],
            fishPerTrip: 0,
          });
        }

        const stat = map.get(key)!;
        stat.totalFish += c.count ?? 0;
        stat.tripCount += 1;
        if (trip.riverName && !stat.rivers.includes(trip.riverName)) {
          stat.rivers.push(trip.riverName);
        }
        if (c.flySize && !stat.sizes.includes(c.flySize)) {
          stat.sizes.push(c.flySize);
        }
        const flyColor = (c as any).flyColor;
        if (flyColor && !stat.flyColors.includes(flyColor)) {
          stat.flyColors.push(flyColor);
        }
      }
    }

    // Calculate fish per trip
    for (const stat of map.values()) {
      stat.fishPerTrip = stat.tripCount > 0 ? Math.round((stat.totalFish / stat.tripCount) * 10) / 10 : 0;
    }

    let result = [...map.values()];

    // Filter
    if (filterCategory !== 'all') {
      result = result.filter(f => f.category === filterCategory);
    }

    // Sort
    if (sortBy === 'fish') result.sort((a, b) => b.totalFish - a.totalFish);
    else if (sortBy === 'trips') result.sort((a, b) => b.tripCount - a.tripCount);
    else result.sort((a, b) => b.fishPerTrip - a.fishPerTrip);

    return result;
  }, [filteredTrips, filterCategory, sortBy]);

  const totalFlies = flyStats.length;
  const totalFishCaught = flyStats.reduce((s, f) => s + f.totalFish, 0);

  const categories: (FlyCategory | 'all')[] = ['all', 'dry', 'nymph', 'streamer', 'emerger', 'terrestrial', 'wet', 'midge', 'other'];

  return (
    <View style={styles.container}>
      <FlatList
        data={flyStats}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={
          <View>
            {/* User filter tabs */}
            {userTabs.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.userFilterScroll}
                contentContainerStyle={styles.userFilterContent}
              >
                {userTabs.map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[styles.userFilterTab, selectedUser === tab.key && styles.userFilterTabSelected]}
                    onPress={() => setSelectedUser(tab.key)}
                  >
                    <Text style={[styles.userFilterText, selectedUser === tab.key && styles.userFilterTextSelected]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Fly Shop Needs */}
            <View style={styles.shopNeedsCard}>
              <Pressable
                style={styles.shopNeedsHeader}
                onPress={() => setShopNeedsExpanded((e) => !e)}
              >
                <Ionicons name="storefront-outline" size={18} color={colors.accent} />
                <Text style={styles.shopNeedsTitle}>Fly Shop Needs</Text>
                {shopNeeds.trim().length > 0 ? (
                  <View style={styles.shopNeedsDot} />
                ) : null}
                <View style={{ flex: 1 }} />
                <Ionicons
                  name={shopNeedsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textTertiary}
                />
              </Pressable>
              {shopNeedsExpanded ? (
                <TextInput
                  style={styles.shopNeedsInput}
                  value={shopNeeds}
                  onChangeText={setShopNeeds}
                  placeholder="e.g. 6x tippet, #16 parachute adams, copper johns..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                />
              ) : shopNeeds.trim().length > 0 ? (
                <Text style={styles.shopNeedsPreview} numberOfLines={2}>
                  {shopNeeds}
                </Text>
              ) : (
                <Text style={styles.shopNeedsEmpty}>Tap to add restock notes</Text>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{totalFlies}</Text>
                <Text style={styles.statLabel}>Flies Used</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{totalFishCaught}</Text>
                <Text style={styles.statLabel}>Total Fish</Text>
              </View>
            </View>

            {/* Category filter */}
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              style={styles.filterList}
              contentContainerStyle={styles.filterContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.filterChip, filterCategory === item && styles.filterChipSelected,
                    item !== 'all' && filterCategory === item ? { backgroundColor: (categoryColors[item as FlyCategory] || colors.primary) + '20', borderColor: categoryColors[item as FlyCategory] || colors.primary } : {}
                  ]}
                  onPress={() => setFilterCategory(item)}
                >
                  {item !== 'all' ? <View style={[styles.filterDot, { backgroundColor: categoryColors[item as FlyCategory] }]} /> : null}
                  <Text style={[styles.filterText, filterCategory === item && { color: item === 'all' ? colors.primary : categoryColors[item as FlyCategory] }]}>
                    {item === 'all' ? 'All' : categoryLabels[item as FlyCategory]}
                  </Text>
                </Pressable>
              )}
            />

            {/* Sort */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              {[
                { key: 'fish', label: 'Most Fish' },
                { key: 'trips', label: 'Most Used' },
                { key: 'rate', label: 'Best Rate' },
              ].map((s) => (
                <Pressable key={s.key} style={[styles.sortChip, sortBy === s.key && styles.sortChipSelected]} onPress={() => setSortBy(s.key as any)}>
                  <Text style={[styles.sortChipText, sortBy === s.key && styles.sortChipTextSelected]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.flyCard}>
            <View style={styles.flyRank}>
              <Text style={styles.flyRankText}>#{index + 1}</Text>
            </View>
            <View style={styles.flyContent}>
              <View style={styles.flyNameRow}>
                <Text style={styles.flyName}>{item.name}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: (categoryColors[item.category] || colors.textTertiary) + '20' }]}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryColors[item.category] || colors.textTertiary }]} />
                  <Text style={[styles.categoryText, { color: categoryColors[item.category] || colors.textTertiary }]}>
                    {categoryLabels[item.category] || 'Other'}
                  </Text>
                </View>
              </View>
              <View style={styles.flyStatsRow}>
                <View style={styles.flyStat}>
                  <Text style={styles.flyStatValue}>{item.totalFish}</Text>
                  <Text style={styles.flyStatLabel}>fish</Text>
                </View>
                <View style={styles.flyStat}>
                  <Text style={styles.flyStatValue}>{item.tripCount}</Text>
                  <Text style={styles.flyStatLabel}>trips</Text>
                </View>
                <View style={styles.flyStat}>
                  <Text style={styles.flyStatValue}>{item.fishPerTrip}</Text>
                  <Text style={styles.flyStatLabel}>per trip</Text>
                </View>
              </View>
              {item.sizes.length > 0 ? (
                <Text style={styles.flyDetail}>Sizes: #{item.sizes.join(', #')}</Text>
              ) : null}
              {item.flyColors.length > 0 ? (
                <Text style={styles.flyDetail}>Colors: {item.flyColors.join(', ')}</Text>
              ) : null}
              {item.rivers.length > 0 ? (
                <Text style={styles.flyDetail}>Rivers: {item.rivers.join(', ')}</Text>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bug-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No flies yet</Text>
            <Text style={styles.emptyText}>Log trips with catches to build your fly box</Text>
          </View>
        }
        contentContainerStyle={flyStats.length === 0 ? { flexGrow: 1 } : styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: 40 },
  userFilterScroll: { marginTop: spacing.md, maxHeight: 40 },
  userFilterContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  userFilterTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  userFilterTabSelected: { backgroundColor: 'rgba(14, 165, 233, 0.15)', borderColor: colors.primary },
  userFilterText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  userFilterTextSelected: { color: colors.primary, fontWeight: fontWeight.semibold },
  shopNeedsCard: { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  shopNeedsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shopNeedsTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  shopNeedsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  shopNeedsInput: { marginTop: spacing.sm, minHeight: 90, color: colors.text, fontSize: fontSize.sm, backgroundColor: colors.surfaceLight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 2, lineHeight: 20 },
  shopNeedsPreview: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18 },
  shopNeedsEmpty: { marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textTertiary, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, marginTop: spacing.md },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  filterList: { marginTop: spacing.md, maxHeight: 40 },
  filterContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs + 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: 'rgba(14, 165, 233, 0.1)' },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.medium },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  sortLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  sortChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortChipSelected: { backgroundColor: 'rgba(14, 165, 233, 0.1)', borderColor: colors.primary },
  sortChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  sortChipTextSelected: { color: colors.primary, fontWeight: fontWeight.semibold },
  flyCard: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  flyRank: { width: 36, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  flyRankText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textTertiary },
  flyContent: { flex: 1, padding: spacing.md },
  flyNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  flyName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryText: { fontSize: 10, fontWeight: fontWeight.semibold },
  flyStatsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  flyStat: { alignItems: 'center' },
  flyStatValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.accent },
  flyStatLabel: { fontSize: fontSize.xs - 1, color: colors.textTertiary },
  flyDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
