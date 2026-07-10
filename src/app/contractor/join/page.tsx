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

async function tryEnsureOperativeRole(): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/contractor/ensure-operative-role", {
    method: "POST",
    credentials: "include",
  });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: body.error || "Could not activate contractor access." };
}

function JoinContent() {
  const router = useRouter();
  const search = useSearchParams();
  const needOperative = search.get("need_operative") === "1";
  const errorQ = search.get("error");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
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
          setError(upgraded.error);
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
  }, [errorQ, needOperative, router]);

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
