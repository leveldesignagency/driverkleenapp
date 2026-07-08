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
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80">
      <div className="border-b border-slate-100 px-5 py-5">
        <Link href="/contractor" className="flex items-center gap-3">
          <Image src="/images/kleen-logo.svg" alt="KLEEN" width={120} height={50} className="h-9 w-auto" />
        </Link>
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
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const showActive =
            href === "/contractor"
              ? pathname === "/contractor" || pathname === "/contractor/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
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
