"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { useNotifications } from "@/lib/notifications";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import { Loader2 } from "lucide-react";

const SORT_CODE_LENGTH = 6;
const ACCOUNT_NUMBER_LENGTH = 8;

function formatSortCode(digits: string): string {
  const d = (digits || "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

export default function ContractorPayoutsPage() {
  const { operativeId, refresh } = useContractorPortal();
  const pushToast = useNotifications((s) => s.push);
  const [loading, setLoading] = useState(true);
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
        setBankAccountName(String((op as { bank_account_name?: string }).bank_account_name || ""));
        setBankSortCode(String((op as { bank_sort_code?: string }).bank_sort_code || "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH));
        setBankAccountNumber(
          String((op as { bank_account_number?: string }).bank_account_number || "").replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH),
        );
      }
      setLoading(false);
    })();
  }, [operativeId]);

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
    pushToast({ type: "success", title: "Bank details saved", message: "Kleen uses these for contractor payouts." });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <ContractorPageHeader
        title="Bank details"
        description="Your UK bank account for Kleen payouts. No Stripe setup required — Kleen handles payment processing."
      />

      <form onSubmit={saveBankDetails} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Account holder name</span>
            <input
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="8 digits"
              />
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={savingBank}
          className="mt-6 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {savingBank ? "Saving…" : "Save bank details"}
        </button>
      </form>
    </div>
  );
}
