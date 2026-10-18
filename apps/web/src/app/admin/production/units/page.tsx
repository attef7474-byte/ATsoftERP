'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Retired standalone Production Units screen.
 *
 * Production units are now maintained inside the unified Products workspace together with
 * product definitions, because both are the same daily master-data setup task. Keeping a
 * second screen would preserve exactly the competing-UI duplication this consolidation
 * removes.
 *
 * This route is preserved as a redirect so existing bookmarks and saved links keep working
 * instead of 404-ing. It deliberately renders no competing UI.
 */
export default function ProductionUnitsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/production/product-definitions?tab=units');
  }, [router]);

  return null;
}
