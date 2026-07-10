/** Errors that just mean "not signed in yet" — not a failure. */
export function isBenignAuthError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("auth session missing") ||
    m.includes("session missing") ||
    m.includes("invalid refresh token") && m.includes("not found")
  );
}
