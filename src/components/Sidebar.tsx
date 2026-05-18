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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',           icon: LayoutDashboard },
  { href: '/schedules',             label: 'Schedules',            icon: CalendarDays },
  { href: '/queue',                 label: 'Queue',                icon: Layers },
  { href: '/weather',               label: 'Weather',              icon: Cloud },
  { href: '/manual-control',        label: 'Manual Control',       icon: Cpu },
  { href: '/badges',                label: 'Badges',               icon: Award },
  { href: '/notifications',         label: 'Notifications',        icon: Bell },
  { href: '/notification-settings', label: 'Notif. Settings',      icon: Settings },
  { href: '/profile',               label: 'Profile',              icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userModel, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const uid = userModel?.uid;
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)),
      (snap) => setUnread(snap.size)
    );
    return unsub;
  }, [userModel?.uid]);

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-white/8 min-h-screen p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <WashingMachine size={20} className="text-white" />
        </div>
        <span className="font-black text-lg tracking-tight">HydroHang</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-white/50 hover:text-white hover:bg-white/8'
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {href === '/notifications' && unread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* User + logout */}
      {userModel && (
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-bold truncate">{userModel.name}</p>
            <p className="text-xs text-white/40 truncate">{userModel.email}</p>
            <span className="badge-chip mt-1.5">
              {userModel.role === 'Primary' ? '👑' : '👤'} {userModel.role}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
