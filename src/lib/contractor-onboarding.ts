export type OperativePersonnelRow = {
  id?: string;
  full_name: string;
  role: string;
  id_document_storage_path?: string | null;
};

export type OperativeServiceRow = {
  id?: string;
  service_id: string;
  contract_title?: string | null;
  contract_content?: string | null;
  default_price_pence?: number | null;
  services?: { name: string } | { name: string }[] | null;
};

export type OperativeOnboardingRow = {
  phone?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  trading_name?: string | null;
  registered_address?: string | null;
  service_areas?: string[] | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  contractor_type?: string | null;
  company_number?: string | null;
  vat_number?: string | null;
  utr_number?: string | null;
  id_document_storage_path?: string | null;
  contractor_terms_accepted_at?: string | null;
  submitted_for_review_at?: string | null;
};

export type OnboardingStepId =
  | "identity"
  | "company"
  | "contact"
  | "verification"
  | "coverage"
  | "services"
  | "bank"
  | "review";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  done: boolean;
};

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function formatPricePence(pence: number | null | undefined): string {
  if (pence == null || Number.isNaN(pence)) return "";
  return (pence / 100).toFixed(2);
}

export function parsePriceToPence(value: string): number | null {
  const cleaned = value.replace(/[£,\s]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function isBusiness(operative: OperativeOnboardingRow): boolean {
  return operative.contractor_type === "business";
}

function phoneOk(operative: OperativeOnboardingRow): boolean {
  return String(operative.phone ?? "").replace(/\D/g, "").length >= 10;
}

function identityOk(operative: OperativeOnboardingRow): boolean {
  const { firstName, lastName } = splitFullName(String(operative.full_name ?? ""));
  return !!(firstName.trim() && lastName.trim() && operative.contractor_type);
}

function companyOk(operative: OperativeOnboardingRow): boolean {
  const hasName = !!(
    (operative.company_name && operative.company_name.trim()) ||
    (operative.trading_name && operative.trading_name.trim())
  );
  if (!hasName) return false;
  if (isBusiness(operative)) {
    const cn = String(operative.company_number ?? "").replace(/\s/g, "");
    return cn.length >= 6;
  }
  const utr = String(operative.utr_number ?? "").replace(/\D/g, "");
  return utr.length === 10;
}

function addressOk(operative: OperativeOnboardingRow): boolean {
  return !!(operative.registered_address && operative.registered_address.trim());
}

function verificationOk(operative: OperativeOnboardingRow, personnel: OperativePersonnelRow[]): boolean {
  if (isBusiness(operative)) {
    return personnel.some((p) => p.full_name.trim().length > 0);
  }
  return !!(operative.id_document_storage_path && operative.id_document_storage_path.trim());
}

function areasOk(operative: OperativeOnboardingRow): boolean {
  return Array.isArray(operative.service_areas) && operative.service_areas.length > 0;
}

function servicesOk(services: OperativeServiceRow[]): boolean {
  if (services.length < 1) return false;
  return services.every(
    (s) =>
      !!(s.contract_content && s.contract_content.trim()) &&
      typeof s.default_price_pence === "number" &&
      s.default_price_pence > 0,
  );
}

function bankOk(operative: OperativeOnboardingRow): boolean {
  const sortDigits = String(operative.bank_sort_code ?? "").replace(/\D/g, "");
  const acctDigits = String(operative.bank_account_number ?? "").replace(/\D/g, "");
  return (
    !!(operative.bank_account_name && operative.bank_account_name.trim()) &&
    sortDigits.length >= 6 &&
    acctDigits.length >= 8
  );
}

export function getContractorOnboardingSteps(
  operative: OperativeOnboardingRow,
  services: OperativeServiceRow[],
  personnel: OperativePersonnelRow[],
): OnboardingStep[] {
  return [
    { id: "identity", label: "Your details", done: identityOk(operative) },
    { id: "company", label: "Company & tax", done: companyOk(operative) },
    { id: "contact", label: "Contact & address", done: phoneOk(operative) && addressOk(operative) },
    {
      id: "verification",
      label: isBusiness(operative) ? "Key personnel" : "Photo ID",
      done: verificationOk(operative, personnel),
    },
    { id: "coverage", label: "Service areas", done: areasOk(operative) },
    { id: "services", label: "Services & job prices", done: servicesOk(services) },
    { id: "bank", label: "UK bank details", done: bankOk(operative) },
    { id: "review", label: "Submit application", done: false },
  ];
}

export function isContractorOnboardingComplete(
  operative: OperativeOnboardingRow,
  services: OperativeServiceRow[],
  personnel: OperativePersonnelRow[],
): boolean {
  return validateContractorOnboarding(operative, services, personnel) === null;
}

export function validateContractorOnboarding(
  operative: OperativeOnboardingRow,
  services: OperativeServiceRow[],
  personnel: OperativePersonnelRow[],
): string | null {
  if (!identityOk(operative)) return "Add your first and last name and business type.";
  if (!companyOk(operative)) {
    return isBusiness(operative)
      ? "Add company/trading name and Companies House number."
      : "Add your business name and 10-digit UTR.";
  }
  if (!phoneOk(operative)) return "Add a UK phone number.";
  if (!addressOk(operative)) return "Add your business address.";
  if (!verificationOk(operative, personnel)) {
    return isBusiness(operative)
      ? "Add at least one director or key person for your company."
      : "Upload a photo of your ID (passport or driving licence).";
  }
  if (!areasOk(operative)) return "Add at least one service area.";
  if (services.length < 1) return "Add at least one service.";
  const missingPrice = services.find((s) => !s.default_price_pence || s.default_price_pence <= 0);
  if (missingPrice) return "Set a price per completed job for each service.";
  const missingContract = services.find((s) => !s.contract_content?.trim());
  if (missingContract) return "Add contract text for each service.";
  if (!bankOk(operative)) return "Add UK bank details for payouts.";
  return null;
}
