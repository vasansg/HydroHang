'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ROUTE_PERMISSION_MAP } from '@/context/FamilyPermissionsContext';
import {
  LayoutDashboard, CalendarDays, Layers, Cloud,
  Cpu, Users, Award, Bell, Settings, User, LogOut, Lock, Crown,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/schedules',      label: 'Schedules',      icon: CalendarDays },
      { href: '/queue',          label: 'Queue',          icon: Layers },
      { href: '/weather',        label: 'Weather',        icon: Cloud },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/manual-control', label: 'Manual Control', icon: Cpu },
      { href: '/family',         label: 'Family Hub',     icon: Users },
      { href: '/badges',         label: 'Achievements',   icon: Award },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/notifications',         label: 'Notifications',  icon: Bell },
      { href: '/notification-settings', label: 'Notif. Settings', icon: Settings },
      { href: '/profile',               label: 'Profile',        icon: User },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userModel, logout } = useAuth();
  const { canAccess } = useFamilyPermissions();
  const [unread, setUnread] = useState(0);

  const isSecondary = userModel?.role === 'Secondary';
  const initials = (userModel?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const uid = userModel?.uid;
    if (!uid) { setUnread(0); return; }
    return onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)),
      snap => setUnread(snap.size),
      () => setUnread(0)
    );
  }, [userModel?.uid]);

  function isLocked(href: string): boolean {
    if (!isSecondary) return false;
    if (href === '/family') return true;
    const key = ROUTE_PERMISSION_MAP[href];
    return key ? !canAccess(key) : false;
  }

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-white/[0.07] bg-[#060412]/98 backdrop-blur-xl z-40">

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06] shrink-0">
        <div className="relative shrink-0">
          <Image src="/logo.png" alt="HydroHang" width={32} height={32} className="rounded-xl" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight gradient-text">HydroHang</p>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/22">Laundry Manager</p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 scrollbar-none">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/20 px-3 mb-1.5">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                const locked = isLocked(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                      active
                        ? 'bg-gradient-to-r from-violet-600/90 to-indigo-600/80 text-white shadow-lg shadow-violet-500/15'
                        : locked
                        ? 'text-white/20 hover:bg-white/[0.03]'
                        : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'
                    )}
                  >
                    <Icon size={15} className={clsx('shrink-0', locked && 'opacity-40')} />
                    <span className={clsx('flex-1 truncate', locked && 'opacity-40')}>{itemLabel}</span>

                    {href === '/notifications' && unread > 0 && !locked && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                    {locked && <Lock size={10} className="text-white/20 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User area ── */}
      <div className="border-t border-white/[0.06] px-3 py-3 shrink-0 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/35 to-indigo-600/25 border border-violet-500/20 text-xs font-black text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{userModel?.name}</p>
            <div className="flex items-center gap-1">
              {isSecondary
                ? <User size={9} className="text-violet-300 shrink-0" />
                : <Crown size={9} className="text-yellow-400 shrink-0" />}
              <p className="text-[10px] text-white/30 font-semibold">{userModel?.role}</p>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/40 hover:bg-red-500/8 hover:text-red-400 border border-transparent hover:border-red-500/12 transition-all duration-150"
        >
          <LogOut size={14} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
