'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { AppNotification } from '@/lib/types';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Bell,
  Trash2,
  CheckCheck,
  Cloud,
  Users,
  Calendar,
  Settings,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  switch (type) {
    case 'Rain':     return <Cloud size={15} className="text-sky-400" />;
    case 'Queue':    return <Users size={15} className="text-indigo-400" />;
    case 'Schedule': return <Calendar size={15} className="text-violet-400" />;
    default:         return <Settings size={15} className="text-white/40" />;
  }
}

function typeBg(type: string): string {
  switch (type) {
    case 'Rain':     return 'bg-sky-500/15 border-sky-500/20';
    case 'Queue':    return 'bg-indigo-500/15 border-indigo-500/20';
    case 'Schedule': return 'bg-violet-500/15 border-violet-500/20';
    default:         return 'bg-white/5 border-white/10';
  }
}

function toSafeDate(ts: AppNotification['timestamp'] | undefined): Date | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  return ts.toDate();
}

function formatTs(ts: AppNotification['timestamp']): string {
  const d = toSafeDate(ts);
  if (!d) return 'Unknown time';
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM · h:mm a');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { userModel, loading: authLoading } = useAuth();
  const uid = userModel?.uid ?? '';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // Real-time listener
  useEffect(() => {
    if (authLoading) return;

    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const orderedQuery = query(notificationsRef, orderBy('timestamp', 'desc'));

    let unsubFallback: (() => void) | undefined;

    const unsubPrimary = onSnapshot(
      orderedQuery,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
        );
        setLoading(false);
      },
      (snapshotError: { code?: string; message?: string }) => {
        if (snapshotError.code === 'failed-precondition') {
          // Fallback avoids index dependency and sorts in-memory.
          unsubFallback = onSnapshot(
            notificationsRef,
            (snap) => {
              const mapped = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              } as AppNotification));
              mapped.sort((a, b) => {
                const aMs = toSafeDate(a.timestamp)?.getTime() ?? 0;
                const bMs = toSafeDate(b.timestamp)?.getTime() ?? 0;
                return bMs - aMs;
              });
              setNotifications(mapped);
              setError('Notifications loaded with fallback sorting. Add Firestore index for best performance.');
              setLoading(false);
            },
            (fallbackError: { code?: string; message?: string }) => {
              if (fallbackError.code === 'permission-denied') {
                setError('Access denied. Please check Firestore rules for notifications.');
              } else {
                setError(fallbackError.message ?? 'Failed to load notifications.');
              }
              setLoading(false);
            }
          );
          return;
        }

        if (snapshotError.code === 'permission-denied') {
          setError('Access denied. Please check Firestore rules for notifications.');
        } else {
          setError(snapshotError.message ?? 'Failed to load notifications.');
        }
        setLoading(false);
      }
    );

    return () => {
      unsubPrimary();
      if (unsubFallback) unsubFallback();
    };
  }, [uid, authLoading]);

  const markAsRead = async (id: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { isRead: true });
  };

  const deleteNotification = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'notifications', id));
  };

  const markAllRead = async () => {
    if (!uid) return;
    setMarkingAll(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users', uid, 'notifications'),
          where('isRead', '==', false)
        )
      );
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Group by date
  const groups: Record<string, AppNotification[]> = {};
  notifications.forEach((n) => {
    const d = toSafeDate(n.timestamp);
    const key = !d
      ? 'Unknown date'
      : isToday(d)
      ? 'Today'
      : isYesterday(d)
      ? 'Yesterday'
      : format(d, 'MMMM d, yyyy');
    (groups[key] ??= []).push(n);
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <Bell size={19} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Notifications</h1>
              <p className="text-white/40 text-xs mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors disabled:opacity-50"
            >
              {markingAll
                ? <Loader2 size={13} className="animate-spin" />
                : <CheckCheck size={13} />}
              Mark all read
            </button>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total',  value: notifications.length,  color: 'text-white' },
            { label: 'Unread', value: unreadCount,            color: 'text-indigo-400' },
            { label: 'Read',   value: notifications.length - unreadCount, color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface border border-white/8 rounded-2xl px-4 py-3 text-center">
              <p className={clsx('text-2xl font-black', color)}>{value}</p>
              <p className="text-[11px] text-white/40 font-bold mt-0.5 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <Bell size={28} className="text-white/20" />
            </div>
            <p className="font-bold text-white/40">No notifications yet</p>
            <p className="text-sm text-white/25">You&apos;ll see queue updates, reminders and alerts here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-2">
                {/* Date group header */}
                <p className="text-[11px] font-black text-white/30 uppercase tracking-[2px] px-1">{dateLabel}</p>

                {items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && markAsRead(n.id)}
                    className={clsx(
                      'rounded-2xl border px-4 py-3.5 transition-all cursor-pointer group',
                      n.isRead
                        ? 'bg-white/2 border-white/6 opacity-70'
                        : clsx('border', typeBg(n.type))
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div className={clsx(
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                        n.isRead ? 'bg-white/5' : (() => {
                          switch (n.type) {
                            case 'Rain':     return 'bg-sky-500/20';
                            case 'Queue':    return 'bg-indigo-500/20';
                            case 'Schedule': return 'bg-violet-500/20';
                            default:         return 'bg-white/8';
                          }
                        })()
                      )}>
                        {typeIcon(n.type)}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={clsx(
                            'font-bold text-sm leading-snug',
                            n.isRead ? 'text-white/50' : 'text-white'
                          )}>
                            {n.title}
                          </p>
                          {/* Unread dot */}
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className={clsx(
                          'text-sm mt-0.5 leading-relaxed',
                          n.isRead ? 'text-white/30' : 'text-white/60'
                        )}>
                          {n.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={clsx(
                            'text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide',
                            n.isRead
                              ? 'text-white/25 border-white/8 bg-white/3'
                              : (() => {
                                  switch (n.type) {
                                    case 'Rain':     return 'text-sky-400 border-sky-500/25 bg-sky-500/10';
                                    case 'Queue':    return 'text-indigo-400 border-indigo-500/25 bg-indigo-500/10';
                                    case 'Schedule': return 'text-violet-400 border-violet-500/25 bg-violet-500/10';
                                    default:         return 'text-white/40 border-white/10 bg-white/5';
                                  }
                                })()
                          )}>
                            {n.type}
                          </span>
                          <span className="text-[11px] text-white/25 font-semibold">
                            {formatTs(n.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        className="w-7 h-7 rounded-lg bg-transparent hover:bg-red-500/15 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
