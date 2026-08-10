import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRiverStore } from '@/src/stores/riverStore';
import { useTripStore } from '@/src/stores/tripStore';
import { getCurrentWeather, weatherIcon, type WeatherData } from '@/src/utils/weather';
import { getFlowBySiteId, getFlowHistory, findNearbyGauges, getCurrentFlow, type FlowData, type FlowHistory, type FlowGauge } from '@/src/utils/flowData';
import { supabase } from '@/src/supabase/client';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { addSatelliteToggle } from '@/src/utils/mapHelper';

const sb = () => supabase as any;

// ── Flow Chart (web only) ──

function FlowChart({ history }: { history: FlowHistory }) {
  const { values, min, max } = history;
  if (values.length < 2) return null;
  const yMid = Math.round(min + (max - min) / 2);
  const firstDate = values[0]?.date ? new Date(values[0].date) : null;
  const lastDate = values[values.length - 1]?.date ? new Date(values[values.length - 1].date) : null;
  const midDate = values[Math.floor(values.length / 2)]?.date ? new Date(values[Math.floor(values.length / 2)].date) : null;
  const fmt = (d: Date | null) => d ? `${d.getMonth() + 1}/${d.getDate()}` : '';

  const chartWidth = 280, chartHeight = 60, range = max - min || 1;
  const step = Math.max(1, Math.floor(values.length / 40));
  const points = values.filter((_: any, i: number) => i % step === 0);
  const pathData = points.map((v: any, i: number) => {
    const x = (i / (points.length - 1)) * chartWidth;
    const y = chartHeight - ((v.cfs - min) / range) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const fillData = pathData + ` L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  const renderSvg = () => {
    if (Platform.OS === 'web') {
      // @ts-ignore
      return (
        <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <path d={fillData} fill="rgba(14, 165, 233, 0.15)" />
          <path d={pathData} fill="none" stroke="#0EA5E9" strokeWidth="2" />
        </svg>
      );
    }
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
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>7-Day Flow</Text>
      <View style={chartStyles.chartRow}>
        <View style={chartStyles.yAxis}>
          <Text style={chartStyles.axisLabel}>{max}</Text>
          <Text style={chartStyles.axisLabel}>{yMid}</Text>
          <Text style={chartStyles.axisLabel}>{min}</Text>
        </View>
        <View style={chartStyles.chart}>
          {renderSvg()}
        </View>
      </View>
      <View style={chartStyles.xAxis}>
        <View style={{ width: 30 }} />
        <Text style={chartStyles.axisLabel}>{fmt(firstDate)}</Text>
        <Text style={chartStyles.axisLabel}>{fmt(midDate)}</Text>
        <Text style={chartStyles.axisLabel}>{fmt(lastDate)}</Text>
      </View>
      <View style={chartStyles.labels}>
        <Text style={chartStyles.label}>Low: {min} CFS</Text>
        <Text style={chartStyles.label}>Avg: {history.avg} CFS</Text>
        <Text style={chartStyles.label}>High: {max} CFS</Text>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: spacing.md, backgroundColor: colors.surfaceLight, borderRadius: radius.md, padding: spacing.sm + 2 },
  title: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing.sm },
  chartRow: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: 30, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 },
  chart: { flex: 1, height: 60, overflow: 'hidden' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisLabel: { fontSize: 9, color: colors.textTertiary },
  barChart: { height: 50, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, backgroundColor: colors.primary, borderRadius: 1, minHeight: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  label: { fontSize: fontSize.xs - 1, color: colors.textTertiary },
});

// ── Gauge Picker ──

function GaugePicker({ visible, gauges, loading, centerLat, centerLng, currentSiteId, onSelect, onClose }: {
  visible: boolean; gauges: FlowGauge[]; loading: boolean;
  centerLat: number | null; centerLng: number | null; currentSiteId: string | null;
  onSelect: (gauge: FlowGauge) => void; onClose: () => void;
}) {
  const lat = centerLat || 39.7, lng = centerLng || -105.0;

  React.useEffect(() => {
    if (visible && Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'selectGauge') {
            const gauge = gauges.find(g => g.siteId === data.id);
            if (gauge) onSelect(gauge);
          }
        } catch {}
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
  }, [visible, gauges, onSelect]);

  const mapHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0}#map{width:100%;height:100vh}</style></head><body><div id="map"></div><script>
  var map = L.map('map').setView([${lat}, ${lng}], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'OpenStreetMap'}).addTo(map);
  L.circleMarker([${lat}, ${lng}], {radius:8,fillColor:'#0EA5E9',color:'#fff',weight:2,fillOpacity:0.8}).addTo(map).bindPopup('Fishing spot');
  var cid='${currentSiteId||''}';
  var gs=${JSON.stringify(gauges.map(g=>({id:g.siteId,name:g.siteName,lat:g.lat,lng:g.lng,cfs:g.currentCfs,dist:g.distance,src:g.source})))};
  var yi=L.divIcon({html:'<div style="width:14px;height:14px;background:#F59E0B;border:2px solid white;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
  gs.forEach(function(g){var o=g.id===cid?{icon:yi}:{};L.marker([g.lat,g.lng],o).addTo(map).bindPopup('<b>'+g.name+'</b><br>'+g.cfs+' CFS<br>'+(g.src==='dwr'?'CO DWR':'USGS')+'<br><button onclick="window.parent.postMessage(JSON.stringify({type:\\'selectGauge\\',id:\\''+g.id+'\\'}),\\'*\\')" style="margin-top:6px;padding:6px 12px;background:#0EA5E9;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold">Select</button>');});
  var legend=L.control({position:'bottomleft'});legend.onAdd=function(){var d=document.createElement('div');d.style.cssText='background:rgba(11,17,32,0.9);padding:8px 12px;border-radius:8px;font-size:12px;color:#F1F5F9;line-height:1.8';d.innerHTML='<div style="display:flex;align-items:center;gap:6px"><div style="width:10px;height:10px;background:#0EA5E9;border-radius:50%;border:2px solid white"></div> Fishing spot</div><div style="display:flex;align-items:center;gap:6px"><div style="width:10px;height:10px;background:#F59E0B;border-radius:50%;border:2px solid white"></div> Current gauge</div><div style="display:flex;align-items:center;gap:6px"><div style="width:10px;height:10px;background:#EF4444;border-radius:50%;border:1px solid white"></div> Other gauges</div>';return d;};legend.addTo(map);
  </script></body></html>`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <View><Text style={pickerStyles.title}>Select Gauge</Text><Text style={pickerStyles.subtitle}>Tap a marker to select</Text></View>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
        </View>
        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> :
        gauges.length === 0 ? <View style={pickerStyles.emptyContainer}><Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} /><Text style={pickerStyles.empty}>No gauges found nearby</Text></View> :
        Platform.OS === 'web' ? (
          <><View style={pickerStyles.mapContainer}><iframe srcDoc={addSatelliteToggle(mapHtml)} style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any} /></View>
          <View style={pickerStyles.listContainer}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pickerStyles.chipList}>
            {gauges.slice(0, 8).map((g) => (<Pressable key={g.siteId} style={({ pressed }) => [pickerStyles.chip, pressed && pickerStyles.chipPressed]} onPress={() => onSelect(g)}><Text style={pickerStyles.chipCfs}>{Math.round(g.currentCfs)} CFS</Text><Text style={pickerStyles.chipName} numberOfLines={1}>{g.siteName}</Text></Pressable>))}
          </ScrollView></View></>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={pickerStyles.nativeList}>
            {gauges.map((g) => (<Pressable key={g.siteId} style={({ pressed }) => [pickerStyles.gaugeRow, pressed && pickerStyles.gaugeRowPressed]} onPress={() => onSelect(g)}>
              <View style={pickerStyles.gaugeInfo}><Text style={pickerStyles.gaugeName}>{g.siteName}</Text><Text style={pickerStyles.gaugeDetail}>{Math.round(g.currentCfs)} CFS · ~{g.distance} mi · {g.source === 'dwr' ? 'CO DWR' : 'USGS'}</Text></View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  mapContainer: { flex: 1 },
  listContainer: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  chipList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 120 },
  chipPressed: { backgroundColor: colors.surfaceLight },
  chipCfs: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.accent },
  chipName: { fontSize: fontSize.xs - 1, color: colors.textTertiary, marginTop: 1, maxWidth: 150 },
  nativeList: { paddingBottom: 40 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  gaugeRowPressed: { backgroundColor: colors.surfaceLight },
  gaugeInfo: { flex: 1 },
  gaugeName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  gaugeDetail: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  empty: { fontSize: fontSize.md, color: colors.textTertiary, marginTop: spacing.md },
});

// ── Single River Detail Report (loaded on demand) ──

function RiverReportDetail({ river, onBack }: { river: any; onBack: () => void }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [flowHistory, setFlowHistory] = useState<FlowHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [nearbyGauges, setNearbyGauges] = useState<FlowGauge[]>([]);
  const [gaugesLoading, setGaugesLoading] = useState(false);
  const [pickerLat, setPickerLat] = useState<number | null>(null);
  const [pickerLng, setPickerLng] = useState<number | null>(null);

  const lat = parseFloat(river.latitude);
  const lng = parseFloat(river.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  const siteId = river.usgsSiteId || river.usgs_site_id;
  const siteName = river.usgsSiteName || river.usgs_site_name;
  const gaugeSource = (river.gaugeSource || river.gauge_source || 'usgs') as 'usgs' | 'dwr' | 'usbr';
  const location = [river.region, river.state].filter(Boolean).join(', ');

  useEffect(() => {
    (async () => {
      try {
        if (hasCoords) {
          try { setWeather(await getCurrentWeather(lat, lng)); } catch {}
        }
        if (siteId) {
          try {
            const f = await getFlowBySiteId(siteId, gaugeSource);
            setFlow(f);
            if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
          } catch {}
        } else if (hasCoords) {
          try {
            const f = await getCurrentFlow(lat, lng, river.name, river.region);
            setFlow(f);
            if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
          } catch {}
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleChangeGauge = async () => {
    try {
      setPickerVisible(true);
      setGaugesLoading(true);
      setPickerLat(hasCoords ? lat : null);
      setPickerLng(hasCoords ? lng : null);
      if (hasCoords) {
        try { setNearbyGauges(await findNearbyGauges(lat, lng, river.name)); } catch {}
      }
      setGaugesLoading(false);
    } catch { setGaugesLoading(false); }
  };

  const handleSelectGauge = async (gauge: FlowGauge) => {
    try {
      setPickerVisible(false);
      setLoading(true);
      if (SUPABASE_ENABLED && supabase) {
        try { await sb().from('rivers').update({ usgs_site_id: gauge.siteId, usgs_site_name: gauge.siteName, gauge_source: gauge.source }).eq('id', river.id); } catch {}
      }
      const f = await getFlowBySiteId(gauge.siteId, gauge.source);
      setFlow(f);
      if (f?.siteId) { try { setFlowHistory(await getFlowHistory(f.siteId, f.source)); } catch {} }
    } catch {} finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.detailRiver}>{river.name}</Text>
      {location ? <Text style={styles.detailLocation}>{location}</Text> : null}

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
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
          ) : null}

          <View style={styles.flowRow}>
            {flow ? (
              <>
                <View><Text style={styles.flowLabel}>Current Flow</Text><Text style={styles.flowValue}>{Math.round(flow.currentCfs)} CFS</Text></View>
                <Pressable style={styles.changeGauge} onPress={handleChangeGauge}>
                  <Text style={styles.gaugeName} numberOfLines={1}>{siteName || flow.siteName}</Text>
                  <Text style={styles.changeText}>Change gauge</Text>
                </Pressable>
              </>
            ) : (
              <><Text style={styles.noData}>No gauge selected</Text>
              <Pressable style={styles.changeGauge} onPress={handleChangeGauge}><Text style={styles.changeText}>Select gauge</Text></Pressable></>
            )}
          </View>

          {flowHistory ? <FlowChart history={flowHistory} /> : null}
        </>
      )}

      <GaugePicker
        visible={pickerVisible} gauges={nearbyGauges} loading={gaugesLoading}
        centerLat={pickerLat} centerLng={pickerLng}
        currentSiteId={siteId || flow?.siteId || null}
        onSelect={handleSelectGauge} onClose={() => setPickerVisible(false)}
      />
    </ScrollView>
  );
}

// ── Main Screen: State → River → Location → Detail ──

export default function RiverReportScreen() {
  const { rivers, loadRivers } = useRiverStore();
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedRiverName, setSelectedRiverName] = useState<string | null>(null);
  const [selectedRiver, setSelectedRiver] = useState<any | null>(null);

  useEffect(() => { loadRivers(); }, []);

  // If a specific river is selected, show its report
  if (selectedRiver) {
    return <RiverReportDetail river={selectedRiver} onBack={() => setSelectedRiver(null)} />;
  }

  // Group rivers by state
  const stateMap = new Map<string, any[]>();
  for (const r of rivers) {
    const state = (r as any).state || 'Unknown';
    if (!stateMap.has(state)) stateMap.set(state, []);
    stateMap.get(state)!.push(r);
  }
  const states = [...stateMap.keys()].sort();

  // If a state is selected, show rivers in that state
  if (selectedState) {
    const stateRivers = stateMap.get(selectedState) || [];

    // If a river name is selected, show locations
    if (selectedRiverName) {
      const locations = stateRivers.filter(r => r.name.toLowerCase() === selectedRiverName.toLowerCase());

      if (locations.length === 1) {
        // Only one location — go straight to detail
        return <RiverReportDetail river={locations[0]} onBack={() => setSelectedRiverName(null)} />;
      }

      return (
        <View style={styles.container}>
          <Pressable style={styles.backBtn} onPress={() => setSelectedRiverName(null)}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>{selectedRiverName}</Text>
          </Pressable>
          <Text style={styles.listTitle}>Select Location</Text>
          <FlatList
            data={locations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]} onPress={() => setSelectedRiver(item)}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{(item as any).region || 'No city'}</Text>
                  <Text style={styles.listItemSub}>{item.name}, {(item as any).state}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
            contentContainerStyle={styles.list}
          />
        </View>
      );
    }

    // Group by river name within state
    const riverNames = new Map<string, any[]>();
    for (const r of stateRivers) {
      const name = r.name;
      if (!riverNames.has(name)) riverNames.set(name, []);
      riverNames.get(name)!.push(r);
    }
    const sortedNames = [...riverNames.keys()].sort();

    return (
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => setSelectedState(null)}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>{selectedState}</Text>
        </Pressable>
        <Text style={styles.listTitle}>Select River</Text>
        <FlatList
          data={sortedNames}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const count = riverNames.get(item)!.length;
            return (
              <Pressable style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                onPress={() => {
                  if (count === 1) setSelectedRiver(riverNames.get(item)![0]);
                  else setSelectedRiverName(item);
                }}
              >
                <Ionicons name="water" size={18} color={colors.primary} />
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{item}</Text>
                  {count > 1 ? <Text style={styles.listItemSub}>{count} locations</Text> : (
                    <Text style={styles.listItemSub}>{[(riverNames.get(item)![0] as any).region, (riverNames.get(item)![0] as any).state].filter(Boolean).join(', ')}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            );
          }}
          contentContainerStyle={styles.list}
        />
      </View>
    );
  }

  // Top level: show states
  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>River Report</Text>
      <Text style={styles.pageSubtitle}>Live weather and flow conditions</Text>
      <FlatList
        data={states}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const count = stateMap.get(item)!.length;
          return (
            <Pressable style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]} onPress={() => setSelectedState(item)}>
              <Ionicons name="flag" size={18} color={colors.accent} />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{item}</Text>
                <Text style={styles.listItemSub}>{count} {count === 1 ? 'river' : 'rivers'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}><Ionicons name="water-outline" size={40} color={colors.textTertiary} /><Text style={styles.emptyTitle}>No rivers yet</Text></View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  pageSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.md },
  listTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  list: { paddingBottom: 40 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  listItemPressed: { backgroundColor: colors.surfaceLight },
  listItemContent: { flex: 1 },
  listItemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  listItemSub: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  backText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.md },
  // Detail
  detailContent: { paddingBottom: 40 },
  detailRiver: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, paddingHorizontal: spacing.lg },
  detailLocation: { fontSize: fontSize.md, color: colors.textSecondary, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, marginHorizontal: spacing.md, backgroundColor: colors.surfaceLight, borderRadius: radius.md, padding: spacing.sm + 2 },
  weatherMain: { flex: 1 },
  tempText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  conditionText: { fontSize: fontSize.xs, color: colors.textSecondary },
  weatherDetails: { gap: spacing.xs },
  weatherDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherDetailText: { fontSize: fontSize.xs, color: colors.textTertiary },
  flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginHorizontal: spacing.md, backgroundColor: colors.surfaceLight, borderRadius: radius.md, padding: spacing.sm + 2 },
  flowLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  flowValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.accent },
  changeGauge: { alignItems: 'flex-end', flex: 1 },
  gaugeName: { fontSize: fontSize.xs - 1, color: colors.textTertiary, maxWidth: 180, textAlign: 'right' },
  changeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.medium, marginTop: 2 },
  noData: { fontSize: fontSize.xs, color: colors.textTertiary },
});
