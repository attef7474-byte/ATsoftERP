'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, registerAutoLogout } from '../../lib/auth';
import { useAuth } from '../../lib/auth-context';
import { AdminShell } from '../../components/admin/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      router.replace('/login');
    }
  }, [loading, router]);

  useEffect(() => {
    if (!user) return;
    return registerAutoLogout();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
