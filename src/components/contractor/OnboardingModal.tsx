"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { mergeServiceCatalog } from "@/lib/service-catalog";
import {
  getContractorOnboardingSteps,
  isContractorOnboardingComplete,
  joinFullName,
  splitFullName,
  type OnboardingStepId,
  type OperativeOnboardingRow,
} from "@/lib/contractor-onboarding";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const SORT_CODE_LENGTH = 6;
const ACCOUNT_NUMBER_LENGTH = 8;

function formatSortCode(digits: string): string {
  const d = (digits || "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

type ServiceRow = { id: string; name: string };

type Props = {
  operativeId: string;
  rejectionMessage: string | null;
  onComplete: () => void;
  onRefresh: () => Promise<void>;
};

export default function OnboardingModal({
  operativeId,
  rejectionMessage,
  onComplete,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<OnboardingStepId>("identity");
  const [submittedForReviewAt, setSubmittedForReviewAt] = useState<string | null>(null);
  const [serviceCount, setServiceCount] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [contractorType, setContractorType] = useState<"sole_trader" | "business">("sole_trader");
  const [phone, setPhone] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const [catalog, setCatalog] = useState<ServiceRow[]>([]);
  const [linkedServiceIds, setLinkedServiceIds] = useState<Set<string>>(new Set());
  const [addServiceId, setAddServiceId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addFull, setAddFull] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [opRes, countRes, catalogRes, osRes] = await Promise.all([
      supabase.from("operatives").select("*").eq("id", operativeId).single(),
      supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId),
      fetch("/api/contractor/services/catalog", { credentials: "include" }),
      supabase.from("operative_services").select("service_id").eq("operative_id", operativeId),
    ]);

    const op = opRes.data as OperativeOnboardingRow | null;
    if (!op) {
      setError("Could not load your contractor profile.");
      setLoading(false);
      return;
    }

    setSubmittedForReviewAt(op.submitted_for_review_at || null);
    setServiceCount(countRes.count ?? 0);

    const { firstName: fn, lastName: ln } = splitFullName(String(op.full_name ?? ""));
    setFirstName(fn);
    setLastName(ln);
    setCompanyName(String(op.company_name ?? ""));
    setTradingName(String(op.trading_name ?? ""));
    setContractorType((op.contractor_type as "sole_trader" | "business") || "sole_trader");
    setPhone(String(op.phone ?? ""));
    setRegisteredAddress(String(op.registered_address ?? ""));
    setServiceAreas(Array.isArray(op.service_areas) ? op.service_areas : []);
    setBankAccountName(String(op.bank_account_name ?? ""));
    setBankSortCode(String(op.bank_sort_code ?? "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH));
    setBankAccountNumber(
      String(op.bank_account_number ?? "").replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH),
    );

    const catalogJson = (await catalogRes.json().catch(() => ({}))) as { services?: ServiceRow[] };
    if (catalogRes.ok && catalogJson.services?.length) {
      setCatalog(mergeServiceCatalog(catalogJson.services));
    } else {
      const { data: dbServices } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setCatalog(mergeServiceCatalog(dbServices ?? []));
    }

    setLinkedServiceIds(new Set((osRes.data ?? []).map((r) => String(r.service_id))));
    setLoading(false);
  }, [operativeId]);

  useEffect(() => {
    load();
  }, [load]);

  const draftOperative = useMemo(
    (): OperativeOnboardingRow => ({
      full_name: joinFullName(firstName, lastName),
      phone,
      company_name: companyName,
      trading_name: tradingName,
      registered_address: registeredAddress,
      service_areas: serviceAreas,
      bank_account_name: bankAccountName,
      bank_sort_code: bankSortCode,
      bank_account_number: bankAccountNumber,
      contractor_type: contractorType,
      submitted_for_review_at: submittedForReviewAt,
    }),
    [
      firstName,
      lastName,
      phone,
      companyName,
      tradingName,
      registeredAddress,
      serviceAreas,
      bankAccountName,
      bankSortCode,
      bankAccountNumber,
      contractorType,
      submittedForReviewAt,
    ],
  );

  const steps = useMemo(
    () => getContractorOnboardingSteps(draftOperative, serviceCount),
    [draftOperative, serviceCount],
  );

  const onboardingComplete = isContractorOnboardingComplete(draftOperative, serviceCount);

  const availableServices = catalog.filter((s) => !linkedServiceIds.has(s.id));

  const addArea = () => {
    const v = areaInput.trim();
    if (v && !serviceAreas.includes(v)) setServiceAreas([...serviceAreas, v]);
    setAreaInput("");
  };

  const saveOperative = async (patch: Record<string, unknown>) => {
    const supabase = createClient();
    const { error: upErr } = await supabase.from("operatives").update(patch).eq("id", operativeId);
    if (upErr) throw new Error(upErr.message);

    const fullName = String(patch.full_name ?? joinFullName(firstName, lastName)).trim();
    if (fullName) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      }
    }
    await onRefresh();
  };

  const goNext = (next: OnboardingStepId) => {
    setError(null);
    setActiveStep(next);
  };

  const handleIdentityContinue = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!companyName.trim() && !tradingName.trim()) {
      setError("Add your company name or trading name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOperative({
        full_name: joinFullName(firstName, lastName),
        company_name: companyName.trim() || null,
        trading_name: tradingName.trim() || null,
        contractor_type: contractorType,
      });
      goNext("contact");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleContactContinue = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid UK phone number.");
      return;
    }
    if (!registeredAddress.trim()) {
      setError("Enter your business address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOperative({
        phone: phone.trim(),
        registered_address: registeredAddress.trim(),
      });
      goNext("coverage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleCoverageContinue = async () => {
    if (serviceAreas.length < 1) {
      setError("Add at least one service area.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOperative({ service_areas: serviceAreas });
      goNext("services");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async () => {
    if (!addServiceId || !addFull.trim()) {
      setError("Choose a service and add contract text.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insErr } = await supabase.from("operative_services").insert({
        operative_id: operativeId,
        service_id: addServiceId,
        contract_title: addTitle.trim() || null,
        contract_content: addFull.trim(),
        is_active: true,
      });
      if (insErr) throw new Error(insErr.message);
      setAddServiceId("");
      setAddTitle("");
      setAddFull("");
      setServiceCount((n) => n + 1);
      setLinkedServiceIds((prev) => new Set([...Array.from(prev), addServiceId]));
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add service");
    } finally {
      setSaving(false);
    }
  };

  const handleServicesContinue = () => {
    if (serviceCount < 1) {
      setError("Add at least one service before continuing.");
      return;
    }
    goNext("bank");
  };

  const handleBankContinue = async () => {
    const sortDigits = bankSortCode.replace(/\D/g, "");
    const acctDigits = bankAccountNumber.replace(/\D/g, "");
    if (!bankAccountName.trim() || sortDigits.length < 6 || acctDigits.length < 8) {
      setError("Enter valid UK bank details.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOperative({
        bank_account_name: bankAccountName.trim(),
        bank_sort_code: sortDigits,
        bank_account_number: acctDigits,
      });
      goNext("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    setSubmittingReview(true);
    setError(null);
    const res = await fetch("/api/contractor/submit-for-review", {
      method: "POST",
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      submitted_for_review_at?: string;
    };
    setSubmittingReview(false);
    if (!res.ok) {
      setError(json.error || "Could not submit for review");
      return;
    }
    setSubmittedForReviewAt(json.submitted_for_review_at || new Date().toISOString());
    await load();
    await onRefresh();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
          <p className="mt-4 text-sm text-slate-600">Loading your application…</p>
        </div>
      </div>
    );
  }

  if (submittedForReviewAt && onboardingComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Application submitted</h2>
          <p className="mt-2 text-sm text-slate-600">
            Kleen will review your profile. You can keep editing your details in the portal while you wait — jobs unlock
            after you are verified.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Submitted {new Date(submittedForReviewAt).toLocaleString("en-GB")}
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Continue to portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Contractor application</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Complete your Kleen profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Finish every step below, then send your application for review.
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 justify-center overflow-hidden px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 lg:flex-row lg:gap-8">
          <aside className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-72 lg:self-start lg:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
            <ul className="mt-3 space-y-1.5">
            {steps
              .filter((s) => s.id !== "review")
              .map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      activeStep === step.id ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    {step.label}
                  </button>
                </li>
              ))}
            <li>
              <button
                type="button"
                onClick={() => setActiveStep("review")}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                  activeStep === "review" ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
                }`}
              >
                {onboardingComplete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                )}
                Send for review
              </button>
            </li>
          </ul>
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
          {rejectionMessage && (
            <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">We need more from you before we can approve your application</p>
                <p className="mt-2 whitespace-pre-wrap text-red-800/95">{rejectionMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {activeStep === "identity" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Name &amp; company</h2>
                <p className="mt-1 text-sm text-slate-600">How Kleen should list you on your contractor profile.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">First name</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Last name</span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    required
                  />
                </label>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Business type</span>
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
                      {t === "sole_trader" ? "Sole trader" : "Limited company"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Company name</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder={contractorType === "business" ? "Registered company name" : "Your business name"}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Trading name (if different)</span>
                <input
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <StepActions
                saving={saving}
                onContinue={handleIdentityContinue}
                continueLabel="Save & continue"
              />
            </section>
          )}

          {activeStep === "contact" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contact &amp; business address</h2>
                <p className="mt-1 text-sm text-slate-600">UK contact details for Kleen and your customers.</p>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">UK phone number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="e.g. 07700 900123"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Business address</span>
                <textarea
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="Street, town, postcode"
                />
              </label>
              <StepActions
                saving={saving}
                onBack={() => setActiveStep("identity")}
                onContinue={handleContactContinue}
              />
            </section>
          )}

          {activeStep === "coverage" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Service areas</h2>
                <p className="mt-1 text-sm text-slate-600">Regions you cover — add at least one (e.g. London, Surrey).</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                  >
                    {a}
                    <button
                      type="button"
                      className="text-slate-500 hover:text-red-600"
                      onClick={() => setServiceAreas(serviceAreas.filter((x) => x !== a))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="Add area"
                />
                <button
                  type="button"
                  onClick={addArea}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Add
                </button>
              </div>
              <StepActions
                saving={saving}
                onBack={() => setActiveStep("contact")}
                onContinue={handleCoverageContinue}
              />
            </section>
          )}

          {activeStep === "services" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Services</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Link at least one Kleen service and add your contract text. You can add more later.
                </p>
                {serviceCount > 0 && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">
                    {serviceCount} service{serviceCount === 1 ? "" : "s"} on your profile
                  </p>
                )}
              </div>
              {availableServices.length === 0 && serviceCount < 1 ? (
                <p className="text-sm text-slate-500">Loading catalogue…</p>
              ) : (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Service</span>
                    <CustomDropdown
                      value={addServiceId}
                      onChange={setAddServiceId}
                      options={availableServices.map((s) => ({ value: s.id, label: s.name }))}
                      placeholder="Choose a service…"
                      className="mt-1"
                      searchable
                      searchPlaceholder="Type to find a service…"
                      emptyMessage="No services available"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Contract title</span>
                    <input
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. Driveway cleaning agreement"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Full contract text (required)</span>
                    <textarea
                      value={addFull}
                      onChange={(e) => setAddFull(e.target.value)}
                      rows={5}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAddService}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add service"}
                  </button>
                </div>
              )}
              <StepActions
                saving={false}
                onBack={() => setActiveStep("coverage")}
                onContinue={handleServicesContinue}
                continueDisabled={serviceCount < 1}
              />
            </section>
          )}

          {activeStep === "bank" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">UK bank details</h2>
                <p className="mt-1 text-sm text-slate-600">For Kleen payouts — no Stripe setup required.</p>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Account holder name</span>
                <input
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Sort code</span>
                  <input
                    value={formatSortCode(bankSortCode)}
                    onChange={(e) =>
                      setBankSortCode(e.target.value.replace(/\D/g, "").slice(0, SORT_CODE_LENGTH))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="12-34-56"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Account number</span>
                  <input
                    value={bankAccountNumber}
                    onChange={(e) =>
                      setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    placeholder="8 digits"
                  />
                </label>
              </div>
              <StepActions saving={saving} onBack={() => setActiveStep("services")} onContinue={handleBankContinue} />
            </section>
          )}

          {activeStep === "review" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Review &amp; submit</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Check everything is complete, then send your application to Kleen.
                </p>
              </div>
              <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                {steps
                  .filter((s) => s.id !== "review")
                  .map((step) => (
                    <li key={step.id} className="flex items-center gap-2 text-sm">
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300" />
                      )}
                      <span className={step.done ? "text-slate-600" : "font-medium text-slate-900"}>{step.label}</span>
                      {!step.done && (
                        <button
                          type="button"
                          onClick={() => setActiveStep(step.id)}
                          className="ml-auto text-xs font-medium text-brand-600 hover:underline"
                        >
                          Complete
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
              {onboardingComplete ? (
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={handleSubmitForReview}
                  className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {submittingReview ? "Sending…" : "Send for review"}
                </button>
              ) : (
                <p className="text-sm text-amber-800">Complete every item above before submitting.</p>
              )}
              <button
                type="button"
                onClick={() => setActiveStep("bank")}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to bank details
              </button>
            </section>
          )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StepActions({
  saving,
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
}: {
  saving: boolean;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <button
        type="button"
        disabled={saving || continueDisabled}
        onClick={onContinue}
        className="ml-auto flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : continueLabel}
        {!saving && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
