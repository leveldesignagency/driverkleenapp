/** UK postcode validation and normalisation. */

export const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normalizeUkPostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}
