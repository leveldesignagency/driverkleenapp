import Image from "next/image";

/** Shared header for contractor sign-in / join / application shells. */
export default function ContractorPortalBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center">
        <Image src="/images/kleen-logo.svg" alt="Kleen" width={160} height={66} className="h-11 w-auto" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-brand-600">Contractor portal</p>
      <p className="mt-1 text-[11px] text-slate-400">contractor.kleenapp.co.uk</p>
      {subtitle && <p className="mt-4 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}
