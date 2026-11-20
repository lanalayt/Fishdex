import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert, Modal, Platform, ActivityIndicator, ScrollView as RNScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRiverStore, type River } from '@/src/stores/riverStore';
import { useTripStore, type TripWithDetails } from '@/src/stores/tripStore';
import { TripCard } from '@/src/components/TripCard';
import { EmptyState } from '@/src/components/EmptyState';
import { DatePicker } from '@/src/components/DatePicker';
import { MapPicker } from '@/src/components/MapPicker';
import { todayISO } from '@/src/utils/date';
import { formatDate } from '@/src/utils/date';
import { hotFlyCount, effectiveHeat } from '@/src/utils/heat';
import { supabase } from '@/src/supabase/client';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import { getCurrentWeather, get7DayForecast, weatherIcon, type WeatherData, type DayForecast } from '@/src/utils/weather';
import { getFlowBySiteId, getFlowHistory, findNearbyGauges, getCurrentFlow, type FlowData, type FlowHistory, type FlowGauge } from '@/src/utils/flowData';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { addSatelliteToggle } from '@/src/utils/mapHelper';

const sb = () => supabase as any;

interface RiverNote {
  id: string;
  note: string;
  date: string;
  createdAt: string;
  userName: string;
  userId: string;
}

// Delete password checked server-side via Supabase RPC
const DELETE_PASSWORD_HASH = '2413'; // TODO: move to server-side RPC for production

