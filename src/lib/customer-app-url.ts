/**
 * Vercel env values are sometimes stored without a scheme (e.g. `www.example.com`).
 * Browsers treat those as paths, not hosts — normalize to https://...
 */
export function normalizeSiteOrigin(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Customer booking + dashboard host (e.g. https://dashboard.kleenapp.co.uk).
 * On this contractor-only app, set NEXT_PUBLIC_CUSTOMER_APP_URL (not NEXT_PUBLIC_SITE_URL).
 */
export function getCustomerAppOrigin(): string {
  return normalizeSiteOrigin(process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || "");
}

/** Path must start with /. Returns absolute URL when origin is configured, else same-host path. */
export function customerAppHref(path: string): string {
  const o = getCustomerAppOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return o ? `${o}${p}` : p;
}
