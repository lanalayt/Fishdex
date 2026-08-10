// River flow data from USGS + Colorado DWR + USBR (all free, no API key)
import { Platform } from 'react-native';

export type FlowSource = 'usgs' | 'dwr' | 'usbr';

export interface FlowData {
  currentCfs: number;
  siteName: string;
  siteId: string;
  source: FlowSource;
  dateTime: string;
}

export interface FlowHistory {
  values: { date: string; cfs: number }[];
  min: number;
  max: number;
  avg: number;
}

export interface FlowGauge {
  siteId: string;
  siteName: string;
  source: FlowSource;
  lat: number;
  lng: number;
  currentCfs: number;
  distance: number;
}

// ── USBR (Bureau of Reclamation) ──

// Known USBR stations with their coordinates
const USBR_STATIONS: { code: string; name: string; lat: number; lng: number }[] = [
  { code: 'PAWY', name: 'North Platte Fremont Canyon', lat: 42.5138, lng: -106.7751 },
  { code: 'ALWY', name: 'North Platte at Alcova Dam', lat: 42.5333, lng: -106.7333 },
  { code: 'GRWY', name: 'North Platte Grey Reef', lat: 42.6608, lng: -106.6149 },
  { code: 'KOWY', name: 'North Platte Miracle Mile', lat: 42.215, lng: -106.877 },
  { code: 'GLWY', name: 'North Platte Glendo Dam', lat: 42.4972, lng: -104.9556 },
];

function usbrUrl(siteCode: string): string {
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const base = `https://www.usbr.gov/gp-bin/arcread.pl?st=${siteCode}&by=${start.getFullYear()}&bm=${start.getMonth()+1}&bd=${start.getDate()}&ey=${now.getFullYear()}&em=${now.getMonth()+1}&ed=${now.getDate()}&pa=qd&json=1`;
  // Use CORS proxy on web
  if (Platform.OS === 'web') {
    return `https://corsproxy.io/?${encodeURIComponent(base)}`;
  }
  return base;
}

function usbrHistoryUrl(siteCode: string): string {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const base = `https://www.usbr.gov/gp-bin/arcread.pl?st=${siteCode}&by=${start.getFullYear()}&bm=${start.getMonth()+1}&bd=${start.getDate()}&ey=${now.getFullYear()}&em=${now.getMonth()+1}&ed=${now.getDate()}&pa=qd&json=1`;
  if (Platform.OS === 'web') {
    return `https://corsproxy.io/?${encodeURIComponent(base)}`;
  }
  return base;
}

async function getUsbrFlow(siteCode: string): Promise<FlowData | null> {
  try {
    const response = await fetch(usbrUrl(siteCode));
    if (!response.ok) return null;
    const data = await response.json();
    const records = data?.SITE?.DATA;
    if (!records || records.length === 0) return null;

    // Find most recent valid reading
    for (let i = records.length - 1; i >= 0; i--) {
      const cfs = parseFloat(records[i].QD);
      if (!isNaN(cfs) && cfs < 900000 && cfs >= 0) {
        const station = USBR_STATIONS.find(s => s.code === siteCode);
        return {
          currentCfs: Math.round(cfs),
          siteName: station?.name || siteCode,
          siteId: siteCode,
          source: 'usbr',
          dateTime: records[i].DATE || '',
        };
      }
    }
    return null;
  } catch { return null; }
}

async function getUsbrHistory(siteCode: string): Promise<FlowHistory | null> {
  try {
    const response = await fetch(usbrHistoryUrl(siteCode));
    if (!response.ok) return null;
    const data = await response.json();
    const records = data?.SITE?.DATA;
    if (!records) return null;

    const values = records
      .map((r: any) => ({ date: r.DATE, cfs: parseFloat(r.QD) }))
      .filter((v: any) => !isNaN(v.cfs) && v.cfs < 900000 && v.cfs >= 0);

    if (values.length === 0) return null;
    const cfsVals = values.map((v: any) => v.cfs);
    return {
      values,
      min: Math.round(Math.min(...cfsVals)),
      max: Math.round(Math.max(...cfsVals)),
      avg: Math.round(cfsVals.reduce((s: number, v: number) => s + v, 0) / cfsVals.length),
    };
  } catch { return null; }
}

