/** Browser-only persistence so the out-of-area modal stays on "already joined". */

const STORAGE_KEY = "kleen_area_waitlist_v1";

function readMap(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, true> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function key(audience: string, email: string) {
  return `${audience}:${email.trim().toLowerCase()}`;
}

export function isLocalWaitlistJoined(audience: string, email: string): boolean {
  if (!email.trim()) return false;
  return Boolean(readMap()[key(audience, email)]);
}

export function markLocalWaitlistJoined(audience: string, email: string) {
  if (typeof window === "undefined" || !email.trim()) return;
  const map = readMap();
  map[key(audience, email)] = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}
