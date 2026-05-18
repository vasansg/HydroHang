'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, CalendarDays, Layers, Bell, User, Cloud, Cpu } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/dashboard',      label: 'Home',     icon: LayoutDashboard },
  { href: '/schedules',      label: 'Schedule', icon: CalendarDays },
  { href: '/queue',          label: 'Queue',    icon: Layers },
  { href: '/weather',        label: 'Weather',  icon: Cloud },
  { href: '/manual-control', label: 'Control',  icon: Cpu },
  { href: '/notifications',  label: 'Alerts',   icon: Bell },
  { href: '/profile',        label: 'Profile',  icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { userModel } = useAuth();
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-white/10 z-50">
      <div className="flex items-center justify-around py-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative',
              pathname === href || pathname.startsWith(href + '/') ? 'text-primary-light' : 'text-white/40'
            )}
          >
            <span className="relative">
              <Icon size={20} />
              {href === '/notifications' && unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
