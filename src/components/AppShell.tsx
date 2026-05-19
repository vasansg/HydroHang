'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import TopNav from './TopNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-6 lg:px-6 lg:pt-8">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-28 bg-gradient-to-b from-white/5 to-transparent" />
        <div key={pathname} className="relative" style={{ animation: 'fadeInUp 0.4s ease both' }}>{children}</div>
      </main>
    </div>
  );
}
