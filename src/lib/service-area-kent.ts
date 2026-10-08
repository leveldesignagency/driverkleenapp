import { normalizeUkPostcode, UK_POSTCODE_RE } from "@/lib/format-uk-address";

export type PostcodeAreaMeta = {
  postcode: string;
  areaLabel: string | null;
  adminCounty: string | null;
  adminDistrict: string | null;
  region: string | null;
  postcodeArea: string | null;
};

export type KentCheckResult =
  | ({ ok: true; inKent: boolean } & PostcodeAreaMeta)
  | { ok: false; error: string; postcode?: string };

type PostcodesIoResult = {
  postcode?: string;
  admin_county?: string | null;
  admin_district?: string | null;
  parish?: string | null;
  region?: string | null;
  pfa?: string | null;
};

export function extractUkPostcode(text: string): string | null {
  const match = text.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  if (!match) return null;
  const normalized = normalizeUkPostcode(match[1]);
  return UK_POSTCODE_RE.test(normalized) ? normalized : null;
}

export function postcodeAreaFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const normalized = normalizeUkPostcode(postcode);
  const outward = normalized.split(/\s+/)[0];
  return outward || null;
}

function isKentFromMeta(r: PostcodesIoResult): boolean {
  const county = (r.admin_county || "").trim().toLowerCase();
  const district = (r.admin_district || "").trim().toLowerCase();
  const pfa = (r.pfa || "").trim().toLowerCase();
  if (pfa === "kent") return true;
  if (county === "kent") return true;
  if (district === "medway" || district === "kent") return true;
  return false;
}

function areaLabelFromMeta(r: PostcodesIoResult): string | null {
  const parts = [r.parish, r.admin_district, r.admin_county || r.region].filter(
    (p): p is string => Boolean(p && String(p).trim()),
  );
  return parts.length ? parts.join(", ") : null;
}

function metaFromResult(r: PostcodesIoResult, fallbackPostcode: string): PostcodeAreaMeta {
  const postcode = r.postcode || fallbackPostcode;
  return {
    postcode,
    areaLabel: areaLabelFromMeta(r),
    adminCounty: r.admin_county?.trim() || null,
    adminDistrict: r.admin_district?.trim() || null,
    region: r.region?.trim() || null,
    postcodeArea: postcodeAreaFromPostcode(postcode),
  };
}

export async function checkPostcodeIsKent(rawPostcode: string): Promise<KentCheckResult> {
  const postcode = normalizeUkPostcode(rawPostcode);
  if (!postcode || !UK_POSTCODE_RE.test(postcode)) {
    return { ok: false, error: "Enter a valid UK postcode.", postcode };
  }

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    );
    if (res.status === 404) {
      return { ok: false, error: "We could not find that postcode.", postcode };
    }
    if (!res.ok) {
      return { ok: false, error: "Could not verify your area right now. Please try again.", postcode };
    }
    const json = (await res.json()) as { result?: PostcodesIoResult | null };
    const r = json.result;
    if (!r) {
      return { ok: false, error: "We could not find that postcode.", postcode };
    }
    return {
      ok: true,
      inKent: isKentFromMeta(r),
      ...metaFromResult(r, postcode),
    };
  } catch {
    return { ok: false, error: "Could not verify your area right now. Please try again.", postcode };
  }
}
