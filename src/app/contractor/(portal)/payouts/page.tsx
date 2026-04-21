"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { useNotifications } from "@/lib/notifications";
import { Loader2, ExternalLink } from "lucide-react";

const SORT_CODE_LENGTH = 6;
const ACCOUNT_NUMBER_LENGTH = 8;

function formatSortCode(digits: string): string {
  const d = (digits || "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

export default function ContractorPayoutsPage() {
  const { operativeId, refresh, isVerified } = useContractorPortal();
  const pushToast = useNotifications((s) => s.push);
  const [stripeBanner, setStripeBanner] = useState<"return" | "refresh" | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase.from("operatives").select("*").eq("id", operativeId).single();
      if (op) {
        setStripeAccountId((op as { stripe_account_id?: string }).stripe_account_id || null);
        setBankAccountName(String((op as { bank_account_name?: string }).bank_account_name || ""));
        setBankSortCode(String((op as { bank_sort_code?: string }).bank_sort_code || "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH));
        setBankAccountNumber(
          String((op as { bank_account_number?: string }).bank_account_number || "").replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH)
        );
      }
      setLoading(false);
    })();
  }, [operativeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("stripe_return")) setStripeBanner("return");
    else if (q.get("stripe_refresh")) setStripeBanner("refresh");
    if (q.get("stripe_return") || q.get("stripe_refresh")) refresh();
  }, [refresh]);

  useEffect(() => {
    if (!operativeId || !stripeBanner) return;
    const supabase = createClient();
    supabase
      .from("operatives")
      .select("stripe_account_id")
      .eq("id", operativeId)
      .single()
      .then(({ data }) => {
        if (data?.stripe_account_id) setStripeAccountId(data.stripe_account_id);
      });
  }, [operativeId, stripeBanner]);

  const saveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativeId) return;
    setSavingBank(true);
    const supabase = createClient();
    const payload = {
      bank_account_name: bankAccountName.trim() || null,
      bank_sort_code: bankSortCode.replace(/\D/g, "").slice(0, SORT_CODE_LENGTH) || null,
      bank_account_number: bankAccountNumber.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH) || null,
    };
    const { error } = await supabase.from("operatives").update(payload).eq("id", operativeId);
    setSavingBank(false);
    if (error) {
      pushToast({ type: "error", title: "Couldn’t save bank details", message: error.message });
      return;
    }
    await refresh();
    pushToast({
      type: "success",
      title: "Bank details saved",
      message: "Kleen stores these for your account. Stripe also needs your bank for live payouts.",
    });
  };

  const startOnboarding = async () => {
    setRedirecting(true);
    try {
      const res = await fetch("/api/stripe/connect-account-link", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        pushToast({
          type: "error",
          title: "Stripe",
          message: data.error || "Could not start Stripe.",
        });
        setRedirecting(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      pushToast({
        type: "error",
        title: "Stripe",
        message: e instanceof Error ? e.message : "Request failed",
      });
    }
    setRedirecting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bank &amp; payments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Save your UK bank details here for Kleen&apos;s records. For live payouts, Kleen also uses Stripe Connect — you
          complete bank verification on Stripe&apos;s secure flow.
        </p>
      </div>

      <form onSubmit={saveBankDetails} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">UK bank details (stored in Kleen)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Used for verification and payout records. Use an 8-digit account number (include leading zeros).
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Account holder name</span>
            <input
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="As it appears on the account"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Sort code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={formatSortCode(bankSortCode)}
                onChange={(e) => setBankSortCode(e.target.value.replace(/\D/g, "").slice(0, SORT_CODE_LENGTH))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="12-34-56"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Account number</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={ACCOUNT_NUMBER_LENGTH}
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="8 digits"
              />
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={savingBank}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {savingBank ? "Saving…" : "Save bank details"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Stripe Connect (escrow payouts)</h2>
        <p className="mt-1 text-sm text-slate-600">
          After Kleen verifies your contractor account, you can connect Stripe. You enter bank details again on
          Stripe&apos;s secure onboarding — that&apos;s what moves money for completed jobs.
        </p>

        {!isVerified && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Stripe Connect unlocks after Kleen approves your application. Save your bank details above in the meantime.
          </div>
        )}

        {stripeBanner === "return" && isVerified && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Stripe onboarding step finished. If anything is still required, Stripe will prompt you when you open the link
            again.
          </div>
        )}
        {stripeBanner === "refresh" && isVerified && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            Link refreshed — continue setup with Stripe below.
          </div>
        )}

        {isVerified && (
          <div className="mt-4 space-y-3">
            {stripeAccountId ? (
              <>
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Connected account:</span>{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{stripeAccountId}</code>
                </p>
                <p className="text-sm text-slate-600">
                  To update bank details or complete verification, continue Stripe onboarding (same secure link).
                </p>
                <button
                  type="button"
                  disabled={redirecting}
                  onClick={startOnboarding}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Open Stripe setup
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700">Connect Stripe to receive payouts for completed jobs.</p>
                <button
                  type="button"
                  disabled={redirecting}
                  onClick={startOnboarding}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Connect with Stripe
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
