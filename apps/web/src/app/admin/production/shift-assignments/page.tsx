'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShiftAssignmentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/shifts?tab=assignments');
  }, [router]);
  return null;
}
