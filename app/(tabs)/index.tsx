import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRiverStore } from '@/src/stores/riverStore';
import { useTripStore } from '@/src/stores/tripStore';
import { hotFlyCount } from '@/src/utils/heat';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOX_GAP = 12;
const BOX_SIZE = Math.min((SCREEN_WIDTH - spacing.lg * 2 - BOX_GAP) / 2, 170);

export default function HomeScreen() {
  const router = useRouter();
  const { rivers, loadRivers } = useRiverStore();
  const { trips, loadTrips } = useTripStore();

  useEffect(() => {
    loadRivers();
    loadTrips();
  }, []);

  const uniqueRivers = new Set(rivers.map((r) => r.name.toLowerCase())).size;
  const totalFlies = new Set(trips.flatMap(t => t.catches.map(c => (c.flyPattern || '').toLowerCase()).filter(Boolean))).size;

  const categories = [
    {
      title: 'Rivers',
      value: `${uniqueRivers}`,
      icon: 'water' as const,
      color: '#0EA5E9',
      bgColor: 'rgba(14, 165, 233, 0.12)',
      route: '/(tabs)/rivers',
    },
    {
      title: 'Trips',
      value: `${trips.length}`,
      icon: 'calendar' as const,
      color: '#2DD4BF',
      bgColor: 'rgba(45, 212, 191, 0.12)',
      route: '/(tabs)/trips',
    },
    {
      title: 'Map',
      value: 'View All',
      icon: 'map' as const,
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      route: '/map',
    },
    {
      title: 'Fly Box',
      value: `${totalFlies}`,
      icon: 'bug' as const,
      color: '#8B5CF6',
      bgColor: 'rgba(139, 92, 246, 0.12)',
      route: '/fly-box',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="fish" size={22} color={colors.primary} />
          </View>
          <Text style={styles.logoText}>Fish<Text style={styles.logoAccent}>Dex</Text></Text>
        </View>
      </View>

      {/* 2x2 Grid */}
      <View style={styles.grid}>
        {categories.map((cat) => (
          <Pressable
            key={cat.title}
            style={({ pressed }) => [styles.box, pressed && styles.boxPressed]}
            onPress={() => router.push(cat.route as any)}
          >
            <View style={[styles.boxIcon, { backgroundColor: cat.bgColor }]}>
              <Ionicons name={cat.icon} size={26} color={cat.color} />
            </View>
            <Text style={styles.boxTitle}>{cat.title}</Text>
            <Text style={[styles.boxValue, { color: cat.color }]}>{cat.value}</Text>
          </Pressable>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Pressable
          style={({ pressed }) => [styles.addRiverButton, pressed && styles.addRiverButtonPressed]}
          onPress={() => router.push('/river/new')}
        >
          <Ionicons name="water" size={18} color={colors.primary} />
          <Text style={styles.addRiverText}>Add River</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.logTripButton, pressed && styles.logTripButtonPressed]}
          onPress={() => router.push('/trip/new')}
        >
          <Ionicons name="add-circle" size={18} color={colors.white} />
          <Text style={styles.logTripText}>Log a Trip</Text>
        </Pressable>
      </View>

      {/* Recent Activity */}
      {trips.length > 0 ? (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>RECENT TRIPS</Text>
          {trips.slice(0, 5).map((trip) => (
            <Pressable
              key={trip.id}
              style={({ pressed }) => [styles.recentItem, pressed && styles.recentItemPressed]}
              onPress={() => router.push(`/trip/${trip.id}`)}
            >
              <View style={styles.recentDot} />
              <View style={styles.recentContent}>
                <Text style={styles.recentRiver}>{trip.riverName}</Text>
                <Text style={styles.recentDetail}>
                  {trip.date}
                  {(() => {
                    const hot = hotFlyCount(trip.catches);
                    return hot > 0 ? ` · 🔥 ${hot} hot` : '';
                  })()}
                  {(trip as any).weather ? ` · ${(trip as any).weather}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -1,
  },
  logoAccent: {
    color: colors.primary,
  },

  // 2x2 Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BOX_GAP,
    marginBottom: spacing.lg,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'space-between',
    ...shadow.sm,
  },
  boxPressed: {
    backgroundColor: colors.surfaceLight,
    transform: [{ scale: 0.97 }],
  },
  boxIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  boxValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  addRiverButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  addRiverButtonPressed: {
    backgroundColor: colors.surfaceLight,
    transform: [{ scale: 0.98 }],
  },
  addRiverText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  logTripButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadow.md,
  },
  logTripButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  logTripText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },

  // Recent
  recentSection: {},
  sectionTitle: {
    fontSize: fontSize.xs - 1,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  recentItemPressed: {
    opacity: 0.7,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  recentContent: {
    flex: 1,
  },
  recentRiver: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  recentDetail: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
});
