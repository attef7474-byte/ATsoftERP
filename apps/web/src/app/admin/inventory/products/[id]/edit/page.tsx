'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Legacy full-page edit route. Product edit is now the canonical modal on the
 * Products list, loaded for the SAME record id; this route only deep-links the
 * list into edit mode for that record and never creates a new record.
 */
export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  useEffect(() => {
    if (id) router.replace(`/admin/inventory/products?edit=${id}`);
  }, [router, id]);
  return null;
}
