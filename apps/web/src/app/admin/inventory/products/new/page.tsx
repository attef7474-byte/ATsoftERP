'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy full-page create route. Product create/edit is now the canonical modal
 * on the Products list, so this route only deep-links the list into create mode.
 */
export default function CreateProductPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/inventory/products?create=1');
  }, [router]);
  return null;
}
