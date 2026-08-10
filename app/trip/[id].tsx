import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore, type TripWithDetails } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { formatDateWithDay } from '@/src/utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { addSatelliteToggle } from '@/src/utils/mapHelper';

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTrip, deleteTrip, loadTrips } = useTripStore();
  const { loadRivers } = useRiverStore();
  const [trip, setTrip] = useState<TripWithDetails | undefined>();
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    loadRivers();
    loadTrips();
  }, []);

  useEffect(() => {
    if (id) {
      setTrip(getTrip(id));
    }
  }, [id, useTripStore.getState().trips]);

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  const handleEdit = () => {
    router.push(`/trip/new?edit=${trip.id}`);
  };

  const handleDelete = () => {
    Alert.alert('Delete Trip', 'Are you sure you want to delete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(trip.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.heroCard}>
        <Text style={styles.riverName}>{trip.riverName}</Text>
        {trip.locationOnRiver ? (
          <Text style={styles.location}>{trip.locationOnRiver}</Text>
        ) : null}
        <Text style={styles.date}>{formatDateWithDay(trip.date)}</Text>

        <View style={styles.tags}>
          {trip.weather ? (
            <View style={styles.tag}>
              <Ionicons name="cloud-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.tagText}>{trip.weather}</Text>
            </View>
          ) : null}
          {trip.flowCfs ? (
            <View style={styles.tag}>
              <Ionicons name="water-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.tagText}>{trip.flowCfs} CFS</Text>
            </View>
          ) : null}
          {trip.catchCount > 0 ? (
            <View style={[styles.tag, styles.tagAccent]}>
              <Ionicons name="fish-outline" size={14} color={colors.accent} />
              <Text style={[styles.tagText, { color: colors.accent }]}>
                {trip.catchCount} fish
              </Text>
            </View>
          ) : null}
          {(trip as any).leaderLength ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Leader: {(trip as any).leaderLength}</Text>
            </View>
          ) : null}
          {(trip as any).tippetSize ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Tippet: {(trip as any).tippetSize}</Text>
            </View>
          ) : null}
          {(() => {
            const lat = parseFloat(trip.latitude as any);
            const lng = parseFloat(trip.longitude as any);
            return (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) ? (
              <Pressable style={[styles.tag, styles.tagLocation]} onPress={() => setShowMap(true)}>
                <Ionicons name="location" size={12} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.primary }]}>View on map</Text>
              </Pressable>
            ) : null;
          })()}
        </View>
      </View>

      {/* Notes */}
      {trip.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.noteText}>{trip.notes}</Text>
        </View>
      ) : null}

      {/* Catches */}
      {trip.catches.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catches</Text>
          {trip.catches.map((c, i) => (
            <View key={c.id} style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.flyPattern}>{c.flyPattern}</Text>
                {(c.count ?? 0) > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{c.count}</Text>
                  </View>
                ) : null}
              </View>
              {(c.flySize || (c as any).flyColor) ? (
                <View style={styles.detailMeta}>
                  {c.flySize ? (
                    <Text style={styles.metaText}>Size: #{c.flySize}</Text>
                  ) : null}
                  {(c as any).flyColor ? (
                    <Text style={styles.metaText}>Color: {(c as any).flyColor}</Text>
                  ) : null}
                </View>
              ) : null}
              {c.notes ? (
                <Text style={styles.detailNotes}>{c.notes}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Fly Shop Advice */}
      {trip.flyShopAdvice.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fly Shop Advice</Text>
          {trip.flyShopAdvice.map((a) => (
            <View key={a.id} style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                <Text style={styles.shopName}>{a.shopName}</Text>
              </View>
              {a.advice ? (
                <Text style={styles.detailNotes}>{a.advice}</Text>
              ) : null}
              {a.recommendedFlies ? (
                <View style={styles.recommendedRow}>
                  <Text style={styles.recommendedLabel}>Recommended:</Text>
                  <Text style={styles.recommendedFlies}>{a.recommendedFlies}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          onPress={handleEdit}
        >
          <Ionicons name="pencil" size={18} color={colors.primary} />
          <Text style={styles.actionButtonText}>Edit Trip</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.deleteButton,
            pressed && styles.deleteButtonPressed,
          ]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>

    {/* Map Modal */}
    {(() => {
      if (!trip || !showMap) return null;
      const lat = parseFloat(trip.latitude as any);
      const lng = parseFloat(trip.longitude as any);
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

      return (
        <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>{trip.riverName} — {trip.locationOnRiver || trip.date}</Text>
              <Pressable onPress={() => setShowMap(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {Platform.OS === 'web' ? (() => {
              const mapHtml = `<!DOCTYPE html><html><head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>body{margin:0}#map{width:100%;height:100vh}</style>
                </head><body><div id="map"></div><script>
                var map = L.map('map').setView([${lat}, ${lng}], 14);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(map);
                L.marker([${lat}, ${lng}]).addTo(map).bindPopup('<b>${trip.riverName.replace(/'/g, "\\'")}</b><br>${trip.date}${trip.catchCount > 0 ? `<br>${trip.catchCount} fish` : ''}').openPopup();
                </script></body></html>`;
              return <iframe srcDoc={addSatelliteToggle(mapHtml)} style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any} />;
            })() : (() => {
              const MapView = require('react-native-maps').default;
              const { Marker } = require('react-native-maps');
              return (
                <MapView style={{ flex: 1 }} initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
                  <Marker coordinate={{ latitude: lat, longitude: lng }} title={trip.riverName} description={trip.date} />
                </MapView>
              );
            })()}
          </View>
        </Modal>
      );
    })()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riverName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  location: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  tagAccent: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
  },
  tagLocation: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  tagText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  noteText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 24,
  },
  detailCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flyPattern: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  detailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  detailNotes: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  shopName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  recommendedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  recommendedLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  recommendedFlies: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  deleteButton: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteButtonPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
});
