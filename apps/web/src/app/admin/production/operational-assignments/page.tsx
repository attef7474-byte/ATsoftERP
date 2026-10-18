'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OperationalAssignmentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/shifts?tab=operational-assignments');
  }, [router]);
  return null;
}
