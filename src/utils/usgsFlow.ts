// USGS Water Services API — real-time river flow data (free, no API key)

export interface FlowData {
  currentCfs: number;
  siteName: string;
  siteId: string;
  dateTime: string;
}

export interface FlowHistory {
  values: { date: string; cfs: number }[];
  min: number;
  max: number;
  avg: number;
}

export interface USGSGauge {
  siteId: string;
  siteName: string;
  lat: number;
  lng: number;
  currentCfs: number;
  distance: number; // miles approx
}

// Get flow from a specific known USGS site
export async function getFlowBySiteId(siteId: string): Promise<FlowData | null> {
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

    return {
      currentCfs: cfs,
      siteName: ts.sourceInfo?.siteName || 'Unknown',
      siteId,
      dateTime: latest.dateTime,
    };
  } catch {
    return null;
  }
}

// Find nearby USGS gauges — returns list for user to pick from
export async function findNearbyGauges(lat: number, lng: number, riverName?: string): Promise<USGSGauge[]> {
  try {
    const bbox = `${(lng - 0.5).toFixed(2)},${(lat - 0.5).toFixed(2)},${(lng + 0.5).toFixed(2)},${(lat + 0.5).toFixed(2)}`;
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00060&siteStatus=active`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    const timeSeries = data?.value?.timeSeries;
    if (!timeSeries) return [];

    const gauges: USGSGauge[] = [];
    for (const site of timeSeries) {
      const siteLat = parseFloat(site.sourceInfo?.geoLocation?.geogLocation?.latitude);
      const siteLng = parseFloat(site.sourceInfo?.geoLocation?.geogLocation?.longitude);
      if (isNaN(siteLat) || isNaN(siteLng)) continue;

      const values = site.values?.[0]?.value;
      if (!values || values.length === 0) continue;
      const cfs = parseFloat(values[values.length - 1].value);
      if (isNaN(cfs) || cfs < 0) continue;

      const distDeg = Math.sqrt(Math.pow(siteLat - lat, 2) + Math.pow(siteLng - lng, 2));
      const distMiles = Math.round(distDeg * 69); // rough conversion

      gauges.push({
        siteId: site.sourceInfo?.siteCode?.[0]?.value || '',
        siteName: site.sourceInfo?.siteName || 'Unknown',
        lat: siteLat,
        lng: siteLng,
        currentCfs: cfs,
        distance: distMiles,
      });
    }

    // Sort: river name matches first, then by distance
    const riverLower = (riverName || '').toLowerCase();
    gauges.sort((a, b) => {
      const aMatch = riverLower && a.siteName.toLowerCase().includes(riverLower) ? -1000 : 0;
      const bMatch = riverLower && b.siteName.toLowerCase().includes(riverLower) ? -1000 : 0;
      return (aMatch + a.distance) - (bMatch + b.distance);
    });

    return gauges.slice(0, 15); // Return top 15
  } catch {
    return [];
  }
}

// Auto-find best gauge (used when no manual selection exists)
export async function getCurrentFlow(lat: number, lng: number, riverName?: string, city?: string): Promise<FlowData | null> {
  const gauges = await findNearbyGauges(lat, lng, riverName || '');
  if (gauges.length === 0) return null;

  // Pick first (best scored)
  const best = gauges[0];
  return {
    currentCfs: best.currentCfs,
    siteName: best.siteName,
    siteId: best.siteId,
    dateTime: new Date().toISOString(),
  };
}

// Get 7-day flow history
export async function getFlowHistory(siteId: string): Promise<FlowHistory | null> {
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
      if (hour !== lastHour) {
        hourly.push({ date: v.dateTime, cfs });
        lastHour = hour;
      }
    }

    const cfsValues = hourly.map((v) => v.cfs);
    if (cfsValues.length === 0) return null;

    return {
      values: hourly,
      min: Math.round(Math.min(...cfsValues)),
      max: Math.round(Math.max(...cfsValues)),
      avg: Math.round(cfsValues.reduce((s, v) => s + v, 0) / cfsValues.length),
    };
  } catch {
    return null;
  }
}
