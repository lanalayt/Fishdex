// Fetch river photos from Wikipedia (free, no API key needed)
const CACHE: Record<string, string | null> = {};

export async function getRiverImage(riverName: string, city?: string | null, state?: string | null): Promise<string | null> {
  const key = [riverName, city, state].filter(Boolean).join('_').toLowerCase().trim();
  if (key in CACHE) return CACHE[key];

  // Build search variations
  const variations = [
    `${riverName} River ${state || ''}`,
    `${riverName} ${state || ''}`,
    `${riverName} River`,
    riverName,
    // Handle "Frying Pan" → "Fryingpan" etc
    `${riverName.replace(/\s+/g, '')} River ${state || ''}`,
    // Try with city
    city ? `${riverName} ${city} ${state || ''}` : null,
  ].filter(Boolean) as string[];

  // Search Wikipedia for each variation
  for (const q of variations) {
    try {
      const encoded = encodeURIComponent(q.trim());
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encoded}&gsrlimit=3&prop=pageimages&format=json&pithumbsize=400&origin=*`
      );
      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          // Prefer pages that have "river" or the river name in the title
          const sorted = Object.values(pages) as any[];
          const riverPage = sorted.find((p: any) =>
            p.thumbnail?.source &&
            (p.title?.toLowerCase().includes('river') ||
             p.title?.toLowerCase().includes(riverName.toLowerCase().replace(/\s+/g, '')))
          );
          if (riverPage?.thumbnail?.source) {
            CACHE[key] = riverPage.thumbnail.source;
            return riverPage.thumbnail.source;
          }
          // Otherwise take first page with an image
          for (const page of sorted) {
            if (page?.thumbnail?.source) {
              CACHE[key] = page.thumbnail.source;
              return page.thumbnail.source;
            }
          }
        }
      }
    } catch {}
  }

  CACHE[key] = null;
  return null;
}
