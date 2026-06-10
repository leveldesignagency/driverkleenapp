/** UK postcode outward code (e.g. SW1A from SW1A 1AA). */
export function normalizePostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export type LatLng = { lat: number; lng: number };

export async function geocodeUkPostcode(postcode: string): Promise<LatLng | null> {
  const pc = normalizePostcode(postcode);
  if (!pc) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { latitude?: number; longitude?: number } };
    const lat = json.result?.latitude;
    const lng = json.result?.longitude;
    if (lat == null || lng == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Haversine distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Loose match: job postcode outward code vs contractor service area labels. */
export function postcodeMatchesServiceAreas(postcode: string, areas: string[]): boolean {
  if (!areas.length) return true;
  const pc = normalizePostcode(postcode);
  const outward = pc.split(" ")[0] || pc.slice(0, 4);
  return areas.some((a) => {
    const area = a.trim().toUpperCase();
    return pc.startsWith(area) || outward.startsWith(area) || area.startsWith(outward);
  });
}
