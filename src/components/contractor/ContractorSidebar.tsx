"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  FileText,
  Landmark,
  Briefcase,
  CalendarDays,
  Scale,
  LogOut,
  X,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { normalizeSiteOrigin } from "@/lib/customer-app-url";

function getMarketingHomeUrl(): string {
  if (typeof window === "undefined") return "/";
  const fromEnv = normalizeSiteOrigin(process.env.NEXT_PUBLIC_MARKETING_URL || "");
  if (fromEnv) return fromEnv;
  return "https://www.kleenapp.co.uk";
}

const NAV_BASE = [
  { href: "/contractor", label: "Overview", icon: LayoutDashboard },
  { href: "/contractor/profile", label: "Company & profile", icon: UserRound },
  { href: "/contractor/services", label: "Services & contracts", icon: FileText },
  { href: "/contractor/payouts", label: "Bank details", icon: Landmark },
];
const NAV_VERIFIED = [
  { href: "/contractor/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/contractor/jobs", label: "My work", icon: Briefcase },
  { href: "/contractor/disputes", label: "Disputes", icon: Scale },
];

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function ContractorSidebar({ mobileOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { isVerified, rejectionMessage } = useContractorPortal();
  const NAV = [...NAV_BASE, ...(isVerified ? NAV_VERIFIED : [])];
  const findActive = pathname === "/contractor/find" || pathname.startsWith("/contractor/find/");

  const signOut = async () => {
    onClose?.();
    const supabase = createClient();
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error(e);
    }
    router.refresh();
    window.location.assign(getMarketingHomeUrl());
  };

  const handleNav = () => {
    onClose?.();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] max-w-[85vw] flex-col border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-xl transition-transform duration-200 ease-out lg:relative lg:z-auto lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-2">
            <Link href="/contractor" className="flex items-center gap-3" onClick={handleNav}>
              <Image src="/images/kleen-logo.svg" alt="KLEEN" width={120} height={50} className="h-9 w-auto" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Contractor portal</p>
          <p className="mt-0.5 text-[10px] font-medium text-slate-400">contractor.kleenapp.co.uk</p>
          {rejectionMessage && (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] leading-snug text-red-900">
              Application needs changes — see the banner on Overview. Update your profile, then Kleen can review again.
            </p>
          )}
          {!isVerified && !rejectionMessage && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
              Awaiting Kleen approval — complete profile &amp; services; jobs and payouts unlock after verification.
            </p>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {isVerified && (
            <Link
              href="/contractor/find"
              onClick={handleNav}
              className={`mb-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold tracking-tight transition-colors ${
                findActive
                  ? "bg-brand-600 text-white"
                  : "bg-brand-600/90 text-white hover:bg-brand-600"
              }`}
            >
              <Search className="h-4 w-4 shrink-0" />
              Find a Job
            </Link>
          )}

          {NAV.map(({ href, label, icon: Icon }) => {
            const showActive =
              href === "/contractor"
                ? pathname === "/contractor" || pathname === "/contractor/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={handleNav}
                className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  showActive
                    ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${showActive ? "opacity-100" : "opacity-70"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
