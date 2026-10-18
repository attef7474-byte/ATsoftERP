'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShiftCalendarsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/production/shifts?tab=calendars');
  }, [router]);
  return null;
}
