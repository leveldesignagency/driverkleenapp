"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import ContractorPortalBrand from "@/components/contractor/ContractorPortalBrand";
import { CONTRACTOR_GOOGLE_OAUTH_PATH } from "@/lib/contractor-oauth";
import { customerAppHref } from "@/lib/customer-app-url";
import { isStaleRefreshTokenError } from "@/lib/auth-errors";
import {
  clearContractorAuthCookies,
  fetchContractorSessionDiag,
} from "@/lib/contractor-session-bootstrap";

async function tryEnsureOperativeRole(): Promise<
  { ok: true } | { ok: false; error: string; code?: string }
> {
  const res = await fetch("/api/contractor/ensure-operative-role", {
    method: "POST",
    credentials: "include",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (res.ok) return { ok: true };
  return { ok: false, error: body.error || "Could not activate contractor access.", code: body.code };
}

function JoinContent() {
  const router = useRouter();
  const search = useSearchParams();
  const needOperative = search.get("need_operative") === "1";
  const errorQ = search.get("error");
  const errorCode = search.get("code");
  const authMsg = search.get("msg");
  const returningFromAuth = Boolean(errorQ || needOperative);

  const [oauthLoading, setOauthLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(returningFromAuth);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finishSignedIn(userId: string, profileRole: string | null) {
      if (profileRole === "operative") {
        router.replace("/contractor");
        return;
      }

      const upgraded = await tryEnsureOperativeRole();
      if (upgraded.ok) {
        router.replace("/contractor");
        return;
      }

      if (!cancelled) {
        setError(upgraded.error);
        setBootstrapping(false);
      }
    }

    async function bootstrap() {
      // Failed OAuth return — drop corrupt cookies before any client auth calls.
      if (returningFromAuth && errorQ) {
        await clearContractorAuthCookies();
      }

      const diag = await fetchContractorSessionDiag();
      const userId = diag.session?.signedIn ? diag.session.userId : null;

      if (diag.session?.authError && isStaleRefreshTokenError(diag.session.authError)) {
        await clearContractorAuthCookies();
      }

      if (userId) {
        await finishSignedIn(userId, diag.profile?.role ?? null);
        return;
      }

      if (returningFromAuth) {
        if (!cancelled) {
          if (errorQ === "auth" && authMsg) {
            setError(
              authMsg.toLowerCase().includes("redirect")
                ? `OAuth redirect blocked: add https://contractor.kleenapp.co.uk/** in Supabase → Authentication → URL configuration. (${authMsg})`
                : `Google sign-in failed: ${authMsg}`,
            );
          } else if (errorQ === "role_upgrade") {
            setError(
              errorCode === "admin_account"
                ? "This Google account is an admin account. Use a different Google account to apply as a contractor."
                : "Google signed you in but the session did not stick. Clear cookies for kleenapp.co.uk, try Incognito, and confirm Vercel env keys match Supabase.",
            );
          } else {
            setError(
              "Google sign-in did not complete. Clear site cookies for kleenapp.co.uk and try again in an Incognito window.",
            );
          }
          setBootstrapping(false);
        }
        return;
      }

      // Fresh visitor — no session is normal; show the Google button.
      if (!cancelled) setBootstrapping(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authMsg, errorCode, errorQ, needOperative, returningFromAuth, router]);

  const handleGoogle = () => {
    setError("");
    setOauthLoading(true);
    window.location.href = CONTRACTOR_GOOGLE_OAUTH_PATH;
  };

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <ContractorPortalBrand />
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Become a Kleen contractor</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in with Google to start your <strong>contractor application</strong>. You will complete company details,
          services, and bank details in the portal, then submit for Kleen to review.
        </p>
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
          Your account stays <strong>pending</strong> until Kleen approves you in the admin dashboard. Complete every
          step in the onboarding checklist, tap <strong>Send for review</strong>, then wait for verification before
          jobs unlock.
        </p>

        <div className="mt-8 space-y-4">
          <GoogleOAuthButton onClick={handleGoogle} loading={oauthLoading}>
            Continue with Google
          </GoogleOAuthButton>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/contractor/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Contractor sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Customer?{" "}
          <a href={customerAppHref("/sign-in")} className="font-medium text-brand-600 hover:text-brand-700">
            Customer sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ContractorJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
