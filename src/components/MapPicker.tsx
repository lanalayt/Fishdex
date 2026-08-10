import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { geocodeRiver, geocodeRiverLocation } from '@/src/utils/geocode';

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (lat: number, lng: number) => void;
  label?: string;
  riverName?: string;
  city?: string;
  state?: string;
}

const DEFAULT_REGION: Region = {
  latitude: 39.7392,
  longitude: -104.9903,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

export function MapPicker({ latitude, longitude, onChange, label, riverName, city, state }: Props) {
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    latitude && longitude ? { latitude, longitude } : null
  );
  const [riverRegion, setRiverRegion] = useState<Region | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const mapRef = useRef<MapView>(null);

  const handleMapSearch = async () => {
    if (!mapSearch.trim()) return;
    const result = await geocodeRiver(mapSearch);
    if (result) {
      const region: Region = {
        latitude: result.lat,
        longitude: result.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
      mapRef.current?.animateToRegion(region, 500);
    }
  };

  // Geocode river name when it changes
  useEffect(() => {
    if (riverName) {
      geocodeRiverLocation(riverName, city, state).then((result) => {
        if (result) {
          const region: Region = {
            latitude: result.lat,
            longitude: result.lng,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          };
          setRiverRegion(region);
          // Animate map if it's open
          mapRef.current?.animateToRegion(region, 500);
        }
      });
    }
  }, [riverName]);

  const initialRegion: Region = latitude && longitude
    ? { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : riverRegion || DEFAULT_REGION;

  const handleMapPress = (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPin({ latitude: lat, longitude: lng });
  };

  const handleConfirm = () => {
    if (pin) {
      onChange(pin.latitude, pin.longitude);
    }
    setShowMap(false);
  };

  const handleClear = () => {
    setPin(null);
    onChange(0, 0);
    setShowMap(false);
  };

  const hasPin = latitude && longitude && latitude !== 0 && longitude !== 0;

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
            onPress={() => {
              setPin(null);
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
          {/* Search bar */}
          <View style={styles.mapSearchBar}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder="Search, e.g. Clear Creek, Golden"
              placeholderTextColor={colors.textTertiary}
              value={mapSearch}
              onChangeText={setMapSearch}
              onSubmitEditing={handleMapSearch}
              returnKeyType="search"
              selectionColor={colors.primary}
            />
            <Pressable onPress={handleMapSearch}>
              <Text style={styles.mapSearchGo}>Go</Text>
            </Pressable>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            onPress={handleMapPress}
            mapType={mapType}
            showsUserLocation
            showsMyLocationButton
          >
            {pin ? (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
              />
            ) : null}
          </MapView>

          {/* Satellite toggle */}
          <Pressable
            style={styles.satelliteToggle}
            onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
          >
            <Text style={styles.satelliteToggleText}>
              {mapType === 'standard' ? 'Satellite' : 'Map View'}
            </Text>
          </Pressable>

          {/* Instructions overlay */}
          {!pin ? (
            <View style={styles.instructionBanner}>
              <Ionicons name="finger-print-outline" size={16} color={colors.text} />
              <Text style={styles.instructionText}>Tap the map to drop a pin</Text>
            </View>
          ) : null}

          {/* Bottom controls */}
          <View style={styles.controls}>
            <Pressable style={styles.cancelButton} onPress={() => setShowMap(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            {pin ? (
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.confirmButton, !pin && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!pin}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.confirmButtonText}>Confirm Pin</Text>
            </Pressable>
          </View>
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
  satelliteToggle: {
    position: 'absolute',
    top: 70,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(11, 17, 32, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  satelliteToggleText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  mapSearchBar: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
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
  map: {
    flex: 1,
  },
  instructionBanner: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  clearButtonText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
});
