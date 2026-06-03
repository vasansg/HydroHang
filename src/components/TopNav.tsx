'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, Layers, Award, User, LogOut,
  WashingMachine, Bell, Cloud, Cpu, Settings, Users, Lock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ROUTE_PERMISSION_MAP } from '@/context/FamilyPermissionsContext';

const NAV = [
  { href: '/dashboard',             label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schedules',             label: 'Schedules',  icon: CalendarDays },
  { href: '/queue',                 label: 'Queue',      icon: Layers },
  { href: '/weather',               label: 'Weather',    icon: Cloud },
  { href: '/manual-control',        label: 'Control',    icon: Cpu },
  { href: '/family',                label: 'Family',     icon: Users },
  { href: '/badges',                label: 'Badges',     icon: Award },
  { href: '/notifications',         label: 'Alerts',     icon: Bell },
  { href: '/notification-settings', label: 'Notif.',     icon: Settings },
  { href: '/profile',               label: 'Profile',    icon: User },
];

export default function TopNav() {
  const pathname = usePathname();
  const { userModel, logout } = useAuth();
  const { canAccess } = useFamilyPermissions();
  const [unread, setUnread] = useState(0);

  const isSecondary = userModel?.role === 'Secondary';

  useEffect(() => {
    const uid = userModel?.uid;
    if (!uid) { setUnread(0); return; }
    return onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)),
      (snap) => setUnread(snap.size),
      () => setUnread(0)
    );
  }, [userModel?.uid]);

  const initials = (userModel?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  function isLocked(href: string): boolean {
    if (!isSecondary) return false;
    if (href === '/family') return true; // always Primary-only
    const permKey = ROUTE_PERMISSION_MAP[href];
    if (!permKey) return false;
    return !canAccess(permKey);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080614]/80 backdrop-blur-2xl">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30 transition-transform duration-200 group-hover:scale-105">
              <WashingMachine size={18} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black tracking-tight gradient-text">HydroHang</p>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">Laundry Manager</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 md:flex overflow-x-auto">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              const locked = isLocked(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap',
                    active
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20'
                      : locked
                      ? 'text-white/20 cursor-pointer'
                      : 'text-white/45 hover:bg-white/[0.07] hover:text-white/80'
                  )}
                >
                  <Icon size={14} className={locked ? 'opacity-40' : ''} />
                  <span className={locked ? 'opacity-40' : ''}>{label}</span>
                  {locked && (
                    <Lock size={9} className="text-white/30 shrink-0" />
                  )}
                  {href === '/notifications' && unread > 0 && !locked && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop user area */}
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            {userModel && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/40 to-indigo-600/30 border border-violet-500/25 text-xs font-black">
                  {initials}
                </div>
                <div className="text-right">
                  <p className="max-w-[140px] truncate text-xs font-bold leading-tight">{userModel.name}</p>
                  <p className="max-w-[140px] truncate text-[10px] text-white/35 font-medium">{userModel.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/50 hover:border-red-500/25 hover:bg-red-500/8 hover:text-red-400 transition-all duration-200"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile scrollable nav */}
        <nav className="-mx-1 overflow-x-auto px-1 pb-2.5 md:hidden scrollbar-none">
          <div className="inline-flex min-w-full items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              const locked = isLocked(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'relative inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                      : locked
                      ? 'text-white/18'
                      : 'text-white/40 hover:bg-white/[0.07] hover:text-white/70'
                  )}
                >
                  <Icon size={12} className={locked ? 'opacity-35' : ''} />
                  <span className={locked ? 'opacity-35' : ''}>{label}</span>
                  {locked && <Lock size={8} className="text-white/25 shrink-0" />}
                  {href === '/notifications' && unread > 0 && !locked && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-black text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
