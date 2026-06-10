export function resolveResendFrom(): string {
  if (process.env.RESEND_FORCE_ONBOARDING === "true") {
    return "Kleen <onboarding@resend.dev>";
  }
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  if (from && !from.includes("kleenapp.co.uk")) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  return "Kleen <onboarding@resend.dev>";
}

export function resolveResendReplyTo(): string | undefined {
  const r = process.env.RESEND_REPLY_TO?.trim();
  return r || undefined;
}
