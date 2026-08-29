"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

export type AppDialogVariant = "success" | "error" | "info";

export type AppDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  variant?: AppDialogVariant;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const VARIANT_STYLES: Record<
  AppDialogVariant,
  { icon: typeof CheckCircle2; iconWrap: string; iconColor: string; primaryBtn: string }
> = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-50 ring-emerald-100",
    iconColor: "text-emerald-600",
    primaryBtn: "bg-brand-600 hover:bg-brand-500 text-white",
  },
  error: {
    icon: XCircle,
    iconWrap: "bg-red-50 ring-red-100",
    iconColor: "text-red-600",
    primaryBtn: "bg-red-700 hover:bg-red-600 text-white",
  },
  info: {
    icon: Info,
    iconWrap: "bg-brand-50 ring-brand-100",
    iconColor: "text-brand-600",
    primaryBtn: "bg-brand-600 hover:bg-brand-500 text-white",
  },
};

export function AppDialog({
  open,
  onClose,
  title,
  message,
  variant = "info",
  primaryLabel = "OK",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: AppDialogProps) {
  const [mounted, setMounted] = useState(false);
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.iconWrap}`}
            >
              <Icon className={`h-6 w-6 ${styles.iconColor}`} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="app-dialog-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
              {message && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary ?? onClose}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm ${styles.primaryBtn}`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
