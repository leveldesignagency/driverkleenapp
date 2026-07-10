"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatPricePence, parsePriceToPence, type OperativeServiceRow } from "@/lib/contractor-onboarding";

type ServiceDraft = {
  price: string;
  contractTitle: string;
  contractContent: string;
};

type Props = {
  row: OperativeServiceRow;
  saving: boolean;
  onSave: (id: string, draft: ServiceDraft) => Promise<boolean>;
  onDelete: (id: string) => void;
};

export default function WizardServiceListItem({ row, saving, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(() => ({
    price: formatPricePence(row.default_price_pence),
    contractTitle: row.contract_title || "",
    contractContent: row.contract_content || "",
  }));

  const serviceName = Array.isArray(row.services) ? row.services[0]?.name : row.services?.name;
  const priceLabel =
    row.default_price_pence && row.default_price_pence > 0
      ? `£${formatPricePence(row.default_price_pence)} per job (ex VAT)`
      : "No price set";

  const openEdit = () => {
    setDraft({
      price: formatPricePence(row.default_price_pence),
      contractTitle: row.contract_title || "",
      contractContent: row.contract_content || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({
      price: formatPricePence(row.default_price_pence),
      contractTitle: row.contract_title || "",
      contractContent: row.contract_content || "",
    });
  };

  const handleSave = async () => {
    const pricePence = parsePriceToPence(draft.price);
    if (!pricePence || pricePence <= 0) return;
    if (!draft.contractContent.trim()) return;
    const ok = await onSave(row.id!, draft);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4 transition hover:border-slate-300 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">{serviceName || row.service_id}</p>
            <p className="mt-1 text-sm font-medium text-brand-700">{priceLabel}</p>
            {row.contract_title && (
              <p className="mt-2 text-sm text-slate-600">{row.contract_title}</p>
            )}
            {row.contract_content && (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{row.contract_content}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => row.id && onDelete(row.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
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
    <li className="rounded-xl border-2 border-brand-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">{serviceName || row.service_id}</p>
        <button type="button" onClick={cancelEdit} className="text-xs font-medium text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-xs lg:col-span-1">
          <span className="font-medium text-slate-500">Price per completed job (£, ex VAT)</span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
            <input
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-7 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="150.00"
            />
          </div>
        </label>
        <label className="block text-xs lg:col-span-1">
          <span className="font-medium text-slate-500">Contract title</span>
          <input
            value={draft.contractTitle}
            onChange={(e) => setDraft((d) => ({ ...d, contractTitle: e.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="block text-xs lg:col-span-2">
          <span className="font-medium text-slate-500">Contract terms (full text)</span>
          <textarea
            value={draft.contractContent}
            onChange={(e) => setDraft((d) => ({ ...d, contractContent: e.target.value }))}
            rows={5}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </li>
  );
}
