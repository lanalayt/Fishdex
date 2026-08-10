import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { colors, spacing, fontSize, fontWeight } from '@/constants/Colors';
import { addSatelliteToggle } from '@/src/utils/mapHelper';

export default function MapScreen() {
  const router = useRouter();
  const { trips, loadTrips } = useTripStore();
  const { rivers, loadRivers } = useRiverStore();

  useEffect(() => {
    loadTrips();
    loadRivers();
  }, []);

  // Collect all pins from trips that have coordinates
  // Use river coordinates, not trip coordinates
  const pins = rivers
    .filter((r) => {
      const lat = parseFloat((r as any).latitude);
      const lng = parseFloat((r as any).longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    })
    .map((r) => {
      const riverTrips = trips.filter((t) => t.riverId === r.id);
      const totalCatch = riverTrips.reduce((s, t) => s + t.catchCount, 0);
      const location = [(r as any).region, (r as any).state].filter(Boolean).join(', ');
      return {
        id: r.id,
        lat: parseFloat((r as any).latitude),
        lng: parseFloat((r as any).longitude),
        riverName: r.name,
        location,
        tripCount: riverTrips.length,
        catchCount: totalCatch,
      };
    });

  // Center on US if no pins
  const centerLat = pins.length > 0
    ? pins.reduce((s, p) => s + p.lat, 0) / pins.length
    : 39.8;
  const centerLng = pins.length > 0
    ? pins.reduce((s, p) => s + p.lng, 0) / pins.length
    : -98.5;
  const zoom = pins.length > 0 ? 6 : 4;

  if (Platform.OS === 'web') {
    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);
          ${pins.map((p) => `
            L.marker([${p.lat}, ${p.lng}])
              .addTo(map)
              .bindPopup('<b>${p.riverName.replace(/'/g, "\\'")}</b>${p.location ? `<br>${p.location}` : ''}${p.tripCount > 0 ? `<br>${p.tripCount} trips` : ''}${p.catchCount > 0 ? ` · ${p.catchCount} fish` : ''}<br><button onclick="window.parent.postMessage(JSON.stringify({type:\\'goToRiver\\',id:\\'${p.id}\\'}),\\'*\\')" style="margin-top:6px;padding:6px 12px;background:#0EA5E9;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;width:100%">View River</button>');
          `).join('')}
        </script>
      </body>
      </html>
    `;

    // Listen for pin clicks
    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'goToRiver') {
            router.push(`/river/${data.id}`);
          }
        } catch {}
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, []);

    return (
      <View style={styles.container}>
        <iframe
          srcDoc={addSatelliteToggle(mapHtml)}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
        />
        {pins.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No pins yet</Text>
              <Text style={styles.emptyText}>Pin locations when logging trips to see them here</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // Native: use react-native-maps
  const MapView = require('react-native-maps').default;
  const { Marker } = require('react-native-maps');

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: pins.length > 0 ? 8 : 40,
          longitudeDelta: pins.length > 0 ? 8 : 40,
        }}
        showsUserLocation
      >
        {pins.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.riverName}
            description={`${p.location || ''}${p.tripCount > 0 ? ` · ${p.tripCount} trips` : ''}${p.catchCount > 0 ? ` · ${p.catchCount} fish` : ''}`}
            onCalloutPress={() => router.push(`/river/${p.id}`)}
          />
        ))}
      </MapView>
      {pins.length === 0 ? (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No pins yet</Text>
            <Text style={styles.emptyText}>Pin locations when logging trips to see them here</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  emptyOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    width: 250,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
