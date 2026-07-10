type SessionDiag = {
  session: {
    signedIn: boolean;
    userId: string | null;
    email: string | null;
    authError: string | null;
  };
  profile: {
    role: string | null;
    error: string | null;
  };
};

/** Server-side session check — avoids browser getSession() refresh loops on stale cookies. */
export async function fetchContractorSessionDiag(): Promise<SessionDiag> {
  const res = await fetch("/api/contractor/ensure-operative-role", {
    credentials: "include",
    cache: "no-store",
  });
  return (await res.json().catch(() => ({}))) as SessionDiag;
}

export async function clearContractorAuthCookies(): Promise<void> {
  await fetch("/api/contractor/clear-auth", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
}
