'use client';

import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ROUTE_PERMISSION_MAP } from '@/context/FamilyPermissionsContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { ShieldOff, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, userModel, loading } = useAuth();
  const { canAccess, loading: permLoading } = useFamilyPermissions();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || permLoading) {
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

  // Permission check for Secondary users
  const routeKey = Object.keys(ROUTE_PERMISSION_MAP).find((r) => pathname.startsWith(r));
  const permissionKey = routeKey ? ROUTE_PERMISSION_MAP[routeKey] : undefined;
  const isRestricted = permissionKey && userModel?.role === 'Secondary' && !canAccess(permissionKey);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Content area — offset right on desktop, full width on mobile */}
      <div className="md:pl-60 flex flex-col min-h-screen">

        {/* Mobile-only top header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-white/[0.06] bg-[#080614]/90 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
            </div>
            <span className="text-sm font-black gradient-text">HydroHang</span>
          </div>

          {userModel && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/35 to-indigo-600/25 border border-violet-500/20 text-xs font-black text-white">
                {(userModel.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 pt-6 pb-28 md:pb-10 md:pt-8 max-w-5xl w-full mx-auto">
          {isRestricted ? (
            <AccessDenied />
          ) : (
            <div key={pathname} style={{ animation: 'fadeInUp 0.35s ease both' }}>
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation — hidden on desktop */}
      <BottomNav />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4" style={{ animation: 'scaleIn 0.4s ease both' }}>
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-3xl bg-red-500/15 blur-2xl scale-110" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/15 to-red-700/8 border border-red-500/25">
          <ShieldOff size={40} className="text-red-400" />
        </div>
      </div>

      <h2 className="text-2xl font-black mb-2">Access Restricted</h2>
      <p className="text-white/40 text-base font-medium mb-1 max-w-sm">
        Your family owner has restricted access to this module.
      </p>
      <p className="text-white/25 text-sm max-w-xs mb-8">
        Contact the Primary member of your family group to request access.
      </p>

      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-primary flex items-center gap-2 py-2.5 px-6">
          Back to Dashboard
        </Link>
        <Link href="/profile" className="btn-secondary flex items-center gap-2 py-2.5 px-5">
          <Lock size={14} /> Profile
        </Link>
      </div>

      <p className="text-white/15 text-xs mt-8 font-medium">
        Module access is managed by the Primary user in the Family Hub.
      </p>
    </div>
  );
}
