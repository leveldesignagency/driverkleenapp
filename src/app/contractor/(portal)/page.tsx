"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import {
  getContractorOnboardingSteps,
  isContractorOnboardingComplete,
  type OperativeOnboardingRow,
} from "@/lib/contractor-onboarding";
import { FileText, Landmark, Briefcase, UserRound, ShieldAlert, CheckCircle2, Circle } from "lucide-react";

export default function ContractorHomePage() {
  const { operativeId, isVerified, rejectionMessage, submittedForReviewAt, reopenOnboarding } =
    useContractorPortal();
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [operative, setOperative] = useState<OperativeOnboardingRow | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase.from("operatives").select("*").eq("id", operativeId).single();
      setOperative((op as OperativeOnboardingRow) || null);

      const { count } = await supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId);
      setServiceCount(count ?? 0);
    })();
  }, [operativeId]);

  const onboardingSteps = operative && serviceCount !== null
    ? getContractorOnboardingSteps(operative, serviceCount).filter((s) => s.id !== "review")
    : null;

  const onboardingComplete =
    operative && serviceCount !== null ? isContractorOnboardingComplete(operative, serviceCount) : false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isVerified ? "Contractor portal" : "Your contractor application"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isVerified
            ? "Manage your company profile, browse local jobs, submit quotes, and track assigned work."
            : "Complete every step below, then send your application to Kleen for review."}
        </p>
      </div>

      {rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">We need more from you before we can approve your application</p>
            <p className="mt-2 whitespace-pre-wrap text-red-800/95">{rejectionMessage}</p>
            <button
              type="button"
              onClick={reopenOnboarding}
              className="mt-3 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Update application
            </button>
          </div>
        </div>
      )}

      {!isVerified && !rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Verification pending</p>
            <p className="mt-0.5 text-amber-800/90">
              Complete your application checklist, then send it for Kleen review. Jobs unlock after you are verified.
            </p>
            <button
              type="button"
              onClick={reopenOnboarding}
              className="mt-3 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              {submittedForReviewAt ? "Review application" : "Continue application"}
            </button>
          </div>
        </div>
      )}

      {!isVerified && onboardingSteps && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Onboarding checklist</p>
          <p className="mt-1 text-xs text-slate-500">
            All items must be complete before you can send your application to Kleen.
          </p>
          <ul className="mt-4 space-y-2.5">
            {onboardingSteps.map((step) => (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                )}
                <span className={step.done ? "text-slate-500 line-through" : "text-slate-800"}>{step.label}</span>
              </li>
            ))}
          </ul>
          {onboardingComplete && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-900">
                Your profile looks complete. Send it to Kleen when you are ready for review.
              </p>
              {submittedForReviewAt ? (
                <p className="mt-2 text-xs text-emerald-800/90">
                  Submitted for review on {new Date(submittedForReviewAt).toLocaleString("en-GB")}. You can keep editing;
                  admin will review your latest details.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={async () => {
                    setSubmittingReview(true);
                    const res = await fetch("/api/contractor/submit-for-review", {
                      method: "POST",
                      credentials: "include",
                    });
                    const json = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    setSubmittingReview(false);
                    if (!res.ok) {
                      alert(json.error || "Could not submit for review");
                      return;
                    }
                    reopenOnboarding();
                  }}
                  className="mt-3 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {submittingReview ? "Sending…" : "Send for review"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/contractor/profile"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <UserRound className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Company &amp; profile</p>
            <p className="mt-1 text-sm text-slate-600">Business details, areas, rates, tax references.</p>
          </div>
        </Link>
        <Link
          href="/contractor/services"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <FileText className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Services &amp; contracts</p>
            <p className="mt-1 text-sm text-slate-600">
              {serviceCount === null ? "Loading…" : `${serviceCount} service${serviceCount === 1 ? "" : "s"} linked`} —
              add contract text per service.
            </p>
          </div>
        </Link>
        <Link
          href="/contractor/payouts"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Landmark className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Bank details</p>
            <p className="mt-1 text-sm text-slate-600">UK account for Kleen payouts — no Stripe setup needed.</p>
          </div>
        </Link>
        {isVerified ? (
          <Link
            href="/contractor/jobs"
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <Briefcase className="h-8 w-8 text-brand-600" />
            <div>
              <p className="font-semibold text-slate-900">Jobs &amp; quotes</p>
              <p className="mt-1 text-sm text-slate-600">Browse local jobs, submit quotes, and track assigned work.</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 opacity-90">
            <Briefcase className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-600">Jobs &amp; quotes</p>
              <p className="mt-1 text-sm text-slate-500">Unlocked when your account is verified.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
