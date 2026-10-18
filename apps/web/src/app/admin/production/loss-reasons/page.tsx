'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RedirectPage(){
  const router=useRouter();
  useEffect(()=>{router.replace('/admin/production/downtime?tab=loss-reasons')},[router]);
  return null;
}
