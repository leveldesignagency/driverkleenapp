import ContractorPortalShell from "@/components/contractor/ContractorPortalShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contractor portal",
};

export default function ContractorPortalLayout({ children }: { children: React.ReactNode }) {
  return <ContractorPortalShell>{children}</ContractorPortalShell>;
}
