import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, FlatList, Text, TextInput, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRiverStore } from '@/src/stores/riverStore';
import { useTripStore } from '@/src/stores/tripStore';
import { EmptyState } from '@/src/components/EmptyState';
import { pickRiverPhoto, uploadRiverPhoto, saveRiverImageUrl } from '@/src/utils/riverPhoto';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

function RiverIcon({ riverId, imageUrl, onPhotoAdded }: { riverId: string; imageUrl?: string | null; onPhotoAdded?: () => void }) {
  const [localImage, setLocalImage] = useState<string | null>(imageUrl || null);

  useEffect(() => {
    setLocalImage(imageUrl || null);
  }, [imageUrl]);

  const handleAddPhoto = async () => {
    const uri = await pickRiverPhoto();
    if (!uri) return;

    setLocalImage(uri); // Show immediately

    const publicUrl = await uploadRiverPhoto(uri, riverId);
    if (publicUrl) {
      await saveRiverImageUrl(riverId, publicUrl);
      setLocalImage(publicUrl);
      onPhotoAdded?.();
    }
  };

  return (
    <Pressable onPress={handleAddPhoto} hitSlop={4}>
      {localImage ? (
        <Image source={{ uri: localImage }} style={iconStyles.image} />
      ) : (
        <View style={iconStyles.fallback}>
          <Ionicons name="camera-outline" size={14} color={colors.primary} />
        </View>
      )}
    </Pressable>
  );
}

const iconStyles = StyleSheet.create({
  image: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm + 2,
  },
  fallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 2,
  },
});

interface RiverGroup {
  name: string;
  locations: {
    id: string;
    city: string | null;
    state: string | null;
    tripCount: number;
    totalCatch: number;
  }[];
}

