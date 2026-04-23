"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { getContractorGoogleRedirectTo } from "@/lib/contractor-oauth";
import { customerAppHref } from "@/lib/customer-app-url";

function SignInContent() {
  const search = useSearchParams();
  const errQ = search.get("error");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  const preMessage =
    errQ === "not_contractor"
      ? "This account is not a contractor. Use the links below to book as a customer, or contact Kleen to add driver access."
      : errQ === "auth"
        ? "Sign-in could not be completed. Try again."
        : null;

  const handleGoogle = async () => {
    setError("");
    setOauthLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin || origin.includes("localhost")) {
      setError("Google sign-in needs a public URL. Deploy this app or use a tunnel with that URL in Supabase redirect allow-list.");
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/contractor" className="mb-8 flex justify-center">
          <Image src="/images/kleen-logo.svg" alt="KLEEN" width={160} height={66} className="h-12 w-auto" />
        </Link>
        <h1 className="text-center text-2xl font-bold text-slate-900">Contractor sign in</h1>
        <p className="mt-2 text-center text-sm text-slate-600">For Kleen cleaning contractors only.</p>

        {preMessage && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-950">
            {preMessage}
          </p>
        )}

        <div className="mt-8 space-y-4">
          <GoogleOAuthButton onClick={handleGoogle} loading={oauthLoading}>
            Continue with Google
          </GoogleOAuthButton>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Sign in with the Google account you used to register. Customer accounts use the customer sign-in link below.
        </p>

        <p className="mt-6 text-center text-sm text-slate-500">
          New contractor?{" "}
          <Link href="/contractor/join" className="font-medium text-brand-600 hover:text-brand-700">
            Create an account
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

export default function ContractorSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
