import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import {
  searchFlyPatterns,
  FLY_PATTERNS,
  categoryColors,
  categoryLabels,
  type FlyPattern,
  type FlyCategory,
} from '@/src/data/flyPatterns';
import { supabase } from '@/src/supabase/client';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  value: string;
  onChange: (name: string) => void;
  onFlySelected?: (fly: FlyPattern) => void;
}

// No fly images — just use category icons
const imageCache: Record<string, string | null> = {};

async function searchFlyImage(flyName: string): Promise<string | null> {
  return null;
}

function CategoryBadge({ category }: { category: FlyCategory }) {
  return (
    <View style={[badgeStyles.badge, { backgroundColor: categoryColors[category] + '20' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: categoryColors[category] }]} />
      <Text style={[badgeStyles.text, { color: categoryColors[category] }]}>
        {categoryLabels[category]}
      </Text>
    </View>
  );
}

function FlyImageOrIcon({ fly }: { fly: FlyPattern }) {
  const [imageUrl, setImageUrl] = useState<string | null>(fly.imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  React.useEffect(() => {
    if (!imageUrl && !failed) {
      setLoading(true);
      searchFlyImage(fly.name).then((url) => {
        setImageUrl(url);
        setLoading(false);
        if (!url) setFailed(true);
      });
    }
  }, [fly.name]);

  if (loading) {
    return (
      <View style={imgStyles.container}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={imgStyles.image}
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: colored icon based on category
  return (
    <View style={[imgStyles.container, { backgroundColor: categoryColors[fly.category] + '15' }]}>
      <Ionicons
        name={
          fly.category === 'dry' ? 'bug-outline' :
          fly.category === 'streamer' ? 'fish-outline' :
          fly.category === 'terrestrial' ? 'leaf-outline' :
          'ellipse-outline'
        }
        size={22}
        color={categoryColors[fly.category]}
      />
    </View>
  );
}

function FlyPatternRow({
  fly,
  isSelected,
  isCustom,
  onPress,
  onDelete,
}: {
  fly: FlyPattern;
  isSelected: boolean;
  isCustom?: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      style={[rowStyles.row, isSelected && rowStyles.rowSelected]}
      onPress={onPress}
    >
      <FlyImageOrIcon fly={fly} />
      <View style={rowStyles.content}>
        <View style={rowStyles.nameRow}>
          <Text style={rowStyles.name}>{fly.name}</Text>
          {isCustom ? (
            <View style={rowStyles.customBadge}>
              <Text style={rowStyles.customBadgeText}>Custom</Text>
            </View>
          ) : null}
        </View>
        <Text style={rowStyles.description} numberOfLines={1}>
          {fly.description}
        </Text>
        {fly.commonSizes.length > 0 ? (
          <View style={rowStyles.meta}>
            <CategoryBadge category={fly.category} />
            <Text style={rowStyles.sizes}>
              #{fly.commonSizes.join(', #')}
            </Text>
          </View>
        ) : (
          <CategoryBadge category={fly.category} />
        )}
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={rowStyles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </Pressable>
      ) : null}
      {isSelected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

// Custom flies — saved to Supabase so they sync across devices
const builtInNames = new Set(FLY_PATTERNS.map((f) => f.name.toLowerCase()));
const sb = () => supabase as any;

interface CustomFlyRecord {
  id: string;
  name: string;
  category: string;
}

let cachedCustomFlies: (FlyPattern & { dbId?: string })[] = [];

async function loadCustomFlies(): Promise<(FlyPattern & { dbId?: string })[]> {
  if (SUPABASE_ENABLED && supabase) {
    try {
      const { data } = await sb().from('custom_flies').select('id, name, category');
      if (data) {
        cachedCustomFlies = data
          .filter((f: any) => !builtInNames.has(f.name.toLowerCase()))
          .map((f: any) => ({
            name: f.name,
            category: (f.category || 'other') as FlyCategory,
            description: 'Custom fly',
            commonSizes: [],
            dbId: f.id,
          }));
      }
    } catch {}
  }
  return cachedCustomFlies;
}

async function saveCustomFly(name: string) {
  if (builtInNames.has(name.toLowerCase())) return;
  if (cachedCustomFlies.some((f) => f.name.toLowerCase() === name.toLowerCase())) return;

  if (SUPABASE_ENABLED && supabase) {
    try {
      const { data: { user } } = await sb().auth.getUser();
      if (user) {
        await sb().from('custom_flies').insert({
          name,
          category: 'other',
          user_id: user.id,
        });
      }
    } catch {}
  }

  cachedCustomFlies.push({
    name,
    category: 'other',
    description: 'Custom fly',
    commonSizes: [],
  });
}

async function deleteCustomFly(name: string) {
  if (SUPABASE_ENABLED && supabase) {
    try {
      await sb().from('custom_flies').delete().eq('name', name);
    } catch {}
  }
  cachedCustomFlies = cachedCustomFlies.filter((f) => f.name.toLowerCase() !== name.toLowerCase());
}

export function FlyPatternPicker({ value, onChange, onFlySelected }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<FlyCategory | null>(null);
  const [customFlies, setCustomFlies] = useState<(FlyPattern & { dbId?: string })[]>([]);

  const reloadCustomFlies = useCallback(async () => {
    const flies = await loadCustomFlies();
    setCustomFlies([...flies]);
  }, []);

  useEffect(() => {
    if (showPicker) {
      reloadCustomFlies();
    }
  }, [showPicker]);

  const results = useMemo(() => {
    let flies = searchFlyPatterns(search);
    if (filterCategory) {
      flies = flies.filter((f) => f.category === filterCategory);
    }

    // Add matching custom flies at the top
    if (!filterCategory || filterCategory === 'other') {
      const q = search.toLowerCase();
      const matchingCustom = customFlies.filter((f) =>
        !q || f.name.toLowerCase().includes(q)
      );
      if (matchingCustom.length > 0) {
        // Deduplicate against built-in results
        const builtInSet = new Set(flies.map((f) => f.name.toLowerCase()));
        const uniqueCustom = matchingCustom.filter((f) => !builtInSet.has(f.name.toLowerCase()));
        flies = [...uniqueCustom, ...flies];
      }
    }

    return flies;
  }, [search, filterCategory, customFlies]);

  const categories: FlyCategory[] = [
    'dry', 'nymph', 'streamer', 'emerger', 'terrestrial', 'wet', 'midge', 'egg',
  ];

  const handleSelect = useCallback((fly: FlyPattern) => {
    onChange(fly.name);
    onFlySelected?.(fly);
    setShowPicker(false);
    setSearch('');
    setFilterCategory(null);
  }, [onChange, onFlySelected]);

  const handleCustom = useCallback(async () => {
    if (search.trim()) {
      await saveCustomFly(search.trim());
      onChange(search.trim());
      setShowPicker(false);
      setSearch('');
      setFilterCategory(null);
    }
  }, [search, onChange]);

  const handleDeleteCustom = useCallback(async (name: string) => {
    await deleteCustomFly(name);
    await reloadCustomFlies();
  }, [reloadCustomFlies]);

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="bug-outline" size={18} color={colors.primary} />
        <Text style={[styles.buttonText, !value && styles.buttonPlaceholder]}>
          {value || 'Select a fly pattern'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Fly Pattern</Text>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search flies..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              selectionColor={colors.primary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>

          {/* Category filters */}
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            style={styles.categoryList}
            contentContainerStyle={styles.categoryContent}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.categoryChip,
                  filterCategory === item && {
                    backgroundColor: categoryColors[item] + '20',
                    borderColor: categoryColors[item],
                  },
                ]}
                onPress={() =>
                  setFilterCategory(filterCategory === item ? null : item)
                }
              >
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: categoryColors[item] },
                  ]}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    filterCategory === item && { color: categoryColors[item] },
                  ]}
                >
                  {categoryLabels[item]}
                </Text>
              </Pressable>
            )}
          />

          {/* Results */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => {
              const isCustom = !builtInNames.has(item.name.toLowerCase());
              return (
                <FlyPatternRow
                  fly={item}
                  isSelected={item.name === value}
                  isCustom={isCustom}
                  onPress={() => handleSelect(item)}
                  onDelete={isCustom ? () => handleDeleteCustom(item.name) : undefined}
                />
              );
            }}
            ListHeaderComponent={
              search.trim() && !results.find((r) => r.name.toLowerCase() === search.toLowerCase()) ? (
                <Pressable style={styles.customRow} onPress={handleCustom}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.customText}>
                    Use custom: "<Text style={styles.customBold}>{search}</Text>"
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No matching patterns</Text>
                {search.trim() ? (
                  <Pressable style={styles.customButton} onPress={handleCustom}>
                    <Text style={styles.customButtonText}>Use "{search}" as custom fly</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  buttonText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  buttonPlaceholder: {
    color: colors.textTertiary,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  categoryList: {
    minHeight: 36,
    marginTop: spacing.md,
  },
  categoryContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  resultsList: {
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customText: {
    fontSize: fontSize.md,
    color: colors.primary,
  },
  customBold: {
    fontWeight: fontWeight.bold,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  customButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  customButtonText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  rowSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sizes: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customBadge: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
});

const imgStyles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
  },
});
