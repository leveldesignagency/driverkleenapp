"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { useNotifications } from "@/lib/notifications";
import { Loader2 } from "lucide-react";

type ContractorType = "sole_trader" | "business";

export default function ContractorProfilePage() {
  const { operativeId, refresh } = useContractorPortal();
  const pushToast = useNotifications((s) => s.push);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contractorType, setContractorType] = useState<ContractorType>("sole_trader");
  const [companyName, setCompanyName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState("");

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthEmail(user?.email || "");

      const { data: op } = await supabase.from("operatives").select("*").eq("id", operativeId).single();
      if (op) {
        setFullName(op.full_name || "");
        setPhone(op.phone || "");
        setContractorType((op.contractor_type as ContractorType) || "sole_trader");
        setCompanyName(op.company_name || "");
        setHourlyRate(op.hourly_rate != null ? String(op.hourly_rate) : "");
        setNotes(op.notes || "");
        setCompanyNumber(op.company_number || "");
        setVatNumber(op.vat_number || "");
        setUtrNumber(op.utr_number || "");
        setTradingName((op as { trading_name?: string }).trading_name || "");
        setRegisteredAddress((op as { registered_address?: string }).registered_address || "");
        setServiceAreas(Array.isArray(op.service_areas) ? op.service_areas : []);
      }
      setLoading(false);
    })();
  }, [operativeId]);

  const addArea = () => {
    const v = areaInput.trim();
    if (v && !serviceAreas.includes(v)) setServiceAreas([...serviceAreas, v]);
    setAreaInput("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativeId) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      full_name: fullName.trim(),
      email: (authEmail || user?.email || "").trim() || undefined,
      phone: phone.trim() || null,
      contractor_type: contractorType,
      company_name: companyName.trim() || null,
      hourly_rate: hourlyRate ? Math.round(Number(hourlyRate)) : null,
      notes: notes.trim() || null,
      company_number: companyNumber.trim() || null,
      vat_number: vatNumber.trim() || null,
      utr_number: utrNumber.replace(/\D/g, "").slice(0, 10) || null,
      trading_name: tradingName.trim() || null,
      registered_address: registeredAddress.trim() || null,
      service_areas: serviceAreas,
    };

    let { error } = await supabase.from("operatives").update(payload).eq("id", operativeId);
    // Until migration 034 is applied, UK columns may be missing — retry without them.
    if (error?.message && /trading_name|registered_address|does not exist|schema cache/i.test(error.message)) {
      const rest = { ...payload } as Record<string, unknown>;
      delete rest.trading_name;
      delete rest.registered_address;
      const second = await supabase.from("operatives").update(rest).eq("id", operativeId);
      error = second.error;
    }
    if (user && fullName.trim()) {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    }

    setSaving(false);
    if (error) {
      pushToast({
        type: "error",
        title: "Couldn’t save",
        message: error.message,
      });
      return;
    }
    await refresh();
    pushToast({
      type: "success",
      title: "Profile saved",
      message: "Your company details have been updated.",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
        <h1 className="text-2xl font-bold text-slate-900">Company &amp; profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          UK-focused business details for Kleen&apos;s verification. Add bank details under{" "}
          <Link href="/contractor/payouts" className="font-medium text-brand-600 hover:underline">
            Bank &amp; payments
          </Link>
          .
        </p>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Sign-in email</span>
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {authEmail || "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">To change it, contact Kleen or use account recovery from the customer sign-in flow.</p>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Business</h2>
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-xs font-medium text-slate-500">Type</span>
              <div className="mt-2 flex gap-2">
                {(["sole_trader", "business"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setContractorType(t)}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                      contractorType === t
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t === "sole_trader" ? "Sole trader" : "Business"}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Company name</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={contractorType === "business" ? "Registered name" : "Optional"}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Trading name (UK)</span>
              <input
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="If different from company name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Registered or trading address (UK)</span>
              <textarea
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Street, town, postcode"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Hourly rate (£, ex VAT — guide only)</span>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Service areas</h2>
          <p className="mt-1 text-xs text-slate-500">Regions you cover (e.g. London, Surrey).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {serviceAreas.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {a}
                <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => setServiceAreas(serviceAreas.filter((x) => x !== a))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Add area"
            />
            <button type="button" onClick={addArea} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Add
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tax &amp; registration</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Company number</span>
              <input
                value={companyNumber}
                onChange={(e) => setCompanyNumber(e.target.value.slice(0, 8))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">VAT number</span>
              <input
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">UTR (10 digits)</span>
              <input
                inputMode="numeric"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Internal notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Anything Kleen should know…"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
