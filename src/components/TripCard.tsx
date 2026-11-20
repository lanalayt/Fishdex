import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';
import { formatDate, daysAgo } from '@/src/utils/date';
import { HEAT_LEVELS, effectiveHeat, heatScore } from '@/src/utils/heat';
import type { TripWithDetails } from '@/src/stores/tripStore';

interface Props {
  trip: TripWithDetails;
  onPress: () => void;
}

export function TripCard({ trip, onPress }: Props) {
  const hotColor = HEAT_LEVELS[0].color;
  const hotIcon = HEAT_LEVELS[0].icon;
  const hotCount = trip.catches.filter((c) => effectiveHeat(c) === 'hot').length;
  // Show the best-producing flies first, skipping cold ones.
  const topFlies = [...trip.catches]
    .sort((a, b) => heatScore(b) - heatScore(a))
    .filter((c) => effectiveHeat(c) !== 'cold' && c.flyPattern)
    .slice(0, 3);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.riverName}>{trip.riverName}</Text>
          {(trip.riverCity || trip.riverState) ? (
            <Text style={styles.location}>
              {[trip.riverCity, trip.riverState].filter(Boolean).join(', ')}
            </Text>
          ) : null}
          {trip.locationOnRiver ? (
            <Text style={styles.locationDetail}>{trip.locationOnRiver}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.daysAgo}>{daysAgo(trip.date)}</Text>
          <Text style={styles.date}>{formatDate(trip.date)}</Text>
        </View>
      </View>

      <View style={styles.tags}>
        {trip.weather ? (
          <View style={styles.tag}>
            <Ionicons name="cloud-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.tagText}>{trip.weather}</Text>
          </View>
        ) : null}
        {trip.flowCfs ? (
          <View style={styles.tag}>
            <Ionicons name="water-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.tagText}>{trip.flowCfs} CFS</Text>
          </View>
        ) : null}
        {hotCount > 0 ? (
          <View style={[styles.tag, { backgroundColor: hotColor + '1A' }]}>
            <Ionicons name={hotIcon as any} size={12} color={hotColor} />
            <Text style={[styles.tagText, { color: hotColor, fontWeight: fontWeight.medium }]}>
              {hotCount} hot {hotCount === 1 ? 'fly' : 'flies'}
            </Text>
          </View>
        ) : null}
      </View>

      {topFlies.length > 0 ? (
        <View style={styles.fliesRow}>
          <Text style={styles.fliesLabel}>Top flies:</Text>
          <Text style={styles.fliesText}>
            {topFlies.map((c) => `${c.flyPattern}${c.flySize ? ` #${c.flySize}` : ''}`).join(', ')}
          </Text>
        </View>
      ) : null}

      {trip.flyShopAdvice.length > 0 ? (
        <View style={styles.adviceRow}>
          <Ionicons name="storefront-outline" size={12} color={colors.primary} />
          <Text style={styles.adviceLabel}>Shop advice:</Text>
          <Text style={styles.adviceText} numberOfLines={1}>
            {trip.flyShopAdvice.map((a) => {
              const parts = [a.shopName];
              if (a.recommendedFlies) parts.push(a.recommendedFlies);
              else if (a.advice) parts.push(a.advice);
              return parts.join(' — ');
            }).join('; ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardPressed: {
    backgroundColor: colors.surfaceLight,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  riverName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  location: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationDetail: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  daysAgo: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  tagAccent: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  tagAccentText: {
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },
  fliesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fliesLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  fliesText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adviceLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  adviceText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
});
