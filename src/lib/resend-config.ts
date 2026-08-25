/**
 * Resend "from" address.
 *
 * - If the domain is on Wix and you cannot add Resend's DNS records yet, set
 *   RESEND_FORCE_ONBOARDING=true (and do NOT set RESEND_FROM_VERIFIED=true with
 *   an unverified kleenapp.co.uk address — Resend will reject the send).
 * - When kleenapp.co.uk is verified in Resend, set RESEND_FROM_VERIFIED=true
 *   and RESEND_FROM_EMAIL=Kleen <info@kleenapp.co.uk>  (ASCII only — no • bullets)
 */
export function sanitizeEmailHeader(value: string): string {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[\u2022\u00B7\u2023\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain email for `to` / `replyTo` — strips bullets and smart punctuation from copy-pasted env vars. */
export function sanitizeEmailAddress(value: string): string {
  const s = sanitizeEmailHeader(value);
  const angle = s.match(/<([^>]+)>/);
  if (angle) return sanitizeEmailHeader(angle[1]);
  const bare = s.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return bare ? bare[0] : s;
}

export function resolveResendFrom(): string {
  if (process.env.RESEND_FORCE_ONBOARDING === "true") {
    return "Kleen <onboarding@resend.dev>";
  }
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    const clean = sanitizeEmailHeader(from);
    if (clean.includes("<")) return clean;
    const email = sanitizeEmailAddress(clean);
    return email.includes("@") ? `Kleen <${email}>` : clean;
  }
  if (from && !from.includes("kleenapp.co.uk")) {
    const clean = sanitizeEmailHeader(from);
    if (clean.includes("<")) return clean;
    const email = sanitizeEmailAddress(clean);
    return email.includes("@") ? `Kleen <${email}>` : clean;
  }
  return "Kleen <onboarding@resend.dev>";
}

export function resolveResendReplyTo(): string | undefined {
  const r = process.env.RESEND_REPLY_TO?.trim();
  if (!r) return undefined;
  return sanitizeEmailAddress(r);
}
