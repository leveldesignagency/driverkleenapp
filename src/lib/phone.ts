/** UK-focused phone normalization for SMS OTP (E.164). */

export function normalizeUkPhoneToE164(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("44")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length < 10 || digits.length > 11) return null;
  if (!/^[1-9]/.test(digits)) return null;

  return `+44${digits}`;
}

export function formatUkPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+44")) return e164;
  const national = `0${e164.slice(3)}`;
  if (national.length === 11) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return national;
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "••••";
  return `${e164.slice(0, 4)} ••• ${e164.slice(-3)}`;
}
