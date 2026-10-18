'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CapacityStandardsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/product-definitions?tab=capacity-standards');
  }, [router]);
  return null;
}
