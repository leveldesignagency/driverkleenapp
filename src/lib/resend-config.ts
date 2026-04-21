/**
 * Resend "from" address.
 *
 * - If the domain is on Wix and you cannot add Resend’s DNS records yet, set
 *   RESEND_FORCE_ONBOARDING=true (and do NOT set RESEND_FROM_VERIFIED=true with
 *   an unverified kleenapp.co.uk address — Resend will reject the send).
 * - When kleenapp.co.uk is verified in Resend, set RESEND_FROM_VERIFIED=true
 *   and RESEND_FROM_EMAIL=Kleen <info@kleenapp.co.uk>.
 */
export function resolveResendFrom(): string {
  if (process.env.RESEND_FORCE_ONBOARDING === "true") {
    return "Kleen <onboarding@resend.dev>";
  }
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  // Legacy: avoid unverified kleenapp domain bounces
  if (from && !from.includes("kleenapp.co.uk")) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  return "Kleen <onboarding@resend.dev>";
}

/** Optional Reply-To so replies reach you while "from" is onboarding@resend.dev */
export function resolveResendReplyTo(): string | undefined {
  const r = process.env.RESEND_REPLY_TO?.trim();
  return r || undefined;
}
