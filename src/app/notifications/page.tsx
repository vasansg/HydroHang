'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot, updateDoc, deleteDoc,
  doc, writeBatch, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { AppNotification } from '@/lib/types';
import { format, isToday, isYesterday } from 'date-fns';
import { Bell, Trash2, CheckCheck, Cloud, Users, Calendar, Settings, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

function typeConfig(type: string) {
  switch (type) {
    case 'Rain':     return { icon: <Cloud size={15} />, color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/20', iconBg: 'bg-sky-500/15', accent: '#0EA5E9' };
    case 'Queue':    return { icon: <Users size={15} />, color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/20', iconBg: 'bg-indigo-500/15', accent: '#6366F1' };
    case 'Schedule': return { icon: <Calendar size={15} />, color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/20', iconBg: 'bg-violet-500/15', accent: '#8B5CF6' };
    default:         return { icon: <Settings size={15} />, color: 'text-white/40', bg: 'bg-white/5 border-white/8', iconBg: 'bg-white/8', accent: '#6B7280' };
  }
}

function toSafeDate(ts: AppNotification['timestamp'] | undefined): Date | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  return ts.toDate();
}

function formatTs(ts: AppNotification['timestamp']): string {
  const d = toSafeDate(ts);
  if (!d) return 'Unknown time';
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM · h:mm a');
}

export default function NotificationsPage() {
  const { userModel, loading: authLoading } = useAuth();
  const uid = userModel?.uid ?? '';
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!uid) { setNotifications([]); setLoading(false); return; }

    setLoading(true);
    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const orderedQuery = query(notificationsRef, orderBy('timestamp', 'desc'));
    let unsubFallback: (() => void) | undefined;

    const unsubPrimary = onSnapshot(
      orderedQuery,
      (snap) => { setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))); setLoading(false); },
      (err: { code?: string; message?: string }) => {
        if (err.code === 'failed-precondition') {
          unsubFallback = onSnapshot(notificationsRef, (snap) => {
            const mapped = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
            mapped.sort((a, b) => (toSafeDate(b.timestamp)?.getTime() ?? 0) - (toSafeDate(a.timestamp)?.getTime() ?? 0));
            setNotifications(mapped);
            setLoading(false);
          }, (fe: { message?: string }) => { setError(fe.message ?? 'Failed to load'); setLoading(false); });
          return;
        }
        setError(err.message ?? 'Failed to load notifications.');
        setLoading(false);
      }
    );
    return () => { unsubPrimary(); unsubFallback?.(); };
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
      const snap = await getDocs(query(collection(db, 'users', uid, 'notifications'), where('isRead', '==', false)));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    } finally { setMarkingAll(false); }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const groups: Record<string, AppNotification[]> = {};
  notifications.forEach((n) => {
    const d = toSafeDate(n.timestamp);
    const key = !d ? 'Unknown' : isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
    (groups[key] ??= []).push(n);
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20">
              <Bell size={20} className="text-indigo-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black">Notifications</h1>
              <p className="text-white/35 text-xs font-semibold mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up ✓'}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
              Mark all read
            </button>
          )}
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: notifications.length, colorClass: 'text-white' },
            { label: 'Unread', value: unreadCount, colorClass: 'text-indigo-400' },
            { label: 'Read', value: notifications.length - unreadCount, colorClass: 'text-emerald-400' },
          ].map(({ label, value, colorClass }) => (
            <div key={label} className="flex flex-col items-center py-4 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
              <p className={clsx('text-2xl font-black', colorClass)}>{value}</p>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300 font-medium">
            {error}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
            <p className="text-white/30 text-sm font-medium">Loading notifications…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-white/5 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.07]">
                <Bell size={30} className="text-white/15" />
              </div>
            </div>
            <p className="font-black text-white/30 text-lg">No notifications yet</p>
            <p className="text-sm text-white/20 font-medium">Queue updates, reminders and alerts will appear here</p>
          </div>
        ) : (
          <div className="space-y-7">
            {Object.entries(groups).map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-2">
                <p className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] px-1">{dateLabel}</p>
                {items.map((n, idx) => {
                  const cfg = typeConfig(n.type);
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && markAsRead(n.id)}
                      className={clsx(
                        'group relative overflow-hidden rounded-2xl border px-4 py-4 transition-all duration-200 cursor-pointer hover:bg-white/[0.03]',
                        n.isRead ? 'bg-white/[0.02] border-white/[0.06] opacity-60' : clsx('border', cfg.bg)
                      )}
                      style={{ animation: `fadeInUp 0.35s ease ${idx * 50}ms both` }}
                    >
                      {/* Left accent line */}
                      {!n.isRead && (
                        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: cfg.accent }} />
                      )}

                      <div className="flex items-start gap-3">
                        <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5', cfg.iconBg, cfg.color)}>
                          {cfg.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={clsx('font-bold text-sm leading-snug', n.isRead ? 'text-white/45' : 'text-white')}>
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <span className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ background: cfg.accent }} />
                            )}
                          </div>
                          <p className={clsx('text-sm mt-1 leading-relaxed', n.isRead ? 'text-white/25' : 'text-white/55')}>
                            {n.body}
                          </p>
                          <div className="flex items-center gap-2 mt-2.5">
                            <span
                              className={clsx('text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide', cfg.color)}
                              style={{ background: `${cfg.accent}15`, borderColor: `${cfg.accent}25` }}
                            >
                              {n.type}
                            </span>
                            <span className="text-[10px] text-white/22 font-semibold">{formatTs(n.timestamp)}</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="h-8 w-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/15 transition-all shrink-0"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
