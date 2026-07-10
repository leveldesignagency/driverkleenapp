/** Errors that just mean "not signed in yet" — not a failure. */
export function isBenignAuthError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("auth session missing") ||
    m.includes("session missing") ||
    (m.includes("invalid refresh token") && m.includes("not found")) ||
    m.includes("refresh token not found")
  );
}

/** Stale or revoked refresh token — clear cookies instead of retrying refresh. */
export function isStaleRefreshTokenError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("invalid refresh token") ||
    m.includes("refresh token not found") ||
    m.includes("refresh_token_not_found") ||
    m.includes("token has expired") ||
    m.includes("jwt expired")
  );
}