export default function RiversScreen() {
  const router = useRouter();
  const { rivers, loadRivers, updateRiver, deleteRiver } = useRiverStore();
  const { trips, loadTrips } = useTripStore();
  const [expandedRiver, setExpandedRiver] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');

  useEffect(() => {
    loadRivers();
    loadTrips();
  }, []);

  const handleNewRiver = useCallback(() => {
    router.push('/river/new');
  }, [router]);

  const getTripCount = (riverId: string) =>
    trips.filter((t) => t.riverId === riverId).length;

  const getTotalCatch = (riverId: string) =>
    trips.filter((t) => t.riverId === riverId)
      .reduce((sum, t) => sum + t.catchCount, 0);

  // Group rivers by state, then by name
  const groupedByState = useMemo(() => {
    const stateMap = new Map<string, Map<string, RiverGroup>>();
    for (const r of rivers) {
      const state = (r as any).state || 'Other';
      const nameKey = r.name.toLowerCase().trim();

      if (!stateMap.has(state)) stateMap.set(state, new Map());
      const riverMap = stateMap.get(state)!;

      if (!riverMap.has(nameKey)) {
        riverMap.set(nameKey, { name: r.name, locations: [] });
      }
      riverMap.get(nameKey)!.locations.push({
        id: r.id,
        city: (r as any).region || null,
        state: (r as any).state || null,
        tripCount: getTripCount(r.id),
        totalCatch: getTotalCatch(r.id),
      });
    }

    return [...stateMap.entries()]
      .map(([state, riverMap]) => ({
        state,
        rivers: [...riverMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        totalTrips: [...riverMap.values()].reduce((s, rg) => s + rg.locations.reduce((s2, l) => s2 + l.tripCount, 0), 0),
        totalFish: [...riverMap.values()].reduce((s, rg) => s + rg.locations.reduce((s2, l) => s2 + l.totalCatch, 0), 0),
      }))
      .sort((a, b) => a.state.localeCompare(b.state));
  }, [rivers, trips]);

  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  const toggleState = (state: string) => {
    setExpandedStates(prev => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const startEditing = (riverId: string) => {
    const r = rivers.find((rv) => rv.id === riverId);
    if (r) {
      setEditingId(riverId);
      setEditName(r.name);
      setEditCity((r as any).region || '');
      setEditState((r as any).state || '');
    }
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateRiver(editingId, {
        name: editName.trim(),
        region: editCity.trim() || undefined,
        state: editState.trim() || undefined,
      });
      setEditingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete River',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRiver(id) },
      ]
    );
  };

  const renderLocation = (loc: RiverGroup['locations'][0], riverName: string) => {
    if (editingId === loc.id) {
      return (
        <View key={loc.id} style={styles.editCard}>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="River name"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.primary}
            autoFocus
          />
          <View style={styles.editRow}>
            <TextInput
              style={[styles.editInput, { flex: 1 }]}
              value={editCity}
              onChangeText={setEditCity}
              placeholder="City"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
            />
            <TextInput
              style={[styles.editInput, { flex: 1 }]}
              value={editState}
              onChangeText={setEditState}
              placeholder="State"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
            />
          </View>
          <View style={styles.editActions}>
            <Pressable style={styles.editCancel} onPress={() => setEditingId(null)}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.editSave} onPress={saveEdit}>
              <Ionicons name="checkmark" size={16} color={colors.white} />
              <Text style={styles.editSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    const label = [loc.city, loc.state].filter(Boolean).join(', ') || 'No location set';

    return (
      <Pressable
        key={loc.id}
        style={({ pressed }) => [styles.locationRow, pressed && styles.locationRowPressed]}
        onPress={() => router.push(`/river/${loc.id}`)}
      >
        <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
        <View style={styles.locationContent}>
          <Text style={styles.locationName}>{label}</Text>
          <Text style={styles.locationStats}>
            {loc.tripCount} {loc.tripCount === 1 ? 'trip' : 'trips'}
            {loc.totalCatch > 0 ? ` · ${loc.totalCatch} fish` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={groupedByState}
        keyExtractor={(item) => item.state}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.heroTitle}>Rivers</Text>
            <Text style={styles.heroSubtitle}>
              {rivers.length === 0
                ? 'Add your first river'
                : `${rivers.length} ${rivers.length === 1 ? 'location' : 'locations'} across ${groupedByState.length} ${groupedByState.length === 1 ? 'state' : 'states'}`}
            </Text>
          </View>
        }
        renderItem={({ item: stateGroup }) => (
          <View>
            {/* State header */}
            <Pressable style={styles.stateHeader} onPress={() => toggleState(stateGroup.state)}>
              <Ionicons name="flag" size={16} color={colors.accent} />
              <Text style={styles.stateName}>{stateGroup.state}</Text>
              <Text style={styles.stateStats}>{stateGroup.rivers.length} rivers · {stateGroup.totalTrips} trips</Text>
              <Ionicons name={expandedStates.has(stateGroup.state) ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </Pressable>

            {/* Rivers in this state */}
            {expandedStates.has(stateGroup.state) ? stateGroup.rivers.map((item) => {
              const hasMultiple = item.locations.length > 1;
              const isExpanded = expandedRiver === item.name + stateGroup.state;
              const totalTrips = item.locations.reduce((s, l) => s + l.tripCount, 0);
              const totalFish = item.locations.reduce((s, l) => s + l.totalCatch, 0);

              if (!hasMultiple) {
                const loc = item.locations[0];
                return (
                  <Pressable
                    key={loc.id}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => router.push(`/river/${loc.id}`)}
                  >
                    <RiverIcon
                      riverId={loc.id}
                      imageUrl={(rivers.find((r) => r.id === loc.id) as any)?.imageUrl}
                      onPhotoAdded={loadRivers}
                    />
                    <View style={styles.cardContent}>
                      <Text style={styles.riverName}>{item.name}</Text>
                      {loc.city ? <Text style={styles.riverLocation}>{loc.city}</Text> : null}
                      <Text style={styles.riverStats}>
                        {loc.tripCount} {loc.tripCount === 1 ? 'trip' : 'trips'}
                        {loc.totalCatch > 0 ? ` · ${loc.totalCatch} fish` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </Pressable>
                );
              }

              return (
                <View key={item.name + stateGroup.state} style={styles.groupCard}>
                  <Pressable
                    style={styles.groupHeader}
                    onPress={() => setExpandedRiver(isExpanded ? null : item.name + stateGroup.state)}
                  >
                    <RiverIcon
                      riverId={item.locations[0]?.id}
                      imageUrl={(rivers.find((r) => r.id === item.locations[0]?.id) as any)?.imageUrl}
                      onPhotoAdded={loadRivers}
                    />
                    <View style={styles.cardContent}>
                      <Text style={styles.riverName}>{item.name}</Text>
                      <Text style={styles.riverStats}>
                        {item.locations.length} locations · {totalTrips} trips
                        {totalFish > 0 ? ` · ${totalFish} fish` : ''}
                      </Text>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                  </Pressable>
                  {isExpanded ? (
                    <View style={styles.groupLocations}>
                      {item.locations.map((loc) => renderLocation(loc, item.name))}
                    </View>
                  ) : null}
                </View>
              );
            }) : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="water-outline"
            title="No rivers yet"
            subtitle="Tap the + button to add your first river"
          />
        }
        contentContainerStyle={rivers.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleNewRiver}
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
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  // State header
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  stateStats: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  // Single river card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    backgroundColor: colors.surfaceLight,
  },
  // cardIcon removed — using RiverPhoto component
  cardContent: {
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  riverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  riverLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  riverStats: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 3,
  },
  // Grouped river card
  groupCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  groupLocations: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Location rows inside expanded group
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationRowPressed: {
    backgroundColor: colors.surfaceLight,
  },
  locationContent: {
    flex: 1,
  },
  locationName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  locationStats: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  locationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Edit form
  editCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  editInput: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  editCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
  },
  editCancelText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  editSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  editSaveText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  // FAB
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
