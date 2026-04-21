"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { FileText, Landmark, Briefcase, UserRound, ShieldAlert, CheckCircle2, Circle } from "lucide-react";

type OnboardingStep = { label: string; done: boolean; href?: string };

function isMissingSubmittedForReviewColumn(message: string) {
  const m = message.toLowerCase();
  return m.includes("submitted_for_review_at") || m.includes("schema cache");
}

export default function ContractorHomePage() {
  const { operativeId, isVerified, rejectionMessage } = useContractorPortal();
  const [stripeId, setStripeId] = useState<string | null>(null);
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[] | null>(null);
  const [submittedForReviewAt, setSubmittedForReviewAt] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase.from("operatives").select("*").eq("id", operativeId).single();
      setStripeId((op as { stripe_account_id?: string } | null)?.stripe_account_id || null);
      setSubmittedForReviewAt((op as { submitted_for_review_at?: string } | null)?.submitted_for_review_at || null);

      const { count } = await supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId);
      const n = count ?? 0;
      setServiceCount(n);

      const o = op as Record<string, unknown> | null;
      const areas = Array.isArray(o?.service_areas) ? (o.service_areas as string[]).length : 0;
      const phoneOk = !!(o?.phone && String(o.phone).trim());
      const ukOk = !!(
        (o?.company_name && String(o.company_name).trim()) ||
        (o?.trading_name && String(o.trading_name).trim()) ||
        (o?.registered_address && String(o.registered_address).trim())
      );
      const sortDigits = String(o?.bank_sort_code ?? "").replace(/\D/g, "");
      const acctDigits = String(o?.bank_account_number ?? "").replace(/\D/g, "");
      const bankDetailsOk =
        !!(o?.bank_account_name && String(o.bank_account_name).trim()) &&
        sortDigits.length >= 6 &&
        acctDigits.length >= 8;
      const bankPaymentsOk = bankDetailsOk || !!o?.stripe_account_id;
      setOnboardingSteps([
        { label: "Add a UK phone number", done: phoneOk, href: "/contractor/profile" },
        {
          label: "Company / trading name and registered address (UK)",
          done: ukOk,
          href: "/contractor/profile",
        },
        { label: "At least one service area", done: areas > 0, href: "/contractor/profile" },
        { label: "At least one service with contract text", done: n >= 1, href: "/contractor/services" },
        {
          label: "Bank details & Stripe (save bank anytime; Stripe after Kleen verifies you)",
          done: bankPaymentsOk,
          href: "/contractor/payouts",
        },
      ]);
    })();
  }, [operativeId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contractor portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your company profile, service contracts, Stripe payouts, and job invitations from Kleen.
        </p>
      </div>

      {rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">We need more from you before we can approve your application</p>
            <p className="mt-2 whitespace-pre-wrap text-red-800/95">{rejectionMessage}</p>
            <p className="mt-3 text-xs text-red-800/80">
              Update your company profile and services, then Kleen will review again. This message was also emailed to you.
            </p>
          </div>
        </div>
      )}

      {!isVerified && !rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Verification pending</p>
            <p className="mt-0.5 text-amber-800/90">
              Complete the onboarding checklist below: UK company details, service areas, and at least one service
              contract. Bank details can wait until after approval (Payouts). Kleen reviews applications in the admin
              app — jobs and Stripe payouts unlock once you are verified.
            </p>
          </div>
        </div>
      )}

      {!isVerified && onboardingSteps && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Onboarding checklist</p>
          <p className="mt-1 text-xs text-slate-500">
            Complete these so Kleen can verify you. Bank details are optional until you are approved.
          </p>
          <ul className="mt-4 space-y-2.5">
            {onboardingSteps.map((step) => (
              <li key={step.label} className="flex items-start gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                )}
                <span className={step.done ? "text-slate-500 line-through" : "text-slate-800"}>
                  {step.href ? (
                    <Link href={step.href} className="font-medium text-brand-600 hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    step.label
                  )}
                </span>
              </li>
            ))}
          </ul>
          {onboardingSteps.every((s) => s.done) && (
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
                    const supabase = createClient();
                    const now = new Date().toISOString();
                    const { error: fullErr } = await supabase
                      .from("operatives")
                      .update({
                        submitted_for_review_at: now,
                        rejected_at: null,
                        rejection_message: null,
                      })
                      .eq("id", operativeId);

                    let error = fullErr;
                    if (error && isMissingSubmittedForReviewColumn(error.message)) {
                      const { error: retryErr } = await supabase
                        .from("operatives")
                        .update({
                          rejected_at: null,
                          rejection_message: null,
                        })
                        .eq("id", operativeId);
                      error = retryErr;
                      if (!error) {
                        alert(
                          "Your rejection notice was cleared, but the database is missing column operatives.submitted_for_review_at. " +
                            "Run migration 036 (or kleen-app/supabase/manual/add_submitted_for_review_at_column.sql) in Supabase so admins can see you in the review queue."
                        );
                        setSubmittingReview(false);
                        return;
                      }
                    }

                    setSubmittingReview(false);
                    if (error) {
                      alert(error.message);
                      return;
                    }
                    setSubmittedForReviewAt(now);
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
            <p className="font-semibold text-slate-900">Bank &amp; payments</p>
            <p className="mt-1 text-sm text-slate-600">
              {isVerified
                ? stripeId
                  ? "Stripe linked — open Stripe to update bank details."
                  : "Save UK bank details; connect Stripe for payouts."
                : "Save UK bank details here. Stripe Connect after Kleen verifies you."}
            </p>
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
              <p className="mt-1 text-sm text-slate-600">Invitations to quote and your submitted quotes.</p>
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
