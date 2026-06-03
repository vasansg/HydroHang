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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080614' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-violet-500/5 blur-lg" />
          </div>
          <p className="text-white/25 text-sm font-semibold tracking-wide">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-7 lg:px-6 lg:pt-9">
        <div
          key={pathname}
          className="relative"
          style={{ animation: 'fadeInUp 0.35s ease both' }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
