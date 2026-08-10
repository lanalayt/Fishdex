import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { geocodeRiver, geocodeRiverLocation } from '@/src/utils/geocode';
import { addSatelliteToggle } from '@/src/utils/mapHelper';

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (lat: number, lng: number) => void;
  label?: string;
  riverName?: string;
  city?: string;
  state?: string;
}

export function MapPicker({ latitude, longitude, onChange, label, riverName, city, state }: Props) {
  const [showMap, setShowMap] = useState(false);
  const [riverLat, setRiverLat] = useState<number | null>(null);
  const [riverLng, setRiverLng] = useState<number | null>(null);

  // Geocode river name when it changes
  useEffect(() => {
    if (riverName) {
      geocodeRiverLocation(riverName, city, state).then((result) => {
        if (result) {
          setRiverLat(result.lat);
          setRiverLng(result.lng);
        }
      });
    }
  }, [riverName]);

  const hasPin = latitude && longitude && latitude !== 0 && longitude !== 0;

  // On web, use an OpenStreetMap iframe with click-to-pin
  const lat = latitude || riverLat || 39.7392;
  const lng = longitude || riverLng || -104.9903;
  const zoom = hasPin ? 13 : (riverLat ? 11 : 7);

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handleIframeMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'mapClick') {
        onChange(data.lat, data.lng);
        setShowMap(false);
      }
    } catch {}
  };

  React.useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    const result = await geocodeRiver(mapSearchQuery);
    if (result) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'moveTo', lat: result.lat, lng: result.lng }),
        '*'
      );
    }
  };

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${lat}, ${lng}], ${zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        var marker = ${hasPin ? `L.marker([${lat}, ${lng}]).addTo(map)` : 'null'};
        map.on('click', function(e) {
          if (marker) map.removeLayer(marker);
          marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
          window.parent.postMessage(JSON.stringify({
            type: 'mapClick', lat: e.latlng.lat, lng: e.latlng.lng
          }), '*');
        });

        window.addEventListener('message', function(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.type === 'moveTo') {
              map.setView([data.lat, data.lng], 13);
            }
          } catch(err) {}
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.optional}>Optional</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setShowMap(true)}
      >
        <Ionicons
          name={hasPin ? 'location' : 'location-outline'}
          size={18}
          color={hasPin ? colors.accent : colors.primary}
        />
        <Text style={[styles.buttonText, !hasPin && styles.buttonPlaceholder]}>
          {hasPin
            ? `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`
            : 'Tap to pin location on map'}
        </Text>
        {hasPin ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onChange(0, 0);
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color={colors.error} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        )}
      </Pressable>

      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Tap to pin your location</Text>
            <Pressable onPress={() => setShowMap(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.mapSearchBar}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder="Search, e.g. Clear Creek, Golden"
              placeholderTextColor={colors.textTertiary}
              value={mapSearchQuery}
              onChangeText={setMapSearchQuery}
              onSubmitEditing={handleMapSearch}
              selectionColor={colors.primary}
            />
            <Pressable onPress={handleMapSearch}>
              <Text style={styles.mapSearchGo}>Go</Text>
            </Pressable>
          </View>
          <iframe
            ref={iframeRef as any}
            srcDoc={addSatelliteToggle(mapHtml)}
            style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
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
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  mapSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  mapSearchGo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
  },
});