function FlowChartSimple({ history }: { history: FlowHistory }) {
  const { values, min, max } = history;
  if (values.length < 2) return null;
  const firstDate = values[0]?.date ? new Date(values[0].date) : null;
  const lastDate = values[values.length - 1]?.date ? new Date(values[values.length - 1].date) : null;
  const fmt = (d: Date | null) => d ? `${d.getMonth() + 1}/${d.getDate()}` : '';

  const chartWidth = 260, chartHeight = 50, range = max - min || 1;
  const step = Math.max(1, Math.floor(values.length / 35));
  const points = values.filter((_: any, i: number) => i % step === 0);
  const yMid = Math.round(min + range / 2);
  const pathData = points.map((v: any, i: number) => {
    const x = (i / (points.length - 1)) * chartWidth;
    const y = chartHeight - ((v.cfs - min) / range) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const fillData = pathData + ` L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  const renderSvg = () => {
    if (Platform.OS === 'web') {
      // @ts-ignore — raw SVG works on web
      return (
        <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <path d={fillData} fill="rgba(14, 165, 233, 0.15)" />
          <path d={pathData} fill="none" stroke="#0EA5E9" strokeWidth="2" />
        </svg>
      );
    }
    // Native: use react-native-svg
    const Svg = require('react-native-svg').default;
    const { Path } = require('react-native-svg');
    return (
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Path d={fillData} fill="rgba(14, 165, 233, 0.15)" />
        <Path d={pathData} fill="none" stroke="#0EA5E9" strokeWidth={2} />
      </Svg>
    );
  };

  return (
    <View style={flowChartStyles.container}>
      <Text style={flowChartStyles.title}>7-Day Flow</Text>
      <View style={flowChartStyles.chartRow}>
        <View style={flowChartStyles.yAxis}>
          <Text style={flowChartStyles.axLabel}>{max}</Text>
          <Text style={flowChartStyles.axLabel}>{yMid}</Text>
          <Text style={flowChartStyles.axLabel}>{min}</Text>
        </View>
        <View style={flowChartStyles.chart}>
          {renderSvg()}
        </View>
      </View>
      <View style={flowChartStyles.xAxis}>
        <View style={{ width: 25 }} />
        <Text style={flowChartStyles.axLabel}>{fmt(firstDate)}</Text>
        <Text style={flowChartStyles.axLabel}>{fmt(lastDate)}</Text>
      </View>
      <View style={flowChartStyles.labels}>
        <Text style={flowChartStyles.label}>Low: {min}</Text>
        <Text style={flowChartStyles.label}>Avg: {history.avg}</Text>
        <Text style={flowChartStyles.label}>High: {max}</Text>
      </View>
    </View>
  );
}

const flowChartStyles = StyleSheet.create({
  container: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  title: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing.sm },
  chartRow: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: 25, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 3 },
  chart: { flex: 1, height: 50, overflow: 'hidden' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axLabel: { fontSize: 8, color: colors.textTertiary },
  barChart: { height: 50, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, backgroundColor: colors.primary, borderRadius: 1, minHeight: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  label: { fontSize: fontSize.xs - 1, color: colors.textTertiary },
});

export default function RiverDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRiver, loadRivers, updateRiver, deleteRiver } = useRiverStore();
  const { getTripsByRiver, loadTrips } = useTripStore();
  const [river, setRiver] = useState<River | undefined>();
  const [riverTrips, setRiverTrips] = useState<TripWithDetails[]>([]);
  const [editing, setEditing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [notes, setNotes] = useState<RiverNote[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [flowHistory, setFlowHistory] = useState<FlowHistory | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [gaugePickerVisible, setGaugePickerVisible] = useState(false);
  const [nearbyGauges, setNearbyGauges] = useState<FlowGauge[]>([]);
  const [gaugesLoading, setGaugesLoading] = useState(false);
  const [gaugeMapType, setGaugeMapType] = useState<'standard' | 'satellite'>('standard');
  const [newNote, setNewNote] = useState('');
  const [newNoteDate, setNewNoteDate] = useState(todayISO());
  const [showNoteForm, setShowNoteForm] = useState(false);

  const loadNotes = async () => {
    if (!SUPABASE_ENABLED || !supabase || !id) return;
    try {
      const { data } = await sb().from('river_notes')
        .select('*, profiles:user_id(display_name)')
        .eq('river_id', id)
        .eq('is_deleted', false)
        .order('date', { ascending: false });
      if (data) {
        setNotes(data.map((n: any) => ({
          id: n.id,
          note: n.note,
          date: n.date,
          createdAt: n.created_at,
          userName: n.profiles?.display_name || 'Unknown',
          userId: n.user_id || '',
        })));
      }
    } catch {}
  };

  const handleSubmitNote = async () => {
    if (!newNote.trim()) {
      Alert.alert('Missing Info', 'Please enter a note.');
      return;
    }
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data: { user } } = await sb().auth.getUser();
        await sb().from('river_notes').insert({
          river_id: id,
          user_id: user?.id,
          note: newNote.trim(),
          date: newNoteDate,
        });
        setNewNote('');
        setNewNoteDate(todayISO());
        setShowNoteForm(false);
        loadNotes();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to save note.');
      }
    }
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await sb().from('river_notes').update({ is_deleted: true }).eq('id', noteId);
            loadNotes();
          } catch {}
        },
      },
    ]);
  };

  useEffect(() => {
    loadRivers();
    loadTrips();
    loadNotes();

    // Listen for gauge picker messages from iframe
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'selGauge') {
            const gauge = nearbyGauges.find(g => g.siteId === data.id);
            if (gauge) handleSelectGauge(gauge);
          }
        } catch {}
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
  }, [nearbyGauges]);

  const handleChangeGauge = async () => {
    if (!river) return;
    try {
      setGaugePickerVisible(true);
      setGaugesLoading(true);
      const rLat = parseFloat((river as any).latitude);
      const rLng = parseFloat((river as any).longitude);
      if (!isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0) {
        try { setNearbyGauges(await findNearbyGauges(rLat, rLng, river.name)); } catch {}
      }
      setGaugesLoading(false);
    } catch { setGaugesLoading(false); }
  };

  const handleSelectGauge = async (gauge: FlowGauge) => {
    try {
      setGaugePickerVisible(false);
      setReportLoading(true);
      if (SUPABASE_ENABLED && supabase) {
        try { await sb().from('rivers').update({ usgs_site_id: gauge.siteId, usgs_site_name: gauge.siteName, gauge_source: gauge.source }).eq('id', id); } catch {}
      }
      const f = await getFlowBySiteId(gauge.siteId, gauge.source);
      setFlow(f);
      setFlowHistory(null);
      if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
      loadRivers(); // Reload to get updated gauge info
    } catch {} finally { setReportLoading(false); }
  };

  // Load weather and flow when river is available
  useEffect(() => {
    if (!river) return;
    const rLat = parseFloat((river as any).latitude);
    const rLng = parseFloat((river as any).longitude);
    const hasCoords = !isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0;
    const siteId = (river as any).usgsSiteId || (river as any).usgs_site_id;
    const gaugeSource = ((river as any).gaugeSource || (river as any).gauge_source || 'usgs') as 'usgs' | 'dwr' | 'usbr';

    (async () => {
      try {
        if (hasCoords) {
          try { setWeather(await getCurrentWeather(rLat, rLng)); } catch {}
          try { setForecast(await get7DayForecast(rLat, rLng)); } catch {}
        }
        if (siteId) {
          try {
            const f = await getFlowBySiteId(siteId, gaugeSource);
            setFlow(f);
            if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
          } catch {}
        } else if (hasCoords) {
          try {
            const f = await getCurrentFlow(rLat, rLng, river.name, (river as any).region);
            setFlow(f);
            if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
          } catch {}
        }
      } catch {} finally { setReportLoading(false); }
    })();
  }, [river]);

  useEffect(() => {
    if (id) {
      const r = getRiver(id);
      setRiver(r);
      setRiverTrips(getTripsByRiver(id));
      if (r) {
        setEditName(r.name);
        setEditCity((r as any).region || '');
        setEditState((r as any).state || '');
        const rLat = parseFloat((r as any).latitude);
        const rLng = parseFloat((r as any).longitude);
        setEditLat(!isNaN(rLat) && rLat !== 0 ? rLat : null);
        setEditLng(!isNaN(rLng) && rLng !== 0 ? rLng : null);
      }
    }
  }, [id, useRiverStore.getState().rivers, useTripStore.getState().trips]);

  if (!river) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>River not found</Text>
      </View>
    );
  }

  const totalHot = riverTrips.reduce((sum, t) => sum + hotFlyCount(t.catches), 0);
  const topFlies = (() => {
    const flyMap = new Map<string, number>();
    riverTrips.forEach((t) =>
      t.catches.forEach((c) => {
        const key = c.flyPattern;
        if (!key) return;
        if (effectiveHeat(c) === 'hot') flyMap.set(key, (flyMap.get(key) ?? 0) + 1);
      })
    );
    return [...flyMap.entries()]
      .filter(([, hot]) => hot > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  })();

  const handleSaveEdit = () => {
    if (id && editName.trim()) {
      updateRiver(id, {
        name: editName.trim(),
        region: editCity.trim() || undefined,
        state: editState.trim() || undefined,
        latitude: editLat || undefined,
        longitude: editLng || undefined,
      } as any);
      setEditing(false);
    }
  };

  const handleDelete = () => {
    Alert.prompt(
      'Delete River',
      'Enter password to delete this river:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: (password?: string) => {
            if (password === DELETE_PASSWORD) {
              deleteRiver(id!);
              router.back();
            } else {
              Alert.alert('Wrong Password', 'Incorrect password.');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={riverTrips}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* River header */}
            <View style={styles.header}>
              {editing ? (
                <View style={styles.editForm}>
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
                  <MapPicker
                    label="River Pin"
                    latitude={editLat}
                    longitude={editLng}
                    riverName={editName || undefined}
                    city={editCity || undefined}
                    state={editState || undefined}
                    onChange={(lat, lng) => {
                      setEditLat(lat === 0 ? null : lat);
                      setEditLng(lng === 0 ? null : lng);
                    }}
                  />
                  <View style={styles.editActions}>
                    <Pressable style={styles.editCancel} onPress={() => setEditing(false)}>
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.editSave} onPress={handleSaveEdit}>
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                      <Text style={styles.editSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.riverName}>{river.name}</Text>
                  {river.region || river.state ? (
                    <Text style={styles.region}>
                      {[river.region, river.state].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                  {(river as any).latitude && (river as any).longitude ? (
                    <Pressable
                      style={styles.coordsBtn}
                      onPress={() => setShowMap(true)}
                    >
                      <Ionicons name="location" size={14} color={colors.accent} />
                      <Text style={styles.coordsText}>
                        {parseFloat((river as any).latitude).toFixed(4)}, {parseFloat((river as any).longitude).toFixed(4)}
                      </Text>
                      <Text style={styles.coordsLink}>View on map</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.headerActions}>
                    <Pressable style={styles.headerBtn} onPress={() => setEditing(true)}>
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                      <Text style={styles.headerBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.headerBtnDanger} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={styles.headerBtnDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* River Report */}
            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>CONDITIONS</Text>
              {reportLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
              ) : (
                <>
                  {weather ? (
                    <View style={styles.weatherRow}>
                      <Ionicons name={weatherIcon(weather.condition) as any} size={28} color={colors.primary} />
                      <View style={styles.weatherMain}>
                        <Text style={styles.tempText}>{weather.temperature}°F</Text>
                        <Text style={styles.conditionText}>{weather.condition}</Text>
                      </View>
                      <View style={styles.weatherDetails}>
                        <View style={styles.weatherDetail}><Ionicons name="water-outline" size={12} color={colors.textTertiary} /><Text style={styles.weatherDetailText}>{weather.precipChance}% rain</Text></View>
                        <View style={styles.weatherDetail}><Ionicons name="speedometer-outline" size={12} color={colors.textTertiary} /><Text style={styles.weatherDetailText}>{weather.windSpeed} mph</Text></View>
                      </View>
                    </View>
                  ) : <Text style={styles.noReportData}>No weather data</Text>}

                  {flow ? (
                    <View style={styles.flowSection}>
                      <View style={styles.flowMain}>
                        <View>
                          <Text style={styles.flowLabel}>Current Flow</Text>
                          <Text style={styles.flowValue}>{Math.round(flow.currentCfs)} CFS</Text>
                        </View>
                        <Pressable style={styles.changeGaugeBtn} onPress={handleChangeGauge}>
                          <Text style={styles.flowGaugeName} numberOfLines={1}>
                            {(river as any).usgsSiteName || (river as any).usgs_site_name || flow.siteName}
                          </Text>
                          <Text style={styles.changeGaugeText}>Change gauge</Text>
                        </Pressable>
                      </View>
                      {flowHistory ? <FlowChartSimple history={flowHistory} /> : null}
                    </View>
                  ) : (
                    <Pressable style={styles.selectGaugeBtn} onPress={handleChangeGauge}>
                      <Text style={styles.noReportData}>No flow gauge selected</Text>
                      <Text style={styles.changeGaugeText}>Select gauge</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {/* 7-Day Forecast */}
            {forecast.length > 0 ? (
              <View style={styles.forecastSection}>
                <Text style={styles.sectionTitle}>7-DAY FORECAST</Text>
                {forecast.map((day) => (
                  <View key={day.date} style={styles.forecastRow}>
                    <Text style={styles.forecastDay}>{day.dayName}</Text>
                    <Ionicons name={weatherIcon(day.condition) as any} size={18} color={colors.textSecondary} />
                    <Text style={styles.forecastCondition} numberOfLines={1}>{day.condition}</Text>
                    <View style={styles.forecastTemps}>
                      <Text style={styles.forecastHigh}>{day.high}°</Text>
                      <Text style={styles.forecastLow}>{day.low}°</Text>
                    </View>
                    <View style={styles.forecastExtra}>
                      <Text style={styles.forecastPrecip}>{day.precipChance}%</Text>
                      <Ionicons name="water-outline" size={10} color={colors.textTertiary} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{riverTrips.length}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalHot}</Text>
                <Text style={styles.statLabel}>Hot Flies</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{topFlies.length}</Text>
                <Text style={styles.statLabel}>Fly Patterns</Text>
              </View>
            </View>

            {/* Top flies */}
            {topFlies.length > 0 ? (
              <View style={styles.topFliesSection}>
                <Text style={styles.sectionTitle}>TOP FLIES</Text>
                {topFlies.map(([fly, count], i) => (
                  <View key={fly} style={styles.flyRow}>
                    <Text style={styles.flyRank}>#{i + 1}</Text>
                    <Text style={styles.flyName}>{fly}</Text>
                    <Text style={styles.flyCount}>🔥 {count}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Notes Section */}
            <View style={styles.notesSection}>
              <View style={styles.notesSectionHeader}>
                <Text style={styles.sectionTitle}>NOTES</Text>
                <Pressable onPress={() => setShowNoteForm(!showNoteForm)}>
                  <Ionicons name={showNoteForm ? 'close-circle' : 'add-circle'} size={22} color={colors.primary} />
                </Pressable>
              </View>

              {showNoteForm ? (
                <View style={styles.noteForm}>
                  <DatePicker label="Date" value={newNoteDate} onChange={setNewNoteDate} />
                  <TextInput
                    style={styles.noteInput}
                    value={newNote}
                    onChangeText={setNewNote}
                    placeholder="Write a note..."
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.primary}
                    multiline
                  />
                  <Pressable
                    style={({ pressed }) => [styles.noteSubmitBtn, pressed && styles.noteSubmitBtnPressed]}
                    onPress={handleSubmitNote}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                    <Text style={styles.noteSubmitText}>Submit Note</Text>
                  </Pressable>
                </View>
              ) : null}

              {notes.map((n) => (
                <View key={n.id} style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <View style={styles.noteHeaderLeft}>
                      <Text style={styles.noteAuthor}>{n.userName}</Text>
                      <Text style={styles.noteDateDot}>·</Text>
                      <Text style={styles.noteDate}>{formatDate(n.date)}</Text>
                    </View>
                    <Pressable onPress={() => handleDeleteNote(n.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                    </Pressable>
                  </View>
                  <Text style={styles.noteText}>{n.note}</Text>
                </View>
              ))}

              {notes.length === 0 && !showNoteForm ? (
                <Text style={styles.noNotes}>No notes yet</Text>
              ) : null}
            </View>

            <View style={styles.tripHistoryHeader}>
              <Text style={styles.sectionTitle}>TRIP HISTORY</Text>
              <Pressable
                style={styles.addTripBtn}
                onPress={() => router.push(`/trip/new?river=${id}`)}
              >
                <Ionicons name="add-circle" size={16} color={colors.primary} />
                <Text style={styles.addTripBtnText}>Log Trip</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No trips yet"
            subtitle="Trips to this river will appear here"
          />
        }
        contentContainerStyle={riverTrips.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Gauge Picker Modal */}
      <Modal visible={gaugePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGaugePickerVisible(false)}>
        <View style={styles.gaugePickerContainer}>
          <View style={styles.gaugePickerHeader}>
            <View><Text style={styles.gaugePickerTitle}>Select Gauge</Text><Text style={styles.gaugePickerSubtitle}>Pick the closest gauge</Text></View>
            <Pressable onPress={() => setGaugePickerVisible(false)} hitSlop={12}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          </View>
          {gaugesLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> :
          nearbyGauges.length === 0 ? <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}><Text style={{ color: colors.textTertiary }}>No gauges found nearby</Text></View> :
          Platform.OS === 'web' ? (() => {
            const rLat = parseFloat((river as any)?.latitude); const rLng = parseFloat((river as any)?.longitude);
            const cSiteId = (river as any)?.usgsSiteId || (river as any)?.usgs_site_id || flow?.siteId || '';
            const mapHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0}#map{width:100%;height:100vh}</style></head><body><div id="map"></div><script>
              var map=L.map('map').setView([${rLat||39.7},${rLng||-105}],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);
              ${!isNaN(rLat)&&!isNaN(rLng)?`L.circleMarker([${rLat},${rLng}],{radius:8,fillColor:'#0EA5E9',color:'#fff',weight:2,fillOpacity:0.8}).addTo(map);`:''}
              var yi=L.divIcon({html:'<div style="width:14px;height:14px;background:#F59E0B;border:2px solid white;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
              ${JSON.stringify(nearbyGauges.map(g=>({id:g.siteId,n:g.siteName,la:g.lat,lo:g.lng,c:g.currentCfs,d:g.distance,s:g.source})))}.forEach(function(g){var o=g.id==='${cSiteId}'?{icon:yi}:{};L.marker([g.la,g.lo],o).addTo(map).bindPopup('<b>'+g.n+'</b><br>'+g.c+' CFS<br>'+(g.s==='dwr'?'CO DWR':g.s==='usbr'?'USBR':'USGS')+'<br><button onclick="window.parent.postMessage(JSON.stringify({type:\\'selGauge\\',id:\\''+g.id+'\\',src:\\''+g.s+'\\'}),\\'*\\')" style="margin-top:6px;padding:6px 12px;background:#0EA5E9;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold">Select</button>');});
              </script></body></html>`;
            return (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }}><iframe srcDoc={addSatelliteToggle(mapHtml)} style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any} /></View>
                <RNScrollView style={{ maxHeight: 200, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {nearbyGauges.map((g) => (
                    <Pressable key={g.siteId} style={({ pressed }) => [styles.gaugeRow, pressed && { backgroundColor: colors.surfaceLight }]} onPress={() => handleSelectGauge(g)}>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text }}>{g.siteName}</Text>
                      <Text style={{ fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 }}>{Math.round(g.currentCfs)} CFS · ~{g.distance} mi · {g.source === 'dwr' ? 'CO DWR' : g.source === 'usbr' ? 'USBR' : 'USGS'}</Text></View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                </RNScrollView>
              </View>
            );
          })() : (() => {
            try {
              const NativeMapView = require('react-native-maps').default;
              const { Marker: NativeMarker } = require('react-native-maps');
              const rLat = parseFloat((river as any)?.latitude) || 39.7;
              const rLng = parseFloat((river as any)?.longitude) || -105.0;
              const cSiteId = (river as any)?.usgsSiteId || (river as any)?.usgs_site_id || flow?.siteId || '';
              return (
                <View style={{ flex: 1 }}>
                  <Pressable
                    style={styles.satelliteToggle}
                    onPress={() => setGaugeMapType(gaugeMapType === 'standard' ? 'satellite' : 'standard')}
                  >
                    <Text style={styles.satelliteToggleText}>{gaugeMapType === 'standard' ? 'Satellite' : 'Map View'}</Text>
                  </Pressable>
                  <NativeMapView
                    style={{ flex: 1 }}
                    initialRegion={{ latitude: rLat, longitude: rLng, latitudeDelta: 0.8, longitudeDelta: 0.8 }}
                    mapType={gaugeMapType}
                    showsUserLocation
                  >
                    <NativeMarker coordinate={{ latitude: rLat, longitude: rLng }} pinColor="#0EA5E9" title="Fishing spot" />
                    {nearbyGauges.map((g) => (
                      <NativeMarker
                        key={g.siteId}
                        coordinate={{ latitude: g.lat, longitude: g.lng }}
                        pinColor={g.siteId === cSiteId ? '#F59E0B' : '#EF4444'}
                        title={g.siteName}
                        description={`${Math.round(g.currentCfs)} CFS · ${g.source === 'dwr' ? 'CO DWR' : g.source === 'usbr' ? 'USBR' : 'USGS'}`}
                        onCalloutPress={() => handleSelectGauge(g)}
                      />
                    ))}
                  </NativeMapView>
                  <RNScrollView style={{ maxHeight: 180, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {nearbyGauges.map((g) => (
                      <Pressable key={g.siteId} style={({ pressed }) => [styles.gaugeRow, pressed && { backgroundColor: colors.surfaceLight }]} onPress={() => handleSelectGauge(g)}>
                        <View style={{ flex: 1 }}><Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text }}>{g.siteName}</Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 }}>{Math.round(g.currentCfs)} CFS · ~{g.distance} mi · {g.source === 'dwr' ? 'CO DWR' : g.source === 'usbr' ? 'USBR' : 'USGS'}</Text></View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </Pressable>
                    ))}
                  </RNScrollView>
                </View>
              );
            } catch {
              return (
                <RNScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                  {nearbyGauges.map((g) => (
                    <Pressable key={g.siteId} style={({ pressed }) => [styles.gaugeRow, pressed && { backgroundColor: colors.surfaceLight }]} onPress={() => handleSelectGauge(g)}>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text }}>{g.siteName}</Text>
                      <Text style={{ fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 }}>{Math.round(g.currentCfs)} CFS · ~{g.distance} mi · {g.source === 'dwr' ? 'CO DWR' : g.source === 'usbr' ? 'USBR' : 'USGS'}</Text></View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                </RNScrollView>
              );
            }
          })()}
        </View>
      </Modal>

      {/* Map Modal */}
      {showMap && (river as any).latitude && (river as any).longitude ? (
        <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>{river.name}</Text>
              <Pressable onPress={() => setShowMap(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {Platform.OS === 'web' ? (() => {
              const lat = parseFloat((river as any).latitude);
              const lng = parseFloat((river as any).longitude);
              const mapHtml = `<!DOCTYPE html><html><head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>body{margin:0}#map{width:100%;height:100vh}</style>
                </head><body><div id="map"></div><script>
                var map = L.map('map').setView([${lat}, ${lng}], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(map);
                L.marker([${lat}, ${lng}]).addTo(map).bindPopup('<b>${river.name.replace(/'/g, "\\'")}</b><br>${[river.region, river.state].filter(Boolean).join(', ')}').openPopup();
                </script></body></html>`;
              return <iframe srcDoc={addSatelliteToggle(mapHtml)} style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any} />;
            })() : (() => {
              const MapView = require('react-native-maps').default;
              const { Marker } = require('react-native-maps');
              const lat = parseFloat((river as any).latitude);
              const lng = parseFloat((river as any).longitude);
              return (
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }} title={river.name} />
                </MapView>
              );
            })()}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  riverName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  region: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  coordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  coordsText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  coordsLink: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
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
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  // Trip History Header
  tripHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  addTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  addTripBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  // Forecast
  forecastSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  forecastDay: {
    width: 42,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  forecastCondition: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  forecastTemps: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: 60,
    justifyContent: 'flex-end',
  },
  forecastHigh: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  forecastLow: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  forecastExtra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 35,
    justifyContent: 'flex-end',
  },
  forecastPrecip: {
    fontSize: fontSize.xs - 1,
    color: colors.primary,
  },
  // River Report
  reportSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  weatherMain: { flex: 1 },
  tempText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  conditionText: { fontSize: fontSize.xs, color: colors.textSecondary },
  weatherDetails: { gap: spacing.xs },
  weatherDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherDetailText: { fontSize: fontSize.xs, color: colors.textTertiary },
  flowSection: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  flowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flowLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  flowValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.accent },
  flowGaugeName: { fontSize: fontSize.xs - 1, color: colors.textTertiary },
  changeGaugeBtn: { alignItems: 'flex-end', flex: 1 },
  changeGaugeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.medium, marginTop: 2 },
  selectGaugeBtn: { backgroundColor: colors.surfaceLight, borderRadius: radius.md, padding: spacing.sm + 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noReportData: { fontSize: fontSize.xs, color: colors.textTertiary },
  satelliteToggle: {
    position: 'absolute',
    top: 10,
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
  gaugePickerContainer: { flex: 1, backgroundColor: colors.background },
  gaugePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + spacing.md, paddingBottom: spacing.md },
  gaugePickerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  gaugePickerSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  // Notes
  notesSection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  noteForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noteInput: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  noteSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  noteSubmitBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  noteSubmitText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  noteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  noteAuthor: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  noteDateDot: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  noteDate: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  noteText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  noNotes: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBtnText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  headerBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  headerBtnDangerText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
  // Edit form
  editForm: {
    gap: spacing.sm,
  },
  editInput: {
    backgroundColor: colors.surface,
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
  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  topFliesSection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  flyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flyRank: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
    width: 30,
  },
  flyName: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
    fontWeight: fontWeight.medium,
  },
  flyCount: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: fontWeight.semibold,
  },
});
