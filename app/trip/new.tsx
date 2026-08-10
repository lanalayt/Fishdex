import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore, type CatchInput, type AdviceInput } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { FormField } from '@/src/components/FormField';
import { DatePicker } from '@/src/components/DatePicker';
import { FlyPatternPicker } from '@/src/components/FlyPatternPicker';
import { MapPicker } from '@/src/components/MapPicker';
import { todayISO } from '@/src/utils/date';
import { searchRiversDebounced, type RiverResult } from '@/src/utils/riverSearch';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

const WEATHER_OPTIONS = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Snowy', 'Windy'];

export default function NewTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string; river?: string }>();
  const isEdit = !!params.edit;

  const { createTrip, updateTrip, getTrip } = useTripStore();
  const { rivers, loadRivers, createRiver, updateRiver } = useRiverStore();

  // Form state
  const [date, setDate] = useState(todayISO());
  const [riverId, setRiverId] = useState(params.river || '');
  const [newRiverName, setNewRiverName] = useState('');
  const [newRiverCity, setNewRiverCity] = useState('');
  const [newRiverState, setNewRiverState] = useState('');
  const [showNewRiver, setShowNewRiver] = useState(false);
  const [editingRiver, setEditingRiver] = useState(false);
  const [riverSearch, setRiverSearch] = useState('');
  const [newRiverLat, setNewRiverLat] = useState<number | null>(null);
  const [newRiverLng, setNewRiverLng] = useState<number | null>(null);
  const [locationOnRiver, setLocationOnRiver] = useState('');
  const [weather, setWeather] = useState('');
  const [temperature, setTemperature] = useState('');
  const [flowCfs, setFlowCfs] = useState('');
  const [leaderLength, setLeaderLength] = useState('');
  const [tippetSize, setTippetSize] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [riverSearchResults, setRiverSearchResults] = useState<RiverResult[]>([]);
  const [notes, setNotes] = useState('');
  const [catches, setCatches] = useState<CatchInput[]>([]);
  const [advices, setAdvices] = useState<AdviceInput[]>([]);

  useEffect(() => {
    loadRivers();
  }, []);

  // Pre-fill coordinates from river when coming from river page
  useEffect(() => {
    if (params.river && rivers.length > 0 && !latitude) {
      const r = rivers.find(rv => rv.id === params.river);
      if (r) {
        const rLat = parseFloat((r as any).latitude);
        const rLng = parseFloat((r as any).longitude);
        if (!isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0) {
          setLatitude(rLat);
          setLongitude(rLng);
        }
      }
    }
  }, [params.river, rivers]);

  // Load existing trip data if editing
  useEffect(() => {
    if (isEdit && params.edit) {
      const trip = getTrip(params.edit);
      if (trip) {
        setDate(trip.date);
        setRiverId(trip.riverId);
        setLocationOnRiver(trip.locationOnRiver ?? '');
        setWeather(trip.weather ?? '');
        setTemperature((trip as any).temperature ?? '');
        setFlowCfs(trip.flowCfs?.toString() ?? '');
        setLeaderLength((trip as any).leaderLength ?? '');
        setTippetSize((trip as any).tippetSize ?? '');
        const lat = (trip as any).latitude;
        const lng = (trip as any).longitude;
        if (lat && lng) { setLatitude(parseFloat(lat)); setLongitude(parseFloat(lng)); }
        setNotes(trip.notes ?? '');
        setCatches(
          trip.catches.map((c) => ({
            flyPattern: c.flyPattern,
            flySize: c.flySize ?? '',
            flyColor: (c as any).flyColor ?? '',
            count: c.count ?? 0,
            notes: c.notes ?? '',
          }))
        );
        setAdvices(
          trip.flyShopAdvice.map((a) => ({
            shopName: a.shopName,
            advice: a.advice ?? '',
            recommendedFlies: a.recommendedFlies ?? '',
          }))
        );
      }
    }
  }, [isEdit, params.edit]);

  const addCatch = () => {
    setCatches([
      ...catches,
      { flyPattern: '', flySize: '', flyColor: '', count: 0, notes: '' },
    ]);
  };

  const updateCatch = (index: number, field: keyof CatchInput, value: string | number) => {
    const updated = [...catches];
    (updated[index] as any)[field] = value;
    setCatches(updated);
  };

  const removeCatch = (index: number) => {
    setCatches(catches.filter((_, i) => i !== index));
  };

  const addAdvice = () => {
    setAdvices([...advices, { shopName: '', advice: '', recommendedFlies: '' }]);
  };

  const updateAdvice = (index: number, field: keyof AdviceInput, value: string) => {
    const updated = [...advices];
    (updated[index] as any)[field] = value;
    setAdvices(updated);
  };

  const removeAdvice = (index: number) => {
    setAdvices(advices.filter((_, i) => i !== index));
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!riverId) {
      Alert.alert('Missing Info', 'Please select a river. Add one from the home screen if needed.');
      return;
    }

    if (!date) {
      Alert.alert('Missing Info', 'Please enter a date.');
      return;
    }

    const tripData = {
      riverId,
      date,
      locationOnRiver: locationOnRiver || undefined,
      weather: weather || undefined,
      temperature: temperature || undefined,
      flowCfs: flowCfs ? parseInt(flowCfs, 10) : undefined,
      leaderLength: leaderLength || undefined,
      tippetSize: tippetSize || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      notes: notes || undefined,
      catches,
      flyShopAdvice: advices,
    };

    setSaving(true);
    try {
      if (isEdit && params.edit) {
        await updateTrip(params.edit, tripData);
      } else {
        await createTrip(tripData);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong saving the trip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Date ── */}
        <Text style={styles.sectionTitle}>Trip Info</Text>

        <DatePicker label="Date" value={date} onChange={setDate} />

        {/* ── River ── */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>RIVER</Text>
          {rivers.length > 3 ? (
            <View style={styles.riverSearchBar}>
              <Ionicons name="search" size={14} color={colors.textTertiary} />
              <TextInput
                style={styles.riverSearchInput}
                placeholder="Search rivers..."
                placeholderTextColor={colors.textTertiary}
                value={riverSearch}
                onChangeText={setRiverSearch}
                selectionColor={colors.primary}
              />
              {riverSearch ? (
                <Pressable onPress={() => setRiverSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {riverId ? (
            <View style={styles.selectedRiverBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.selectedRiverText}>
                {rivers.find(r => r.id === riverId)?.name || 'Selected'}
                {(() => {
                  const r = rivers.find(rv => rv.id === riverId);
                  const loc = [(r as any)?.region, (r as any)?.state].filter(Boolean).join(', ');
                  return loc ? ` — ${loc}` : '';
                })()}
              </Text>
              <Pressable onPress={() => setRiverId('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          ) : null}
          {rivers.length === 0 ? (
            <Pressable
              style={styles.addRiverHint}
              onPress={() => router.push('/river/new')}
            >
              <Ionicons name="water-outline" size={18} color={colors.primary} />
              <Text style={styles.addRiverHintText}>Add a river first</Text>
            </Pressable>
          ) : (
            <ScrollView
              horizontal={!riverSearch}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={riverSearch ? styles.riverListVertical : styles.chipScroll}
              contentContainerStyle={riverSearch ? styles.riverListContent : styles.chipContainer}
            >
              {rivers
                .filter((r) => {
                  if (!riverSearch) return true;
                  const q = riverSearch.toLowerCase();
                  return (
                    r.name.toLowerCase().includes(q) ||
                    ((r as any).region || '').toLowerCase().includes(q) ||
                    ((r as any).state || '').toLowerCase().includes(q)
                  );
                })
                .map((r) => (
                <Pressable
                  key={r.id}
                  style={riverSearch
                    ? [styles.riverListItem, riverId === r.id && styles.riverListItemSelected]
                    : [styles.chip, riverId === r.id && styles.chipSelected]
                  }
                  onPress={() => {
                    setRiverId(r.id);
                    setRiverSearch('');
                    const rLat = parseFloat((r as any).latitude);
                    const rLng = parseFloat((r as any).longitude);
                    if (!isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0) {
                      setLatitude(rLat);
                      setLongitude(rLng);
                    }
                  }}
                >
                  {riverSearch ? (
                    <View>
                      <Text style={[styles.riverListName, riverId === r.id && styles.chipTextSelected]}>
                        {r.name}
                      </Text>
                      {(r as any).region || (r as any).state ? (
                        <Text style={styles.riverListDetail}>
                          {[(r as any).region, (r as any).state].filter(Boolean).join(', ')}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.chipText, riverId === r.id && styles.chipTextSelected]}>
                      {r.name}
                      {(r as any).region || (r as any).state
                        ? ` (${[(r as any).region, (r as any).state].filter(Boolean).join(', ')})`
                        : ''}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
        {/* Rivers are now added from the dedicated Add River screen */}

        <FormField
          label="Location on River"
          optional
          value={locationOnRiver}
          onChangeText={setLocationOnRiver}
          placeholder="e.g., Below the dam, Mile marker 12"
        />

        <MapPicker
          label="Trip Location Pin"
          latitude={latitude}
          longitude={longitude}
          riverName={rivers.find(r => r.id === riverId)?.name}
          onChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />

        {/* ── Weather ── */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>WEATHER</Text>
            <Text style={styles.optional}>Optional</Text>
          </View>
          <View style={styles.weatherGrid}>
            {WEATHER_OPTIONS.map((w) => (
              <Pressable
                key={w}
                style={[styles.weatherChip, weather === w && styles.weatherChipSelected]}
                onPress={() => setWeather(weather === w ? '' : w)}
              >
                <Text
                  style={[
                    styles.weatherChipText,
                    weather === w && styles.weatherChipTextSelected,
                  ]}
                >
                  {w}
                </Text>
              </Pressable>
            ))}
          </View>
          <FormField
            label="Temperature"
            optional
            value={temperature}
            onChangeText={setTemperature}
            placeholder="e.g., 65°F"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <FormField
          label="Flow (CFS)"
          optional
          value={flowCfs}
          onChangeText={setFlowCfs}
          placeholder="e.g., 450"
          keyboardType="numeric"
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <FormField
              label="Leader"
              optional
              value={leaderLength}
              onChangeText={setLeaderLength}
              placeholder="e.g., 9ft"
            />
          </View>
          <View style={styles.halfField}>
            <FormField
              label="Tippet"
              optional
              value={tippetSize}
              onChangeText={setTippetSize}
              placeholder="e.g., 5X"
            />
          </View>
        </View>

        <FormField
          label="Notes"
          optional
          value={notes}
          onChangeText={setNotes}
          placeholder="General trip notes..."
          multiline
        />

        {/* ── Catches ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catches</Text>
          <Text style={styles.sectionCount}>
            {catches.length} {catches.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>

        {catches.map((c, i) => (
          <View key={i} style={styles.catchCard}>
            <View style={styles.catchHeader}>
              <Text style={styles.catchNumber}>Catch #{i + 1}</Text>
              <Pressable onPress={() => removeCatch(i)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>FLY PATTERN</Text>
              <FlyPatternPicker
                value={c.flyPattern}
                onChange={(v) => updateCatch(i, 'flyPattern', v)}
                onFlySelected={(fly) => {
                  if (!c.flySize && fly.commonSizes.length > 0) {
                    updateCatch(i, 'flySize', fly.commonSizes[Math.floor(fly.commonSizes.length / 2)]);
                  }
                }}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <FormField
                  label="Fly Size"
                  optional
                  value={c.flySize ?? ''}
                  onChangeText={(v) => updateCatch(i, 'flySize', v)}
                  placeholder="#16"
                />
              </View>
              <View style={styles.halfField}>
                <FormField
                  label="Count"
                  value={(c.count ?? 0).toString()}
                  onChangeText={(v) => updateCatch(i, 'count', parseInt(v, 10) || 0)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            </View>

            <FormField
              label="Color"
              optional
              value={c.flyColor ?? ''}
              onChangeText={(v) => updateCatch(i, 'flyColor', v)}
              placeholder="e.g., Olive, Red/Brown, Black/White"
            />

            <FormField
              label="Notes"
              optional
              value={c.notes ?? ''}
              onChangeText={(v) => updateCatch(i, 'notes', v)}
              placeholder="Notes about this catch..."
            />
          </View>
        ))}

        <Pressable style={styles.addButton} onPress={addCatch}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>Add Catch</Text>
        </Pressable>

        {/* ── Fly Shop Advice ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fly Shop Advice</Text>
          <Text style={styles.sectionCount}>
            {advices.length} {advices.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>

        {advices.map((a, i) => (
          <View key={i} style={styles.catchCard}>
            <View style={styles.catchHeader}>
              <Text style={styles.catchNumber}>Shop #{i + 1}</Text>
              <Pressable onPress={() => removeAdvice(i)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>

            <FormField
              label="Shop Name"
              value={a.shopName}
              onChangeText={(v) => updateAdvice(i, 'shopName', v)}
              placeholder="e.g., Blue Quill Angler"
            />

            <FormField
              label="Advice"
              optional
              value={a.advice ?? ''}
              onChangeText={(v) => updateAdvice(i, 'advice', v)}
              placeholder="What did they recommend?"
              multiline
            />

            <FormField
              label="Recommended Flies"
              optional
              value={a.recommendedFlies ?? ''}
              onChangeText={(v) => updateAdvice(i, 'recommendedFlies', v)}
              placeholder="e.g., PMD, BWO, RS2"
            />
          </View>
        ))}

        <Pressable style={styles.addButton} onPress={addAdvice}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>Add Fly Shop Advice</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <Pressable
          style={({ pressed }) => [styles.saveButton, saving && styles.saveButtonDisabled, pressed && !saving && styles.saveButtonPressed]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
          )}
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : isEdit ? 'Update Trip' : 'Save Trip'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionCount: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  fieldContainer: {
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
  cancelText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  selectedRiverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  selectedRiverText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  addRiverHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addRiverHintText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  riverSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    height: 36,
    marginBottom: spacing.sm,
  },
  riverSearchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  riverListVertical: {
    maxHeight: 200,
  },
  riverListContent: {
    gap: spacing.xs,
  },
  riverListItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  riverListItemSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: colors.primary,
  },
  riverListName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  riverListDetail: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  editRiverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  editRiverText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  saveRiverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  saveRiverButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  searchInputContainer: {
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
  searchInputField: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  searchResults: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultPressed: {
    backgroundColor: colors.surfaceLight,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  searchResultDetail: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  searchHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.md,
    color: colors.text,
  },
  chipScroll: {
    marginHorizontal: -spacing.lg,
  },
  chipContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: colors.primary,
  },
  chipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weatherChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weatherChipSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: colors.primary,
  },
  weatherChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  weatherChipTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  catchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  catchNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  addButtonText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  bottomSpacer: {
    height: 120,
  },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 12,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadow.md,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
});
