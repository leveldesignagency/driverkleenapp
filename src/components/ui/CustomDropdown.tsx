"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, LucideIcon } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  icon?: LucideIcon;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder = "Select…",
  className = "",
  searchable = false,
  searchPlaceholder = "Type to find…",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = searchable && normalizedQuery
    ? options.filter((o) => o.label.toLowerCase().includes(normalizedQuery))
    : options;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        <span className={`flex-1 truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/50">
          {searchable && (
            <div className="px-2 pb-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                autoFocus
              />
            </div>
          )}
          {visibleOptions.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-600 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isActive && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            );
          })}
          {visibleOptions.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">No results</p>
          )}
        </div>
      )}
    </div>
  );
}
