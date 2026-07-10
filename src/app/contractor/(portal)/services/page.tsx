"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { EXPECTED_CATALOG_SIZE, getStaticServiceCatalog, mergeServiceCatalog } from "@/lib/service-catalog";
import { formatPricePence, parsePriceToPence } from "@/lib/contractor-onboarding";
import { Loader2, Pencil, Trash2 } from "lucide-react";

type ServiceRow = { id: string; name: string };
type OsRow = {
  id: string;
  service_id: string;
  contract_title: string | null;
  contract_content: string | null;
  contract_content_preview: string | null;
  default_price_pence: number | null;
  services?: { name: string } | { name: string }[] | null;
};

function matchServiceQuery(name: string, query: string) {
  return name.toLowerCase().includes(query.trim().toLowerCase());
}

type ServiceDraft = {
  price: string;
  contractTitle: string;
  contractContent: string;
  contractPreview: string;
};

function ServiceListItem({
  row,
  saving,
  onSave,
  onDelete,
}: {
  row: OsRow;
  saving: boolean;
  onSave: (id: string, draft: ServiceDraft) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(() => ({
    price: formatPricePence(row.default_price_pence),
    contractTitle: row.contract_title || "",
    contractContent: row.contract_content || "",
    contractPreview: row.contract_content_preview || "",
  }));

  const serviceName = Array.isArray(row.services) ? row.services[0]?.name : row.services?.name;
  const priceLabel =
    row.default_price_pence && row.default_price_pence > 0
      ? `£${formatPricePence(row.default_price_pence)} per job`
      : "No price set";

  const openEdit = () => {
    setDraft({
      price: formatPricePence(row.default_price_pence),
      contractTitle: row.contract_title || "",
      contractContent: row.contract_content || "",
      contractPreview: row.contract_content_preview || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({
      price: formatPricePence(row.default_price_pence),
      contractTitle: row.contract_title || "",
      contractContent: row.contract_content || "",
      contractPreview: row.contract_content_preview || "",
    });
  };

  const handleSave = async () => {
    const ok = await onSave(row.id, draft);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{serviceName || row.service_id}</p>
            <p className="mt-0.5 text-sm text-slate-600">{priceLabel}</p>
            {row.contract_title && (
              <p className="mt-1 truncate text-xs text-slate-500">{row.contract_title}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">{serviceName || row.service_id}</p>
        <button
          type="button"
          onClick={cancelEdit}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-xs">
          <span className="text-slate-500">Price per completed job (£, ex VAT)</span>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
            <input
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
              placeholder="150.00"
            />
          </div>
        </label>
        <label className="block text-xs">
          <span className="text-slate-500">Contract title</span>
          <input
            value={draft.contractTitle}
            onChange={(e) => setDraft((d) => ({ ...d, contractTitle: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-slate-500">Full contract (emailed after customer pays)</span>
          <textarea
            value={draft.contractContent}
            onChange={(e) => setDraft((d) => ({ ...d, contractContent: e.target.value }))}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block text-xs">
          <span className="text-slate-500">Short preview / addendum (optional)</span>
          <textarea
            value={draft.contractPreview}
            onChange={(e) => setDraft((d) => ({ ...d, contractPreview: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </li>
  );
}

export default function ContractorServicesPage() {
  const { operativeId } = useContractorPortal();
  const [catalog, setCatalog] = useState<ServiceRow[]>(getStaticServiceCatalog());
  const [rows, setRows] = useState<OsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);
  const [addServiceId, setAddServiceId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addFull, setAddFull] = useState("");
  const [addPreview, setAddPreview] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!operativeId) return;
    const supabase = createClient();
    const [catalogRes, { data: os }] = await Promise.all([
      fetch("/api/contractor/services/catalog", { credentials: "include" }),
      supabase
        .from("operative_services")
        .select("id, service_id, contract_title, contract_content, contract_content_preview, default_price_pence, services(name)")
        .eq("operative_id", operativeId),
    ]);

    const catalogJson = (await catalogRes.json().catch(() => ({}))) as {
      services?: ServiceRow[];
      syncWarning?: string;
      count?: number;
    };

    if (catalogRes.ok && catalogJson.services?.length) {
      setCatalog(mergeServiceCatalog(catalogJson.services));
      setCatalogWarning(catalogJson.syncWarning || null);
    } else {
      const { data: dbServices } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setCatalog(mergeServiceCatalog(dbServices ?? []));
      setCatalogWarning(
        catalogJson.syncWarning ||
          (!catalogRes.ok ? "Could not refresh catalogue from server — showing full Kleen list." : null),
      );
    }

    setRows((os as OsRow[]) || []);
    setLoading(false);
  }, [operativeId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const linkedById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const sn = Array.isArray(r.services) ? r.services[0]?.name : r.services?.name;
      map.set(r.service_id, sn || r.service_id);
    }
    return map;
  }, [rows]);

  const usedIds = new Set(rows.map((r) => r.service_id));
  const canAdd = catalog.filter((s) => !usedIds.has(s.id));

  const dropdownEmptyMessage = useMemo(() => {
    const q = addSearchQuery.trim();
    if (!q) return "No services available to add";
    const linkedMatch = Array.from(linkedById.entries()).find(([, name]) => matchServiceQuery(name, q));
    if (linkedMatch) {
      return `${linkedMatch[1]} is already on your profile — edit it above or remove it to add again.`;
    }
    return `No services match “${q}”`;
  }, [addSearchQuery, linkedById]);

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativeId || !addServiceId || !addFull.trim()) return;
    const pricePence = parsePriceToPence(addPrice);
    if (!pricePence || pricePence <= 0) {
      alert("Enter your price per completed job (£, ex VAT).");
      return;
    }
    setSaving(true);

    await fetch("/api/contractor/services/catalog", { credentials: "include" }).catch(() => null);

    const supabase = createClient();
    const { error } = await supabase.from("operative_services").insert({
      operative_id: operativeId,
      service_id: addServiceId,
      contract_title: addTitle.trim() || null,
      contract_content: addFull.trim(),
      contract_content_preview: addPreview.trim() || null,
      default_price_pence: pricePence,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      alert(
        error.message.includes("default_price_pence") || error.message.includes("schema cache")
          ? `${error.message}\n\nRun Supabase migration 049 (contractor application onboarding) on production.`
          : error.message.includes("foreign key") || error.message.includes("services")
            ? `${error.message}\n\nThe service catalogue may still be syncing — try again in a moment.`
            : error.message,
      );
      return;
    }
    setAddServiceId("");
    setAddTitle("");
    setAddFull("");
    setAddPreview("");
    setAddPrice("");
    load();
  };

  const updateRow = async (
    id: string,
    patch: {
      contract_title?: string | null;
      contract_content?: string | null;
      contract_content_preview?: string | null;
      default_price_pence?: number | null;
    },
  ) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("operative_services")
      .update({
        contract_title: patch.contract_title ?? undefined,
        contract_content: patch.contract_content ?? undefined,
        contract_content_preview: patch.contract_content_preview?.trim() || undefined,
        default_price_pence: patch.default_price_pence ?? undefined,
      })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return false;
    }
    await load();
    return true;
  };

  const saveRow = async (id: string, draft: ServiceDraft): Promise<boolean> => {
    const pricePence = parsePriceToPence(draft.price);
    if (!pricePence || pricePence <= 0) {
      alert("Enter a valid price per completed job (£, ex VAT).");
      return false;
    }
    if (!draft.contractContent.trim()) {
      alert("Contract text is required.");
      return false;
    }
    setSavingRowId(id);
    const ok = await updateRow(id, {
      default_price_pence: pricePence,
      contract_title: draft.contractTitle.trim() || null,
      contract_content: draft.contractContent.trim(),
      contract_content_preview: draft.contractPreview.trim() || null,
    });
    setSavingRowId(null);
    return ok;
  };

  const removeRow = async (id: string) => {
    if (!confirm("Remove this service and its contract from your profile?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("operative_services").delete().eq("id", id);
    if (error) alert(error.message);
    else load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Services &amp; contracts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Link Kleen services to your contract text and set your <strong>price per completed job</strong> for each one
          (ex VAT). Customers see a range derived from verified contractors.
        </p>
      </div>

      {catalogWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{catalogWarning}</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Your services</h2>
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <ServiceListItem
              key={r.id}
              row={r}
              saving={savingRowId === r.id}
              onSave={saveRow}
              onDelete={removeRow}
            />
          ))}
          {rows.length === 0 && <li className="text-sm text-slate-500">No services yet — add one below.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Add service</h2>
        {canAdd.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            All {EXPECTED_CATALOG_SIZE} Kleen catalogue services are already linked to your profile.
          </p>
        ) : (
          <form onSubmit={addService} className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              {canAdd.length} of {EXPECTED_CATALOG_SIZE} services available to add. Services already on your profile
              won&apos;t appear here — search for something else (e.g. Patio, Gutter Clearing).
            </p>
            <label className="block text-xs">
              <span className="text-slate-500">Service</span>
              <CustomDropdown
                value={addServiceId}
                onChange={setAddServiceId}
                options={canAdd.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Choose a service…"
                className="mt-1"
                searchable
                searchPlaceholder="Type to find a service…"
                emptyMessage={dropdownEmptyMessage}
                onSearchQueryChange={setAddSearchQuery}
              />
            </label>
            <label className="block text-xs">
              <span className="text-slate-500">Price per completed job (£, ex VAT) — required</span>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
                <input
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
                  placeholder="e.g. 150.00"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Your standard charge when you complete this type of job.</p>
            </label>
            <label className="block text-xs">
              <span className="text-slate-500">Contract title</span>
              <input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Driveway cleaning agreement"
              />
            </label>
            <label className="block text-xs">
              <span className="text-slate-500">Full contract text (required)</span>
              <textarea
                value={addFull}
                onChange={(e) => setAddFull(e.target.value)}
                rows={5}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-slate-500">Preview / addendum (optional)</span>
              <textarea
                value={addPreview}
                onChange={(e) => setAddPreview(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add service"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
