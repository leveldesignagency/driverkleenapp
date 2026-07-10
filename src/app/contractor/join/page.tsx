"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import ContractorPortalBrand from "@/components/contractor/ContractorPortalBrand";
import { getContractorGoogleRedirectTo } from "@/lib/contractor-oauth";
import { customerAppHref } from "@/lib/customer-app-url";

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

async function fetchAuthDiagnostics(): Promise<string | null> {
  const res = await fetch("/api/contractor/ensure-operative-role", { credentials: "include" });
  const body = (await res.json().catch(() => null)) as {
    env?: { hasAnonKey?: boolean; hasServiceRoleKey?: boolean };
    session?: { authError?: string | null; signedIn?: boolean };
    profile?: { error?: string | null; role?: string | null };
  } | null;
  if (!body) return null;
  const parts: string[] = [];
  if (body.session?.authError) parts.push(`Auth: ${body.session.authError}`);
  if (body.profile?.error) parts.push(`Profile: ${body.profile.error}`);
  if (body.env && !body.env.hasAnonKey) parts.push("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.");
  if (body.env && !body.env.hasServiceRoleKey) parts.push("Missing SUPABASE_SERVICE_ROLE_KEY on Vercel.");
  if (parts.length) return parts.join(" ");
  return null;
}

function JoinContent() {
  const router = useRouter();
  const search = useSearchParams();
  const needOperative = search.get("need_operative") === "1";
  const errorQ = search.get("error");
  const errorCode = search.get("code");
  const authMsg = search.get("msg");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        const diag = await fetchAuthDiagnostics();
        if (!cancelled) {
          setError(
            authError.message.includes("403") || authError.message.toLowerCase().includes("jwt")
              ? `Session rejected by Supabase (403). Re-copy NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Vercel (contractor project) and redeploy.${diag ? ` ${diag}` : ""}`
              : `Sign-in error: ${authError.message}${diag ? ` ${diag}` : ""}`,
          );
          setBootstrapping(false);
        }
        return;
      }

      if (!user) {
        if (errorQ === "auth" && authMsg) {
          if (!cancelled) {
            setError(
              authMsg.toLowerCase().includes("redirect")
                ? `OAuth redirect blocked: add https://contractor.kleenapp.co.uk/** in Supabase → Authentication → URL configuration. (${authMsg})`
                : `Google sign-in failed: ${authMsg}`,
            );
            setBootstrapping(false);
          }
          return;
        }
        if (errorQ === "role_upgrade") {
          if (!cancelled) {
            setError(
              errorCode === "admin_account"
                ? "This Google account is an admin account. Use a different Google account to apply as a contractor."
                : "Google signed you in but contractor access could not be activated. Check Vercel env keys match Supabase and redeploy.",
            );
            setBootstrapping(false);
          }
          return;
        }
        if (!cancelled) setBootstrapping(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "operative") {
        router.replace("/contractor");
        return;
      }

      if (profile?.role === "customer" || needOperative || errorQ === "role_upgrade") {
        const upgraded = await tryEnsureOperativeRole();
        if (upgraded.ok) {
          router.replace("/contractor");
          return;
        }
        if (!cancelled) {
          const diag = await fetchAuthDiagnostics();
          setError([upgraded.error, diag].filter(Boolean).join(" "));
          setBootstrapping(false);
        }
        return;
      }

      if (!cancelled) setBootstrapping(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authMsg, errorCode, errorQ, needOperative, router]);

  const handleGoogle = async () => {
    setError("");
    setOauthLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin || origin.includes("localhost")) {
      setError(
        "Google sign-in needs a public URL. Deploy this app or use a tunnel with that URL in Supabase redirect allow-list.",
      );
      setOauthLoading(false);
      return;
    }
    const redirectTo = getContractorGoogleRedirectTo();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (err) {
      setError(err.message);
      setOauthLoading(false);
    }
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
        {needOperative && !error && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            Your Google account signed in successfully. We are activating <strong>contractor</strong> access…
          </p>
        )}
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
