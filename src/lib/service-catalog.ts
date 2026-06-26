import { SERVICE_CATEGORIES } from "@/lib/services";

export type CatalogService = { id: string; name: string };

/** Full Kleen catalogue from app config — always 24 services when all categories are enabled. */
export function getStaticServiceCatalog(): CatalogService[] {
  return SERVICE_CATEGORIES.flatMap((c) =>
    c.services.filter((s) => s.enabled).map((s) => ({ id: s.id, name: s.name })),
  );
}

export const EXPECTED_CATALOG_SIZE = getStaticServiceCatalog().length;

/** Static catalogue first; DB rows can override display names. */
export function mergeServiceCatalog(dbRows: CatalogService[] | null | undefined): CatalogService[] {
  const byId = new Map<string, CatalogService>();
  for (const s of getStaticServiceCatalog()) {
    byId.set(s.id, s);
  }
  for (const s of dbRows ?? []) {
    if (s?.id) byId.set(s.id, { id: s.id, name: s.name || byId.get(s.id)?.name || s.id });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
