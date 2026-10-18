'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShiftTemplatesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/shifts?tab=templates');
  }, [router]);
  return null;
}
