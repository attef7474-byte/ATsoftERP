export const RESERVED_DETAIL_ROUTE_SLUGS = ['new'] as const;

export function isReservedDetailRouteId(id: string): boolean {
  return (RESERVED_DETAIL_ROUTE_SLUGS as readonly string[]).includes(id);
}