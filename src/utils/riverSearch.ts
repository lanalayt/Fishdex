// Search for rivers/waterways using OpenStreetMap Nominatim

export interface RiverResult {
  name: string;
  displayName: string; // e.g. "Clear Creek, Golden, Jefferson County, Colorado"
  lat: number;
  lng: number;
  state?: string;
  region?: string;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export async function searchRivers(query: string): Promise<RiverResult[]> {
  if (!query.trim() || query.length < 2) return [];

  try {
    const q = encodeURIComponent(`${query} river creek`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=8&addressdetails=1&featuretype=river`,
      {
        headers: { 'User-Agent': 'FishDex/1.0' },
      }
    );
    const results = await response.json();

    // Also search without featuretype for broader results
    const response2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1`,
      {
        headers: { 'User-Agent': 'FishDex/1.0' },
      }
    );
    const results2 = await response2.json();

    // Merge and deduplicate
    const allResults = [...results, ...results2];
    const seen = new Set<string>();
    const unique: RiverResult[] = [];

    for (const r of allResults) {
      const key = `${r.lat.substring(0, 6)},${r.lon.substring(0, 6)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const addr = r.address || {};
      const state = addr.state || '';
      const county = addr.county || '';
      const city = addr.city || addr.town || addr.village || '';

      // Build a nice display name
      const parts = [r.name || query];
      if (city) parts.push(city);
      if (county) parts.push(county);
      if (state) parts.push(state);
      const displayName = [...new Set(parts)].join(', ');

      unique.push({
        name: r.name || query,
        displayName,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        state: state || undefined,
        region: county || city || undefined,
      });
    }

    return unique.slice(0, 8);
  } catch {
    return [];
  }
}

// Debounced version for use while typing
export function searchRiversDebounced(
  query: string,
  callback: (results: RiverResult[]) => void,
  delay = 400
) {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const results = await searchRivers(query);
    callback(results);
  }, delay);
}
