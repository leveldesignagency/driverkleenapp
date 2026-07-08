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
  submitted_for_review_at?: string | null;
};

export type OnboardingStepId =
  | "identity"
  | "contact"
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

function phoneOk(operative: OperativeOnboardingRow): boolean {
  const digits = String(operative.phone ?? "").replace(/\D/g, "");
  return digits.length >= 10;
}

function ukBusinessOk(operative: OperativeOnboardingRow): boolean {
  return !!(
    (operative.company_name && String(operative.company_name).trim()) ||
    (operative.trading_name && String(operative.trading_name).trim())
  );
}

function addressOk(operative: OperativeOnboardingRow): boolean {
  return !!(operative.registered_address && String(operative.registered_address).trim());
}

function areasOk(operative: OperativeOnboardingRow): boolean {
  return Array.isArray(operative.service_areas) && operative.service_areas.length > 0;
}

function bankOk(operative: OperativeOnboardingRow): boolean {
  const sortDigits = String(operative.bank_sort_code ?? "").replace(/\D/g, "");
  const acctDigits = String(operative.bank_account_number ?? "").replace(/\D/g, "");
  return (
    !!(operative.bank_account_name && String(operative.bank_account_name).trim()) &&
    sortDigits.length >= 6 &&
    acctDigits.length >= 8
  );
}

function identityOk(operative: OperativeOnboardingRow): boolean {
  const { firstName, lastName } = splitFullName(String(operative.full_name ?? ""));
  return !!(firstName.trim() && lastName.trim() && ukBusinessOk(operative));
}

export function getContractorOnboardingSteps(
  operative: OperativeOnboardingRow,
  serviceCount: number,
): OnboardingStep[] {
  return [
    { id: "identity", label: "Name & company", done: identityOk(operative) },
    { id: "contact", label: "Contact & address", done: phoneOk(operative) && addressOk(operative) },
    { id: "coverage", label: "Service areas", done: areasOk(operative) },
    { id: "services", label: "At least one service", done: serviceCount >= 1 },
    { id: "bank", label: "UK bank details", done: bankOk(operative) },
    { id: "review", label: "Send for review", done: false },
  ];
}

export function isContractorOnboardingComplete(
  operative: OperativeOnboardingRow,
  serviceCount: number,
): boolean {
  return validateContractorOnboarding(operative, serviceCount) === null;
}

export function validateContractorOnboarding(
  operative: OperativeOnboardingRow,
  serviceCount: number,
): string | null {
  const { firstName, lastName } = splitFullName(String(operative.full_name ?? ""));
  if (!firstName.trim() || !lastName.trim()) {
    return "Add your first and last name.";
  }
  if (!phoneOk(operative)) return "Add a UK phone number.";
  if (!ukBusinessOk(operative)) return "Add your company or trading name.";
  if (!addressOk(operative)) return "Add your business address.";
  if (!areasOk(operative)) return "Add at least one service area.";
  if (serviceCount < 1) return "Add at least one service with contract text.";
  if (!bankOk(operative)) {
    return "Add UK bank details for payouts.";
  }
  return null;
}