// ── Get flow from a known gauge ──

export async function getFlowBySiteId(siteId: string, source: FlowSource = 'usgs'): Promise<FlowData | null> {
  if (source === 'dwr') return getDwrFlow(siteId);
  if (source === 'usbr') return getUsbrFlow(siteId);
  return getUsgsFlow(siteId);
}

async function getUsgsFlow(siteId: string): Promise<FlowData | null> {
  try {
    const response = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const ts = data?.value?.timeSeries?.[0];
    if (!ts) return null;
    const values = ts.values?.[0]?.value;
    if (!values || values.length === 0) return null;
    const latest = values[values.length - 1];
    const cfs = parseFloat(latest.value);
    if (isNaN(cfs) || cfs < 0) return null;
    return { currentCfs: cfs, siteName: ts.sourceInfo?.siteName || 'Unknown', siteId, source: 'usgs', dateTime: latest.dateTime };
  } catch { return null; }
}

async function getDwrFlow(abbrev: string): Promise<FlowData | null> {
  try {
    const response = await fetch(
      `https://dwr.state.co.us/Rest/GET/api/v2/telemetrystations/telemetrytimeseriesday/?format=json&abbrev=${abbrev}&parameter=DISCHRG`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const results = data?.ResultList;
    if (!results || results.length === 0) return null;
    const latest = results[results.length - 1];
    const cfs = parseFloat(latest.measValue);
    if (isNaN(cfs)) return null;
    return { currentCfs: cfs, siteName: latest.stationName || abbrev, siteId: abbrev, source: 'dwr', dateTime: latest.measDate || '' };
  } catch { return null; }
}

// ── Find nearby gauges (both sources) ──

export async function findNearbyGauges(lat: number, lng: number, riverName?: string): Promise<FlowGauge[]> {
  // Search both sources — catch each independently
  const results = await Promise.allSettled([
    findUsgsGauges(lat, lng, riverName),
    findDwrGauges(lat, lng, riverName),
    findUsbrGauges(lat, lng),
  ]);

  const usgsGauges = results[0].status === 'fulfilled' ? results[0].value : [];
  const dwrGauges = results[1].status === 'fulfilled' ? results[1].value : [];
  const usbrGauges = results[2].status === 'fulfilled' ? results[2].value : [];

  // Merge and sort by: river name match first, then distance
  const all = [...usgsGauges, ...dwrGauges, ...usbrGauges];
  const riverLower = (riverName || '').toLowerCase();
  all.sort((a, b) => {
    const aMatch = riverLower && a.siteName.toLowerCase().includes(riverLower) ? -1000 : 0;
    const bMatch = riverLower && b.siteName.toLowerCase().includes(riverLower) ? -1000 : 0;
    return (aMatch + a.distance) - (bMatch + b.distance);
  });

  return all.slice(0, 20);
}

async function findUsgsGauges(lat: number, lng: number, riverName?: string): Promise<FlowGauge[]> {
  try {
    const bbox = `${(lng - 0.8).toFixed(2)},${(lat - 0.8).toFixed(2)},${(lng + 0.8).toFixed(2)},${(lat + 0.8).toFixed(2)}`;
    const response = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00060&siteStatus=active`
    );
    if (!response.ok) return [];
    const data = await response.json();
    const timeSeries = data?.value?.timeSeries;
    if (!timeSeries) return [];

    const gauges: FlowGauge[] = [];
    for (const site of timeSeries) {
      const siteLat = parseFloat(site.sourceInfo?.geoLocation?.geogLocation?.latitude);
      const siteLng = parseFloat(site.sourceInfo?.geoLocation?.geogLocation?.longitude);
      if (isNaN(siteLat) || isNaN(siteLng)) continue;
      const values = site.values?.[0]?.value;
      if (!values || values.length === 0) continue;
      const cfs = parseFloat(values[values.length - 1].value);
      if (isNaN(cfs) || cfs < 0) continue;
      const distDeg = Math.sqrt(Math.pow(siteLat - lat, 2) + Math.pow(siteLng - lng, 2));

      gauges.push({
        siteId: site.sourceInfo?.siteCode?.[0]?.value || '',
        siteName: site.sourceInfo?.siteName || 'Unknown',
        source: 'usgs',
        lat: siteLat,
        lng: siteLng,
        currentCfs: cfs,
        distance: Math.round(distDeg * 69),
      });
    }
    return gauges;
  } catch { return []; }
}

async function findDwrGauges(lat: number, lng: number, riverName?: string): Promise<FlowGauge[]> {
  try {
    // DWR API: search for discharge stations with current data
    // Use latitude/longitude filter to narrow results
    const latMin = (lat - 0.4).toFixed(2);
    const latMax = (lat + 0.4).toFixed(2);
    const lngMin = (lng - 0.4).toFixed(2);
    const lngMax = (lng + 0.4).toFixed(2);

    const url = `https://dwr.state.co.us/Rest/GET/api/v2/telemetrystations/telemetrystation/?format=json&parameter=DISCHRG&min-latitude=${latMin}&max-latitude=${latMax}&min-longitude=${lngMin}&max-longitude=${lngMax}`;

    const response = await fetch(url);
    if (!response.ok) {
      // Fallback: try without coordinate filter but with name
      if (!riverName) return [];
      const nameUrl = `https://dwr.state.co.us/Rest/GET/api/v2/telemetrystations/telemetrystation/?format=json&parameter=DISCHRG&stationName=*${encodeURIComponent(riverName.split(/\s+/)[0])}*`;
      const nameResponse = await fetch(nameUrl);
      if (!nameResponse.ok) return [];
      const nameData = await nameResponse.json();
      return processDwrStations(nameData?.ResultList || [], lat, lng);
    }

    const data = await response.json();
    return processDwrStations(data?.ResultList || [], lat, lng);
  } catch { return []; }
}

function processDwrStations(stations: any[], lat: number, lng: number): FlowGauge[] {
  const gauges: FlowGauge[] = [];
  for (const s of stations) {
    const sLat = parseFloat(s.latitude);
    const sLng = parseFloat(s.longitude);
    if (isNaN(sLat) || isNaN(sLng)) continue;

    const cfs = parseFloat(s.measValue);
    // Skip stations with no data or negative values (error codes)
    if (isNaN(cfs) || cfs < 0) continue;
    // Skip reservoirs and storage structures (they report volume, not flow)
    const stype = (s.stationType || '').toLowerCase();
    const sname = (s.stationName || '').toLowerCase();
    if (stype.includes('reservoir') || stype.includes('storage') || sname.includes('reservoir')) continue;

    const distDeg = Math.sqrt(Math.pow(sLat - lat, 2) + Math.pow(sLng - lng, 2));
    const distMiles = Math.round(distDeg * 69);

    if (distMiles > 50) continue;

    gauges.push({
      siteId: s.abbrev || '',
      siteName: s.stationName || 'Unknown',
      source: 'dwr',
      lat: sLat,
      lng: sLng,
      currentCfs: cfs,
      distance: distMiles,
    });
  }
  return gauges;
}

async function findUsbrGauges(lat: number, lng: number): Promise<FlowGauge[]> {
  const gauges: FlowGauge[] = [];
  for (const station of USBR_STATIONS) {
    const distDeg = Math.sqrt(Math.pow(station.lat - lat, 2) + Math.pow(station.lng - lng, 2));
    const distMiles = Math.round(distDeg * 69);
    if (distMiles > 100) continue;

    // Get current flow
    try {
      const flow = await getUsbrFlow(station.code);
      if (flow && flow.currentCfs > 0) {
        gauges.push({
          siteId: station.code,
          siteName: station.name,
          source: 'usbr',
          lat: station.lat,
          lng: station.lng,
          currentCfs: flow.currentCfs,
          distance: distMiles,
        });
      }
    } catch {}
  }
  return gauges;
}

// ── Auto-find best gauge ──

export async function getCurrentFlow(lat: number, lng: number, riverName?: string, city?: string): Promise<FlowData | null> {
  const gauges = await findNearbyGauges(lat, lng, riverName || '');
  if (gauges.length === 0) return null;
  const best = gauges[0];
  return {
    currentCfs: best.currentCfs,
    siteName: best.siteName,
    siteId: best.siteId,
    source: best.source,
    dateTime: new Date().toISOString(),
  };
}

// ── Flow history ──

export async function getFlowHistory(siteId: string, source: FlowSource = 'usgs'): Promise<FlowHistory | null> {
  if (source === 'dwr') return getDwrHistory(siteId);
  if (source === 'usbr') return getUsbrHistory(siteId);
  // Try instantaneous values first, then daily values as fallback
  const iv = await getUsgsHistory(siteId);
  if (iv) return iv;
  return getUsgsDailyHistory(siteId);
}

async function getUsgsHistory(siteId: string): Promise<FlowHistory | null> {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const response = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&startDT=${startDate}&endDT=${endDate}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const timeSeries = data?.value?.timeSeries?.[0];
    if (!timeSeries) return null;
    const rawValues = timeSeries.values?.[0]?.value || [];
    if (rawValues.length === 0) return null;

    const hourly: { date: string; cfs: number }[] = [];
    let lastHour = '';
    for (const v of rawValues) {
      const cfs = parseFloat(v.value);
      if (isNaN(cfs) || cfs < 0) continue;
      const hour = v.dateTime.substring(0, 13);
      if (hour !== lastHour) { hourly.push({ date: v.dateTime, cfs }); lastHour = hour; }
    }

    const cfsValues = hourly.map((v) => v.cfs);
    if (cfsValues.length === 0) return null;
    return {
      values: hourly,
      min: Math.round(Math.min(...cfsValues)),
      max: Math.round(Math.max(...cfsValues)),
      avg: Math.round(cfsValues.reduce((s, v) => s + v, 0) / cfsValues.length),
    };
  } catch { return null; }
}

