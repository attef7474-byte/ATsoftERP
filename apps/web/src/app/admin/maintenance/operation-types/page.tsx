'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * R4R — retired standalone Operation Types screen.
 *
 * Operation types are now maintained on the unified Machine Categories & Operation Types
 * page together with machine categories, because both are global factory master data
 * reviewed while classifying machines. Keeping a second screen would preserve exactly the
 * competing-UI duplication R4R removes, and the two could drift.
 *
 * This route is preserved as a redirect so existing bookmarks, saved links and any
 * external reference keep working instead of 404-ing. It intentionally renders no
 * competing UI: the unified page is the only implementation.
 */
export default function OperationTypesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/maintenance/machine-categories?tab=operation-types');
  }, [router]);

  return null;
}