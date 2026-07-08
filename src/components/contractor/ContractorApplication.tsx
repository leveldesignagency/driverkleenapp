"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import DocumentUploadField from "@/components/contractor/DocumentUploadField";
import { mergeServiceCatalog } from "@/lib/service-catalog";
import {
  formatPricePence,
  getContractorOnboardingSteps,
  isContractorOnboardingComplete,
  joinFullName,
  parsePriceToPence,
  splitFullName,
  type OnboardingStepId,
  type OperativeOnboardingRow,
  type OperativePersonnelRow,
  type OperativeServiceRow,
} from "@/lib/contractor-onboarding";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Trash2,
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
  onSubmitted: () => Promise<void>;
};

export default function ContractorApplication({ operativeId, rejectionMessage, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<OnboardingStepId>("identity");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contractorType, setContractorType] = useState<"sole_trader" | "business">("sole_trader");
  const [companyName, setCompanyName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [idDocumentPath, setIdDocumentPath] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<OperativePersonnelRow[]>([]);
  const [areaInput, setAreaInput] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [linkedServices, setLinkedServices] = useState<OperativeServiceRow[]>([]);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const [catalog, setCatalog] = useState<ServiceRow[]>([]);
  const [addServiceId, setAddServiceId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addFull, setAddFull] = useState("");
  const [addPrice, setAddPrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [opRes, svcRes, persRes, catalogRes] = await Promise.all([
      supabase.from("operatives").select("*").eq("id", operativeId).single(),
      supabase
        .from("operative_services")
        .select("id, service_id, contract_title, contract_content, default_price_pence, services(name)")
        .eq("operative_id", operativeId),
      supabase.from("operative_personnel").select("*").eq("operative_id", operativeId).order("created_at"),
      fetch("/api/contractor/services/catalog", { credentials: "include" }),
    ]);

    const op = opRes.data as OperativeOnboardingRow | null;
    if (!op) {
      setError("Could not load your application.");
      setLoading(false);
      return;
    }

    const { firstName: fn, lastName: ln } = splitFullName(String(op.full_name ?? ""));
    setFirstName(fn);
    setLastName(ln);
    setContractorType((op.contractor_type as "sole_trader" | "business") || "sole_trader");
    setCompanyName(String(op.company_name ?? ""));
    setTradingName(String(op.trading_name ?? ""));
    setCompanyNumber(String(op.company_number ?? ""));
    setVatNumber(String(op.vat_number ?? ""));
    setUtrNumber(String(op.utr_number ?? ""));
    setPhone(String(op.phone ?? ""));
    setRegisteredAddress(String(op.registered_address ?? ""));
    setIdDocumentPath(op.id_document_storage_path || null);
    setServiceAreas(Array.isArray(op.service_areas) ? op.service_areas : []);
    setBankAccountName(String(op.bank_account_name ?? ""));
    setBankSortCode(String(op.bank_sort_code ?? "").replace(/\D/g, "").slice(0, SORT_CODE_LENGTH));
    setBankAccountNumber(
      String(op.bank_account_number ?? "").replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH),
    );
    setTermsAccepted(!!op.contractor_terms_accepted_at);

    setLinkedServices((svcRes.data as OperativeServiceRow[]) || []);
    setPersonnel(
      (persRes.data as OperativePersonnelRow[])?.length
        ? (persRes.data as OperativePersonnelRow[])
        : [{ full_name: "", role: "director" }],
    );

    const catalogJson = (await catalogRes.json().catch(() => ({}))) as { services?: ServiceRow[] };
    if (catalogRes.ok && catalogJson.services?.length) {
      setCatalog(mergeServiceCatalog(catalogJson.services));
    } else {
      const { data: dbServices } = await supabase.from("services").select("id, name").eq("is_active", true).order("name");
      setCatalog(mergeServiceCatalog(dbServices ?? []));
    }

    setLoading(false);
  }, [operativeId]);

  useEffect(() => {
    load();
  }, [load]);

  const draftOperative = useMemo(
    (): OperativeOnboardingRow => ({
      full_name: joinFullName(firstName, lastName),
      contractor_type: contractorType,
      company_name: companyName,
      trading_name: tradingName,
      company_number: companyNumber,
      vat_number: vatNumber,
      utr_number: utrNumber,
      phone,
      registered_address: registeredAddress,
      service_areas: serviceAreas,
      id_document_storage_path: idDocumentPath,
      bank_account_name: bankAccountName,
      bank_sort_code: bankSortCode,
      bank_account_number: bankAccountNumber,
    }),
    [
      firstName,
      lastName,
      contractorType,
      companyName,
      tradingName,
      companyNumber,
      vatNumber,
      utrNumber,
      phone,
      registeredAddress,
      serviceAreas,
      idDocumentPath,
      bankAccountName,
      bankSortCode,
      bankAccountNumber,
    ],
  );

  const steps = useMemo(
    () => getContractorOnboardingSteps(draftOperative, linkedServices, personnel),
    [draftOperative, linkedServices, personnel],
  );

  const applicationComplete = isContractorOnboardingComplete(draftOperative, linkedServices, personnel);

  const usedServiceIds = new Set(linkedServices.map((s) => s.service_id));
  const availableServices = catalog.filter((s) => !usedServiceIds.has(s.id));

  const saveOperative = async (patch: Record<string, unknown>) => {
    const supabase = createClient();
    const { error: upErr } = await supabase.from("operatives").update(patch).eq("id", operativeId);
    if (upErr) throw new Error(upErr.message);
    const fullName = String(patch.full_name ?? joinFullName(firstName, lastName)).trim();
    if (fullName) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    }
  };

  const addArea = () => {
    const v = areaInput.trim();
    if (v && !serviceAreas.includes(v)) setServiceAreas([...serviceAreas, v]);
    setAreaInput("");
  };

  const handleSubmitForReview = async () => {
    if (!termsAccepted) {
      setError("Accept the Kleen contractor terms to submit your application.");
      return;
    }
    setSubmittingReview(true);
    setError(null);
    const supabase = createClient();
    await supabase
      .from("operatives")
      .update({ contractor_terms_accepted_at: new Date().toISOString() })
      .eq("id", operativeId);

    const res = await fetch("/api/contractor/submit-for-review", { method: "POST", credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmittingReview(false);
    if (!res.ok) {
      setError(json.error || "Could not submit application");
      return;
    }
    await onSubmitted();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Kleen contractor application</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Apply to work with Kleen</h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete every section below. Kleen will review your application before you can access jobs.
          </p>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-5 sm:px-8 sm:py-6 lg:flex-row lg:gap-8">
        <aside className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-72 lg:self-start lg:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Application steps</p>
          <ul className="mt-3 space-y-1.5">
            {steps.map((step) => (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    activeStep === step.id ? "bg-brand-50 font-medium text-brand-900" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {step.done && step.id !== "review" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  {step.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-h-0 min-w-0 flex-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            {rejectionMessage && (
              <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Your application needs changes</p>
                  <p className="mt-2 whitespace-pre-wrap text-red-800/95">{rejectionMessage}</p>
                  <p className="mt-2 text-xs text-red-700">Update the sections below and resubmit when ready.</p>
                </div>
              </div>
            )}
            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
            )}

            {activeStep === "identity" && (
              <StepSection
                title="Your details"
                description="Tell us who you are and how you trade."
                onContinue={async () => {
                  if (!firstName.trim() || !lastName.trim()) {
                    setError("First and last name are required.");
                    return;
                  }
                  setSaving(true);
                  setError(null);
                  try {
                    await saveOperative({
                      full_name: joinFullName(firstName, lastName),
                      contractor_type: contractorType,
                    });
                    setActiveStep("company");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}
                saving={saving}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" value={firstName} onChange={setFirstName} />
                  <Field label="Last name" value={lastName} onChange={setLastName} />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">How do you trade?</span>
                  <div className="mt-2 flex flex-wrap gap-2">
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
              </StepSection>
            )}

            {activeStep === "company" && (
              <StepSection
                title="Company & tax"
                description={
                  contractorType === "business"
                    ? "Companies House details and VAT if registered."
                    : "Your trading name and HMRC UTR (Unique Taxpayer Reference)."
                }
                onBack={() => setActiveStep("identity")}
                onContinue={async () => {
                  if (!companyName.trim() && !tradingName.trim()) {
                    setError("Add your company or trading name.");
                    return;
                  }
                  if (contractorType === "business" && companyNumber.replace(/\s/g, "").length < 6) {
                    setError("Enter your Companies House registration number.");
                    return;
                  }
                  if (contractorType === "sole_trader" && utrNumber.replace(/\D/g, "").length !== 10) {
                    setError("Enter your 10-digit UTR.");
                    return;
                  }
                  setSaving(true);
                  setError(null);
                  try {
                    await saveOperative({
                      company_name: companyName.trim() || null,
                      trading_name: tradingName.trim() || null,
                      company_number: companyNumber.trim() || null,
                      vat_number: vatNumber.trim() || null,
                      utr_number: utrNumber.replace(/\D/g, "").slice(0, 10) || null,
                    });
                    setActiveStep("contact");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}
                saving={saving}
              >
                <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="Registered or trading name" />
                <Field label="Trading name (if different)" value={tradingName} onChange={setTradingName} />
                {contractorType === "business" ? (
                  <>
                    <Field
                      label="Companies House number"
                      value={companyNumber}
                      onChange={(v) => setCompanyNumber(v.slice(0, 8))}
                      placeholder="8 characters"
                    />
                    <Field label="VAT number (if registered)" value={vatNumber} onChange={setVatNumber} placeholder="Optional" />
                  </>
                ) : (
                  <Field
                    label="UTR — Unique Taxpayer Reference (10 digits)"
                    value={utrNumber}
                    onChange={(v) => setUtrNumber(v.replace(/\D/g, "").slice(0, 10))}
                  />
                )}
              </StepSection>
            )}

            {activeStep === "contact" && (
              <StepSection
                title="Contact & business address"
                description="How Kleen and customers can reach you."
                onBack={() => setActiveStep("company")}
                onContinue={async () => {
                  if (phone.replace(/\D/g, "").length < 10) {
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
                    await saveOperative({ phone: phone.trim(), registered_address: registeredAddress.trim() });
                    setActiveStep("verification");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}
                saving={saving}
              >
                <Field label="UK phone number" value={phone} onChange={setPhone} placeholder="e.g. 07700 900123" />
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Business address</span>
                  <textarea
                    value={registeredAddress}
                    onChange={(e) => setRegisteredAddress(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </label>
              </StepSection>
            )}

            {activeStep === "verification" && (
              <StepSection
                title={contractorType === "business" ? "Key personnel" : "Photo ID"}
                description={
                  contractorType === "business"
                    ? "List directors or persons with significant control. ID upload is optional but helps us verify faster."
                    : "Upload a clear photo of your passport or UK driving licence. Required for sole traders."
                }
                onBack={() => setActiveStep("contact")}
                onContinue={async () => {
                  if (contractorType === "business") {
                    const valid = personnel.filter((p) => p.full_name.trim());
                    if (valid.length < 1) {
                      setError("Add at least one director or key person.");
                      return;
                    }
                    setSaving(true);
                    setError(null);
                    const supabase = createClient();
                    try {
                      const keepIds = valid.map((p) => p.id).filter(Boolean) as string[];
                      if (keepIds.length > 0) {
                        const { data: existing } = await supabase
                          .from("operative_personnel")
                          .select("id")
                          .eq("operative_id", operativeId);
                        const toDelete = (existing || []).map((r) => r.id).filter((id) => !keepIds.includes(id));
                        if (toDelete.length > 0) {
                          await supabase.from("operative_personnel").delete().in("id", toDelete);
                        }
                      } else {
                        await supabase.from("operative_personnel").delete().eq("operative_id", operativeId);
                      }
                      for (const p of valid) {
                        if (p.id) {
                          const { error: upErr } = await supabase
                            .from("operative_personnel")
                            .update({
                              full_name: p.full_name.trim(),
                              role: p.role.trim() || "director",
                            })
                            .eq("id", p.id);
                          if (upErr) throw new Error(upErr.message);
                        } else {
                          const { error: insErr } = await supabase.from("operative_personnel").insert({
                            operative_id: operativeId,
                            full_name: p.full_name.trim(),
                            role: p.role.trim() || "director",
                          });
                          if (insErr) throw new Error(insErr.message);
                        }
                      }
                      await load();
                      setActiveStep("coverage");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not save");
                    } finally {
                      setSaving(false);
                    }
                  } else if (!idDocumentPath) {
                    setError("Upload your photo ID to continue.");
                  } else {
                    setActiveStep("coverage");
                  }
                }}
                saving={saving}
              >
                {contractorType === "business" ? (
                  <div className="space-y-4">
                    {personnel.map((p, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">Person {i + 1}</p>
                          {personnel.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPersonnel(personnel.filter((_, j) => j !== i))}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Full name"
                            value={p.full_name}
                            onChange={(v) => {
                              const next = [...personnel];
                              next[i] = { ...next[i], full_name: v };
                              setPersonnel(next);
                            }}
                          />
                          <Field
                            label="Role"
                            value={p.role}
                            onChange={(v) => {
                              const next = [...personnel];
                              next[i] = { ...next[i], role: v };
                              setPersonnel(next);
                            }}
                            placeholder="e.g. Director"
                          />
                        </div>
                        {p.id && (
                          <div className="mt-3">
                            <DocumentUploadField
                              label="Photo ID (optional)"
                              uploadKind="personnel_id"
                              personnelId={p.id}
                              currentPath={p.id_document_storage_path}
                              onUploaded={(path) => {
                                const next = [...personnel];
                                next[i] = { ...next[i], id_document_storage_path: path };
                                setPersonnel(next);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPersonnel([...personnel, { full_name: "", role: "director" }])}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      + Add another person
                    </button>
                  </div>
                ) : (
                  <DocumentUploadField
                    label="Passport or driving licence"
                    hint="Must show your full name and photo clearly."
                    uploadKind="operative_id"
                    currentPath={idDocumentPath}
                    onUploaded={setIdDocumentPath}
                  />
                )}
              </StepSection>
            )}

            {activeStep === "coverage" && (
              <StepSection
                title="Service areas"
                description="Regions you cover — add at least one."
                onBack={() => setActiveStep("verification")}
                onContinue={async () => {
                  if (serviceAreas.length < 1) {
                    setError("Add at least one service area.");
                    return;
                  }
                  setSaving(true);
                  setError(null);
                  try {
                    await saveOperative({ service_areas: serviceAreas });
                    setActiveStep("services");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}
                saving={saving}
              >
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {a}
                      <button type="button" onClick={() => setServiceAreas(serviceAreas.filter((x) => x !== a))}>
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
                    placeholder="e.g. London, Surrey"
                  />
                  <button type="button" onClick={addArea} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium">
                    Add
                  </button>
                </div>
              </StepSection>
            )}

            {activeStep === "services" && (
              <StepSection
                title="Services & job prices"
                description="For each Kleen service you offer, set your standard price per completed job and your contract terms."
                onBack={() => setActiveStep("coverage")}
                onContinue={() => {
                  if (!applicationComplete && linkedServices.length < 1) {
                    setError("Add at least one service with price and contract.");
                    return;
                  }
                  if (linkedServices.some((s) => !s.default_price_pence || s.default_price_pence <= 0)) {
                    setError("Set a price per job for every service.");
                    return;
                  }
                  setError(null);
                  setActiveStep("bank");
                }}
                saving={false}
                continueDisabled={linkedServices.length < 1}
              >
                {linkedServices.length > 0 && (
                  <ul className="space-y-4">
                    {linkedServices.map((s) => {
                      const name = Array.isArray(s.services) ? s.services[0]?.name : s.services?.name;
                      return (
                        <li key={s.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                          <p className="font-medium text-slate-900">{name || s.service_id}</p>
                          <label className="mt-3 block">
                            <span className="text-xs font-medium text-slate-500">Price per completed job (£, ex VAT)</span>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
                              <input
                                defaultValue={formatPricePence(s.default_price_pence)}
                                onBlur={async (e) => {
                                  const pence = parsePriceToPence(e.target.value);
                                  if (!pence || !s.id) return;
                                  const supabase = createClient();
                                  const { error: upErr } = await supabase
                                    .from("operative_services")
                                    .update({ default_price_pence: pence })
                                    .eq("id", s.id);
                                  if (upErr) setError(upErr.message);
                                  else
                                    setLinkedServices((prev) =>
                                      prev.map((row) => (row.id === s.id ? { ...row, default_price_pence: pence } : row)),
                                    );
                                }}
                                className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
                              />
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-4 space-y-3 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-4">
                  <p className="text-sm font-semibold text-slate-900">Add a service</p>
                  <p className="text-xs text-slate-600">Each service needs a price per completed job and your contract terms.</p>
                    <CustomDropdown
                      value={addServiceId}
                      onChange={setAddServiceId}
                      options={availableServices.map((s) => ({ value: s.id, label: s.name }))}
                      placeholder="Choose a service…"
                      searchable
                      searchPlaceholder="Search services…"
                      emptyMessage="No services available"
                    />
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Price per completed job (£, ex VAT) — required</span>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
                        <input
                          value={addPrice}
                          onChange={(e) => setAddPrice(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-sm"
                          placeholder="e.g. 150.00"
                        />
                      </div>
                    </label>
                    <Field label="Contract title" value={addTitle} onChange={setAddTitle} />
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Contract terms (full text)</span>
                      <textarea
                        value={addFull}
                        onChange={(e) => setAddFull(e.target.value)}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        const pricePence = parsePriceToPence(addPrice);
                        if (!addServiceId || !addFull.trim() || !pricePence) {
                          setError("Choose a service, set a price, and add contract text.");
                          return;
                        }
                        setSaving(true);
                        setError(null);
                        const supabase = createClient();
                        const { data, error: insErr } = await supabase
                          .from("operative_services")
                          .insert({
                            operative_id: operativeId,
                            service_id: addServiceId,
                            contract_title: addTitle.trim() || null,
                            contract_content: addFull.trim(),
                            default_price_pence: pricePence,
                            is_active: true,
                          })
                          .select("id, service_id, contract_title, contract_content, default_price_pence, services(name)")
                          .single();
                        setSaving(false);
                        if (insErr) {
                          setError(
                            insErr.message.includes("default_price_pence") || insErr.message.includes("schema cache")
                              ? `${insErr.message} — run Supabase migration 049 on production.`
                              : insErr.message,
                          );
                          return;
                        }
                        setLinkedServices([...linkedServices, data as OperativeServiceRow]);
                        setAddServiceId("");
                        setAddTitle("");
                        setAddFull("");
                        setAddPrice("");
                      }}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {saving ? "Adding…" : "Add service"}
                    </button>
                </div>
              </StepSection>
            )}

            {activeStep === "bank" && (
              <StepSection
                title="UK bank details"
                description="For Kleen payouts after completed jobs."
                onBack={() => setActiveStep("services")}
                onContinue={async () => {
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
                    setActiveStep("review");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}
                saving={saving}
              >
                <Field label="Account holder name" value={bankAccountName} onChange={setBankAccountName} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Sort code"
                    value={formatSortCode(bankSortCode)}
                    onChange={(v) => setBankSortCode(v.replace(/\D/g, "").slice(0, SORT_CODE_LENGTH))}
                  />
                  <Field
                    label="Account number"
                    value={bankAccountNumber}
                    onChange={(v) => setBankAccountNumber(v.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH))}
                  />
                </div>
              </StepSection>
            )}

            {activeStep === "review" && (
              <StepSection title="Submit application" description="Review your checklist and send to Kleen for approval." onBack={() => setActiveStep("bank")}>
                <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {steps
                    .filter((s) => s.id !== "review")
                    .map((step) => (
                      <li key={step.id} className="flex items-center gap-2 text-sm">
                        {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                        <span className={step.done ? "text-slate-600" : "font-medium text-slate-900"}>{step.label}</span>
                        {!step.done && (
                          <button type="button" onClick={() => setActiveStep(step.id)} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                            Complete
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
                <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 rounded border-slate-300"
                  />
                  <span>
                    I confirm the information provided is accurate. I agree to Kleen&apos;s contractor terms and understand
                    Kleen will verify my business before granting portal access.
                  </span>
                </label>
                {applicationComplete ? (
                  <button
                    type="button"
                    disabled={submittingReview || !termsAccepted}
                    onClick={handleSubmitForReview}
                    className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {submittingReview ? "Submitting…" : "Submit application for review"}
                  </button>
                ) : (
                  <p className="mt-4 text-sm text-amber-800">Complete every section before submitting.</p>
                )}
              </StepSection>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function StepSection({
  title,
  description,
  children,
  onBack,
  onContinue,
  saving = false,
  continueDisabled = false,
  continueLabel = "Continue",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  saving?: boolean;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
      {onContinue && (
        <div className="flex items-center gap-3 pt-2">
          {onBack && (
            <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
      )}
    </section>
  );
}
