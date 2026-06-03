'use client';

import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ROUTE_PERMISSION_MAP } from '@/context/FamilyPermissionsContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import TopNav from './TopNav';
import { Lock, ShieldOff } from 'lucide-react';
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

  // Determine if this route is restricted for Secondary users
  const routeKey = Object.keys(ROUTE_PERMISSION_MAP).find((r) => pathname.startsWith(r));
  const permissionKey = routeKey ? ROUTE_PERMISSION_MAP[routeKey] : undefined;
  const isRestricted = permissionKey && userModel?.role === 'Secondary' && !canAccess(permissionKey);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-7 lg:px-6 lg:pt-9">
        {isRestricted ? (
          <AccessDenied />
        ) : (
          <div key={pathname} className="relative" style={{ animation: 'fadeInUp 0.35s ease both' }}>
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" style={{ animation: 'scaleIn 0.4s ease both' }}>
      {/* Icon */}
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
        <Link
          href="/dashboard"
          className="btn-primary flex items-center gap-2 py-2.5 px-6"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/profile"
          className="btn-secondary flex items-center gap-2 py-2.5 px-5"
        >
          <Lock size={14} />
          Profile
        </Link>
      </div>

      <p className="text-white/15 text-xs mt-8 font-medium">
        Module access is managed by the Primary user in the Family Hub.
      </p>
    </div>
  );
}
