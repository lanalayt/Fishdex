// Geocode locations using multiple free services with fallback
const CACHE: Record<string, { lat: number; lng: number } | null> = {};

export async function geocodeRiver(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null;

  const key = query.toLowerCase().trim();
  if (key in CACHE) return CACHE[key];

  // Try multiple search strategies in order of specificity
  const strategies = buildSearchStrategies(query);

  for (const searchQuery of strategies) {
    const result = await tryPhoton(searchQuery);
    if (result) {
      CACHE[key] = result;
      return result;
    }
  }

  // Last resort: Nominatim
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'FishDex/1.0 (fishing app)' } }
    );
    if (response.ok) {
      const results = await response.json();
      if (results?.length > 0) {
        const result = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        CACHE[key] = result;
        return result;
      }
    }
  } catch {}

  CACHE[key] = null;
  return null;
}

// Specific geocode for river + city + state — used by MapPicker
export async function geocodeRiverLocation(
  riverName?: string,
  city?: string,
  state?: string,
): Promise<{ lat: number; lng: number } | null> {
  const parts = [riverName, city, state].filter(Boolean);
  if (parts.length === 0) return null;

  const key = parts.join('_').toLowerCase();
  if (key in CACHE) return CACHE[key];

  // Strategy 1: "city, state" — most accurate for getting to the right area
  if (city && state) {
    const result = await tryPhoton(`${city}, ${state}`);
    if (result) { CACHE[key] = result; return result; }
  }

  // Strategy 2: "river near city, state"
  if (riverName && city && state) {
    const result = await tryPhoton(`${riverName} near ${city}, ${state}`);
    if (result) { CACHE[key] = result; return result; }
  }

  // Strategy 3: "river, state"
  if (riverName && state) {
    const result = await tryPhoton(`${riverName}, ${state}`);
    if (result) { CACHE[key] = result; return result; }
  }

  // Strategy 4: full query
  const result = await tryPhoton(parts.join(' '));
  if (result) { CACHE[key] = result; return result; }

  return null;
}

function buildSearchStrategies(query: string): string[] {
  const strategies: string[] = [];

  // The raw query might be "Clear Creek Golden Colorado"
  // Try to identify parts
  const parts = query.trim().split(/\s+/);

  // Try the full query
  strategies.push(query);

  // If it has 3+ words, try last 2 words as "city, state"
  if (parts.length >= 3) {
    const possibleState = parts[parts.length - 1];
    const possibleCity = parts[parts.length - 2];
    strategies.push(`${possibleCity}, ${possibleState}`);
    strategies.push(`${parts.slice(0, -2).join(' ')} near ${possibleCity}, ${possibleState}`);
  }

  return strategies;
}

async function tryPhoton(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(`https://photon.komoot.io/api/?q=${encoded}&limit=1`);
    if (response.ok) {
      const data = await response.json();
      if (data?.features?.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        return { lat: coords[1], lng: coords[0] };
      }
    }
  } catch {}
  return null;
}
