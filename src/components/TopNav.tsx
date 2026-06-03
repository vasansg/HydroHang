'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Layers,
  Award,
  User,
  LogOut,
  WashingMachine,
  Bell,
  Cloud,
  Cpu,
  Settings,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/schedules',             label: 'Schedules',    icon: CalendarDays },
  { href: '/queue',                 label: 'Queue',        icon: Layers },
  { href: '/weather',               label: 'Weather',      icon: Cloud },
  { href: '/manual-control',        label: 'Control',      icon: Cpu },
  { href: '/family',                label: 'Family',       icon: Users },
  { href: '/badges',                label: 'Badges',       icon: Award },
  { href: '/notifications',         label: 'Alerts',       icon: Bell },
  { href: '/notification-settings', label: 'Notif.',       icon: Settings },
  { href: '/profile',               label: 'Profile',      icon: User },
];

export default function TopNav() {
  const pathname = usePathname();
  const { userModel, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const uid = userModel?.uid;
    if (!uid) {
      setUnread(0);
      return;
    }

    return onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)),
      (snap) => setUnread(snap.size),
      () => setUnread(0)
    );
  }, [userModel?.uid]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
              <WashingMachine size={19} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-black tracking-tight">HydroHang</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Laundry Manager</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
                    active
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {label}
                  {href === '/notifications' && unread > 0 && (
                    <span className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            {userModel && (
              <div className="text-right">
                <p className="max-w-[170px] truncate text-sm font-bold leading-tight">{userModel.name}</p>
                <p className="max-w-[170px] truncate text-xs text-white/45">{userModel.email}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 transition-all hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>

        <nav className="-mx-1 overflow-x-auto px-1 pb-3 md:hidden">
          <div className="inline-flex min-w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                    active
                      ? 'bg-primary text-white'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={14} />
                  {label}
                  {href === '/notifications' && unread > 0 && (
                    <span className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
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
