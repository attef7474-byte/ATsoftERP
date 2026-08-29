import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LEGACY_CREATE_ROUTES = [
  /^\/admin\/inventory\/(adjustments|locations|movements|product-categories)\/new\/?$/,
  /^\/admin\/inventory\/warehouses\/new\/?$/,
  /^\/admin\/inventory\/counts\/history\/?$/,
  /^\/admin\/maintenance\/(downtime-logs|machine-categories|machine-components|machine-parts)\/new\/?$/,
  /^\/admin\/maintenance\/schedules\/new\/?$/,
  /^\/admin\/maintenance\/machine-documents\/new\/?$/,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!LEGACY_CREATE_ROUTES.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }
  return new NextResponse('Not Found', { status: 404 });
}

export const config = {
  matcher: [
    '/admin/inventory/adjustments/new',
    '/admin/inventory/locations/new',
    '/admin/inventory/movements/new',
    '/admin/inventory/product-categories/new',
    '/admin/inventory/warehouses/new',
    '/admin/inventory/counts/history',
    '/admin/maintenance/downtime-logs/new',
    '/admin/maintenance/machine-categories/new',
    '/admin/maintenance/machine-components/new',
    '/admin/maintenance/machine-parts/new',
    '/admin/maintenance/schedules/new',
    '/admin/maintenance/machine-documents/new',
  ],
};