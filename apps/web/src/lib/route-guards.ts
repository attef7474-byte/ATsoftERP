export const RESERVED_DETAIL_ROUTE_SLUGS = ['new'] as const;

export const MODULE_RESERVED_ROUTE_SLUGS: Record<string, readonly string[]> = {
  'inventory-counts': ['history'],
};

export function isReservedDetailRouteId(id: string): boolean {
  return (RESERVED_DETAIL_ROUTE_SLUGS as readonly string[]).includes(id);
}

export function isReservedDetailRouteIdFor(id: string, moduleKey: string): boolean {
  const moduleSlugs = MODULE_RESERVED_ROUTE_SLUGS[moduleKey] ?? [];
  return moduleSlugs.includes(id);
}