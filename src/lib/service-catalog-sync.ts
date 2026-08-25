import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_CATEGORIES } from "@/lib/services";

const CATEGORY_META: Record<string, { icon: string; displayOrder: number }> = {
  exterior: { icon: "Home", displayOrder: 1 },
  interior: { icon: "Sparkles", displayOrder: 2 },
  gutter: { icon: "CloudRain", displayOrder: 3 },
  kitchen: { icon: "ChefHat", displayOrder: 4 },
  eot: { icon: "Key", displayOrder: 5 },
  vehicle: { icon: "Car", displayOrder: 6 },
  garden: { icon: "TreePine", displayOrder: 7 },
  commercial: { icon: "Building2", displayOrder: 8 },
  waste: { icon: "Trash2", displayOrder: 9 },
};

/** Matches seed in supabase/migrations/001_full_schema.sql */
const OPERATIVE_LIMITS: Record<string, { min: number; max: number }> = {
  driveway: { min: 1, max: 2 },
  patio: { min: 1, max: 2 },
  decking: { min: 1, max: 2 },
  "wall-fence": { min: 1, max: 2 },
  "full-house": { min: 1, max: 3 },
  "room-clean": { min: 1, max: 1 },
  bathroom: { min: 1, max: 1 },
  "carpet-clean": { min: 1, max: 2 },
  "gutter-clear": { min: 1, max: 2 },
  "fascia-soffit": { min: 1, max: 2 },
  "oven-clean": { min: 1, max: 1 },
  "kitchen-deep": { min: 1, max: 2 },
  "eot-studio": { min: 1, max: 2 },
  "eot-2bed": { min: 2, max: 3 },
  "eot-4bed": { min: 2, max: 4 },
  "car-exterior": { min: 1, max: 1 },
  "car-interior": { min: 1, max: 1 },
  "car-full": { min: 1, max: 1 },
  "garden-tidy": { min: 1, max: 2 },
  "lawn-care": { min: 1, max: 1 },
  "office-clean": { min: 1, max: 3 },
  "retail-clean": { min: 1, max: 2 },
  "warehouse-clean": { min: 2, max: 6 },
  "general-waste": { min: 1, max: 2 },
  "garden-waste": { min: 1, max: 2 },
};

/**
 * Upsert the canonical Kleen catalogue so contractor "Add service" always has every service.
 * Safe to call on each catalog load — fixed seed data only.
 */
export async function ensureServiceCatalog(admin: SupabaseClient) {
  const categories = SERVICE_CATEGORIES.map((c) => {
    const meta = CATEGORY_META[c.id] ?? { icon: "Sparkles", displayOrder: 99 };
    return {
      id: c.id,
      name: c.name,
      slug: c.id,
      description: c.description,
      icon: meta.icon,
      display_order: meta.displayOrder,
      is_active: true,
    };
  });

  const { error: catErr } = await admin.from("service_categories").upsert(categories, { onConflict: "id" });
  if (catErr) throw new Error(catErr.message);

  const services = SERVICE_CATEGORIES.flatMap((c) =>
    c.services
      .filter((s) => s.enabled)
      .map((s) => {
        const limits = OPERATIVE_LIMITS[s.id] ?? { min: 1, max: 2 };
        return {
          id: s.id,
          category_id: s.categoryId,
          name: s.name,
          slug: s.id,
          description: s.description,
          base_price_pence: Math.round(s.basePrice * 100),
          price_per_unit_pence: Math.round(s.pricePerUnit * 100),
          estimated_duration_min: s.estimatedMinutes,
          min_operatives: limits.min,
          max_operatives: limits.max,
          is_active: true,
        };
      }),
  );

  const { error: svcErr } = await admin.from("services").upsert(services, { onConflict: "id" });
  if (svcErr) throw new Error(svcErr.message);
}
