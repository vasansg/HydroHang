'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ROUTE_PERMISSION_MAP } from '@/context/FamilyPermissionsContext';
import {
  LayoutDashboard, CalendarDays, Layers, Bell, MoreHorizontal,
  Cloud, Cpu, Users, Award, Settings, User, LogOut, Lock, Crown, X,
} from 'lucide-react';
import { clsx } from 'clsx';

// ── 4 primary tabs always visible in bottom bar ───────────────────────────────
const PRIMARY_TABS = [
  { href: '/dashboard',     label: 'Home',     icon: LayoutDashboard },
  { href: '/queue',         label: 'Queue',    icon: Layers },
  { href: '/schedules',     label: 'Schedule', icon: CalendarDays },
  { href: '/notifications', label: 'Alerts',   icon: Bell },
];

// ── Items shown in the "More" sheet ──────────────────────────────────────────
const MORE_ITEMS = [
  { href: '/weather',               label: 'Weather',        icon: Cloud },
  { href: '/manual-control',        label: 'Control',        icon: Cpu },
  { href: '/family',                label: 'Family Hub',     icon: Users },
  { href: '/badges',                label: 'Achievements',   icon: Award },
  { href: '/notification-settings', label: 'Notif. Settings', icon: Settings },
  { href: '/profile',               label: 'Profile',        icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { userModel, logout } = useAuth();
  const { canAccess } = useFamilyPermissions();
  const [unread, setUnread] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isSecondary = userModel?.role === 'Secondary';

  useEffect(() => {
    const uid = userModel?.uid;
    if (!uid) { setUnread(0); return; }
    return onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)),
      snap => setUnread(snap.size),
      () => setUnread(0)
    );
  }, [userModel?.uid]);

  // Close sheet when route changes
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  function isLocked(href: string): boolean {
    if (!isSecondary) return false;
    if (href === '/family') return true;
    const key = ROUTE_PERMISSION_MAP[href];
    return key ? !canAccess(key) : false;
  }

  // Determine if any "More" item is currently active (to highlight the More tab)
  const moreActive = MORE_ITEMS.some(({ href }) => pathname === href || pathname.startsWith(href + '/'));

  return (
    <>
      {/* ── Slide-up "More" sheet backdrop ── */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease both' }}
        />
      )}

      {/* ── More sheet ── */}
      <div
        className={clsx(
          'md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/[0.1] bg-[#0a0818]/98 backdrop-blur-2xl transition-transform duration-300 ease-out',
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Sheet header */}
          <div className="flex items-center justify-between mb-5">
            <p className="font-black text-base">More</p>
            <button
              onClick={() => setSheetOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* More items grid */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              const locked = isLocked(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border text-center transition-all duration-150 active:scale-95',
                    active
                      ? 'bg-gradient-to-b from-violet-600/30 to-indigo-600/20 border-violet-500/40 text-white'
                      : locked
                      ? 'bg-white/[0.03] border-white/[0.06] text-white/22'
                      : 'bg-white/[0.04] border-white/[0.07] text-white/60 hover:bg-white/[0.08] hover:text-white/90'
                  )}
                >
                  <Icon size={20} className={locked ? 'opacity-35' : ''} />
                  <span className={clsx('text-xs font-bold leading-tight', locked && 'opacity-35')}>{label}</span>
                  {locked && (
                    <Lock size={9} className="absolute top-2 right-2 text-white/22" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/35 to-indigo-600/25 border border-violet-500/20 text-xs font-black text-white">
              {(userModel?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{userModel?.name}</p>
              <div className="flex items-center gap-1">
                {userModel?.role === 'Primary'
                  ? <Crown size={10} className="text-yellow-400" />
                  : <User size={10} className="text-violet-300" />}
                <p className="text-[10px] text-white/35 font-semibold">{userModel?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/18 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/18 transition-all active:scale-95 shrink-0"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>

        {/* Bottom safe area padding */}
        <div className="h-safe-bottom pb-2" />
      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#080614]/95 backdrop-blur-2xl">
        <div className="flex items-center justify-around px-2 py-1 pb-safe">
          {/* Primary tabs */}
          {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            const isAlerts = href === '/notifications';
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-0 flex-1 transition-all duration-150 active:scale-90',
                  active ? 'text-violet-400' : 'text-white/35 hover:text-white/60'
                )}
              >
                <div className="relative">
                  <div className={clsx(
                    'flex items-center justify-center rounded-xl w-10 h-8 transition-all duration-150',
                    active ? 'bg-violet-500/20' : ''
                  )}>
                    <Icon size={18} />
                  </div>
                  {isAlerts && unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span className={clsx('text-[10px] font-bold truncate', active && 'text-violet-400')}>{label}</span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setSheetOpen(true)}
            className={clsx(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-0 flex-1 transition-all duration-150 active:scale-90',
              moreActive || sheetOpen ? 'text-violet-400' : 'text-white/35'
            )}
          >
            <div className={clsx(
              'flex items-center justify-center rounded-xl w-10 h-8 transition-all duration-150',
              sheetOpen ? 'bg-violet-500/20' : ''
            )}>
              <MoreHorizontal size={18} />
            </div>
            <span className="text-[10px] font-bold">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
