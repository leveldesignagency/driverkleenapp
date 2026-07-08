"use client";

import { createClient } from "@/lib/supabase/client";
import { Clock, LogOut, Mail } from "lucide-react";

type Props = {
  submittedAt: string | null;
  email?: string | null;
};

export default function ApplicationPendingScreen({ submittedAt, email }: Props) {
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    window.location.assign("https://www.kleenapp.co.uk");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-brand-50/40 px-5 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-700" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Application under review</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Thanks for applying to work with Kleen. Our team is reviewing your application and will email you once a
          decision is made. You cannot access the contractor dashboard until you are approved.
        </p>
        {submittedAt && (
          <p className="mt-4 text-xs text-slate-500">
            Submitted {new Date(submittedAt).toLocaleString("en-GB")}
          </p>
        )}
        {email && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            We will contact you at <span className="font-medium text-slate-800">{email}</span>
          </p>
        )}
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p className="font-medium text-slate-800">What happens next?</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Kleen verifies your company details and documents</li>
            <li>If we need more information, we will email you — you can update and resubmit</li>
            <li>Once approved, you will get an email and full access to browse and quote on jobs</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
