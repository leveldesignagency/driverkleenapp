"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import ContractorPortalBrand from "@/components/contractor/ContractorPortalBrand";
import { CONTRACTOR_GOOGLE_OAUTH_PATH } from "@/lib/contractor-oauth";
import { customerAppHref } from "@/lib/customer-app-url";
import { clearContractorAuthCookies } from "@/lib/contractor-session-bootstrap";

function SignInContent() {
  const search = useSearchParams();
  const errQ = search.get("error");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (errQ === "auth" || errQ === "not_contractor") {
      void clearContractorAuthCookies();
    }
  }, [errQ]);

  const preMessage =
    errQ === "not_contractor"
      ? "This account is not a contractor. Use the links below to book as a customer, or contact Kleen to add contractor access."
      : errQ === "auth"
        ? "Sign-in could not be completed. Try again."
        : null;

  const handleGoogle = () => {
    setError("");
    setOauthLoading(true);
    window.location.href = CONTRACTOR_GOOGLE_OAUTH_PATH;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <ContractorPortalBrand />
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Contractor sign in</h1>
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
