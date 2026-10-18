'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShiftHandoversRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/shifts?tab=handovers');
  }, [router]);
  return null;
}
