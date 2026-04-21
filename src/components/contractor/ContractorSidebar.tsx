"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  FileText,
  Landmark,
  Briefcase,
  Scale,
  LogOut,
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
  { href: "/contractor/payouts", label: "Bank & payments", icon: Landmark },
];
const NAV_VERIFIED = [
  { href: "/contractor/jobs", label: "Jobs & quotes", icon: Briefcase },
  { href: "/contractor/disputes", label: "Disputes", icon: Scale },
];

export default function ContractorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isVerified, rejectionMessage } = useContractorPortal();
  const NAV = [...NAV_BASE, ...(isVerified ? NAV_VERIFIED : [])];

  const signOut = async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error(e);
    }
    router.refresh();
    window.location.assign(getMarketingHomeUrl());
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kleen</p>
        <p className="text-sm font-bold text-slate-900">Contractor portal</p>
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
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const showActive =
            href === "/contractor"
              ? pathname === "/contractor" || pathname === "/contractor/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                showActive
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-2">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
