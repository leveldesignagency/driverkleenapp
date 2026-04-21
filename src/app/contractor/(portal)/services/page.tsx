"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { Loader2, Trash2 } from "lucide-react";

type ServiceRow = { id: string; name: string };
type OsRow = {
  id: string;
  service_id: string;
  contract_title: string | null;
  contract_content: string | null;
  contract_content_preview: string | null;
  services?: { name: string } | { name: string }[] | null;
};

export default function ContractorServicesPage() {
  const { operativeId } = useContractorPortal();
  const [catalog, setCatalog] = useState<ServiceRow[]>([]);
  const [rows, setRows] = useState<OsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addServiceId, setAddServiceId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addFull, setAddFull] = useState("");
  const [addPreview, setAddPreview] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!operativeId) return;
    const supabase = createClient();
    const [{ data: svc }, { data: os }] = await Promise.all([
      supabase.from("services").select("id, name").eq("is_active", true).order("name"),
      supabase
        .from("operative_services")
        .select("id, service_id, contract_title, contract_content, contract_content_preview, services(name)")
        .eq("operative_id", operativeId),
    ]);
    setCatalog((svc as ServiceRow[]) || []);
    setRows((os as OsRow[]) || []);
    setLoading(false);
  }, [operativeId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const usedIds = new Set(rows.map((r) => r.service_id));
  const canAdd = catalog.filter((s) => !usedIds.has(s.id));

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativeId || !addServiceId || !addFull.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("operative_services").insert({
      operative_id: operativeId,
      service_id: addServiceId,
      contract_title: addTitle.trim() || null,
      contract_content: addFull.trim(),
      contract_content_preview: addPreview.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setAddServiceId("");
    setAddTitle("");
    setAddFull("");
    setAddPreview("");
    load();
  };

  const updateRow = async (
    id: string,
    patch: { contract_title?: string | null; contract_content?: string | null; contract_content_preview?: string | null }
  ) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("operative_services")
      .update({
        contract_title: patch.contract_title ?? null,
        contract_content: patch.contract_content ?? null,
        contract_content_preview: patch.contract_content_preview?.trim() || null,
      })
      .eq("id", id);
    if (error) alert(error.message);
    else load();
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
          Link Kleen catalogue services to your long-form contract text. Customers see Kleen&apos;s short agreement plus
          an optional preview; the full text is emailed after they pay.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Your services</h2>
        <ul className="mt-4 space-y-6">
          {rows.map((r) => {
            const sn = Array.isArray(r.services) ? r.services[0]?.name : r.services?.name;
            return (
              <li key={r.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{sn || r.service_id}</p>
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <label className="mt-3 block text-xs">
                  <span className="text-slate-500">Contract title</span>
                  <input
                    defaultValue={r.contract_title || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (r.contract_title || "")) {
                        updateRow(r.id, { contract_title: e.target.value });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="mt-3 block text-xs">
                  <span className="text-slate-500">Full contract (emailed after customer pays)</span>
                  <textarea
                    defaultValue={r.contract_content || ""}
                    rows={5}
                    onBlur={(e) => {
                      if (e.target.value !== (r.contract_content || "")) {
                        updateRow(r.id, { contract_content: e.target.value });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="mt-3 block text-xs">
                  <span className="text-slate-500">Short preview / addendum (optional)</span>
                  <textarea
                    defaultValue={r.contract_content_preview || ""}
                    rows={2}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (r.contract_content_preview || "")) {
                        updateRow(r.id, { contract_content_preview: v });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </li>
            );
          })}
          {rows.length === 0 && <li className="text-sm text-slate-500">No services yet — add one below.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add service</h2>
        {canAdd.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">All active catalogue services are already linked.</p>
        ) : (
          <form onSubmit={addService} className="mt-4 space-y-3">
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
              />
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