async function getUsgsDailyHistory(siteId: string): Promise<FlowHistory | null> {
  try {
    const response = await fetch(
      `https://waterservices.usgs.gov/nwis/stat/?format=json&sites=${siteId}&parameterCd=00060&statReportType=daily&statTypeCd=mean`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const ts = data?.value?.timeSeries?.[0];
    if (!ts) return null;
    const rawValues = ts.values?.[0]?.value || [];

    // Get stats for current month as a rough history
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthValues = rawValues.filter((v: any) => v.dateTime?.includes(`-${currentMonth}-`));

    if (monthValues.length === 0) return null;

    const values = monthValues.slice(-7).map((v: any) => ({
      date: v.dateTime || '',
      cfs: parseFloat(v.value) || 0,
    })).filter((v: any) => v.cfs > 0);

    if (values.length === 0) return null;
    const cfsValues = values.map((v: any) => v.cfs);
    return {
      values,
      min: Math.round(Math.min(...cfsValues)),
      max: Math.round(Math.max(...cfsValues)),
      avg: Math.round(cfsValues.reduce((s: number, v: number) => s + v, 0) / cfsValues.length),
    };
  } catch { return null; }
}

async function getDwrHistory(abbrev: string): Promise<FlowHistory | null> {
  try {
    const response = await fetch(
      `https://dwr.state.co.us/Rest/GET/api/v2/telemetrystations/telemetrytimeseriesday/?format=json&abbrev=${abbrev}&parameter=DISCHRG`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const results = data?.ResultList;
    if (!results || results.length === 0) return null;

    // Get last 7 days
    const values = results.slice(-7).map((r: any) => ({
      date: r.measDate || '',
      cfs: parseFloat(r.measValue) || 0,
    })).filter((v: any) => v.cfs > 0);

    if (values.length === 0) return null;
    const cfsValues = values.map((v: any) => v.cfs);
    return {
      values,
      min: Math.round(Math.min(...cfsValues)),
      max: Math.round(Math.max(...cfsValues)),
      avg: Math.round(cfsValues.reduce((s: number, v: number) => s + v, 0) / cfsValues.length),
    };
  } catch { return null; }
}
