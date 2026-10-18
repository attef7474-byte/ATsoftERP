'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RedirectPage(){
  const router=useRouter();
  useEffect(()=>{router.replace('/admin/production/quality/plans?tab=ncrs')},[router]);
  return null;
}
