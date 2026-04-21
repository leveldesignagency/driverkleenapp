export type CleaningType = "domestic" | "commercial";

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerUnit: number;
  estimatedMinutes: number;
  categoryId: string;
  enabled: boolean;
}

export type RoomSize = "S" | "M" | "L";

export interface JobDetail {
  serviceId: string;
  size: RoomSize;
  quantity: number;
  complexity: "standard" | "deep";
  notes?: string;
}

export interface PriceEstimate {
  subtotal: number;
  minPrice: number;
  maxPrice: number;
  estimatedDuration: number;
  operativesRequired: number;
}

export interface JobFlowState {
  step: number;
  cleaningType: CleaningType | null;
  categoryId: string | null;
  serviceId: string | null;
  details: JobDetail[];
  address: string;
  postcode: string;
  preferredDate: string;
  preferredTime: string;
  estimate: PriceEstimate | null;
}

export interface Job {
  id: string;
  userId: string;
  status: "pending" | "quoted" | "accepted" | "in_progress" | "completed" | "disputed" | "cancelled";
  cleaningType: CleaningType;
  categoryId: string;
  serviceId: string;
  details: JobDetail[];
  address: string;
  postcode: string;
  preferredDate: string;
  preferredTime: string;
  estimate: PriceEstimate;
  finalPrice?: number;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethodType = "card" | "paypal" | "klarna";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  last4?: string;
  brand?: string;
  isDefault?: boolean;
  /** Stripe PaymentMethod id (pm_xxx) when saved via Stripe */
  stripePaymentMethodId?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  postcode?: string;
  avatarUrl?: string;
}

export const FORBIDDEN_SERVICES = [
  "Drainage",
  "Asbestos",
  "Roof access / height work",
  "Hazardous / Biohazard",
  "Crime scene cleanup",
  "Pest control",
] as const;
