'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { LaundrySchedule, QueueModel, GamificationData, getTier } from '@/lib/types';
import { format } from 'date-fns';
import { CalendarDays, Layers, Zap, Flame, Award, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const { userModel } = useAuth();
  const [schedules, setSchedules] = useState<LaundrySchedule[]>([]);
  const [queue, setQueue] = useState<QueueModel[]>([]);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  useEffect(() => {
    if (!familyCode || !uid) return;

    // Upcoming schedules
    const fetchSchedules = async () => {
      try {
        const q = query(
          collection(db, 'laundry_schedules'),
          where('familyCode', '==', familyCode)
        );
        const snap = await getDocs(q);
        const pending = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as LaundrySchedule))
          .filter((s) => s.status === 'Pending')
          .sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis())
          .slice(0, 5);
        setSchedules(pending);
      } catch (error) {
        console.error('Failed to load schedules:', error);
        setSchedules([]);
      }
    };
    fetchSchedules();

    // Live queue
    const queueQuery = query(
      collection(db, 'washing_queue'),
      where('familyCode', '==', familyCode)
    );
    const unsubQueue = onSnapshot(
      queueQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as QueueModel))
          .filter((item) => ['active', 'waiting'].includes(item.status))
          .sort((a, b) => a.position - b.position);
        setQueue(items);
      },
      (error) => {
        console.error('Failed to load queue:', error);
        setQueue([]);
      }
    );

    // Gamification
    const fetchGami = async () => {
      const snap = await getDocs(
        query(collection(db, 'gamification'), where('userId', '==', uid))
      );
      if (!snap.empty) {
        setGamification(snap.docs[0].data() as GamificationData);
      }
      setLoading(false);
    };
    fetchGami();

    return () => unsubQueue();
  }, [familyCode, uid]);

  const tier = gamification ? getTier(gamification.totalXp) : null;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/50 text-sm font-semibold uppercase tracking-wider">{greeting}</p>
            <h1 className="text-3xl font-black mt-0.5">{userModel?.name ?? 'Loading…'}</h1>
          </div>
          {tier && (
            <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-2xl px-4 py-2.5">
              <span className="text-2xl">{tier.emoji}</span>
              <div>
                <p className="text-xs text-white/40 font-semibold">Tier</p>
                <p className="font-bold text-sm" style={{ color: tier.color }}>{tier.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Zap size={20} className="text-yellow-400" />}
            label="Total XP"
            value={gamification?.totalXp.toString() ?? '—'}
            color="yellow"
          />
          <StatCard
            icon={<Flame size={20} className="text-orange-400" />}
            label="Streak"
            value={gamification ? `${gamification.currentStreak}d` : '—'}
            color="orange"
          />
          <StatCard
            icon={<Award size={20} className="text-purple-400" />}
            label="Badges"
            value={gamification ? `${gamification.earnedBadgeIds.length}` : '—'}
            color="purple"
          />
          <StatCard
            icon={<Layers size={20} className="text-cyan-400" />}
            label="In Queue"
            value={queue.length.toString()}
            color="cyan"
          />
        </div>

        {/* XP Progress */}
        {gamification && tier && (
          <XpProgressCard gamification={gamification} tier={tier} />
        )}

        {/* Active queue & upcoming schedules */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Queue */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-cyan-400" />
              <h2 className="font-bold">Active Queue</h2>
              {queue.length > 0 && (
                <span className="ml-auto bg-cyan-500/20 text-cyan-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </div>
            {loading ? (
              <Skeleton rows={3} />
            ) : queue.length === 0 ? (
              <Empty label="No active queue entries" />
            ) : (
              <div className="space-y-3">
                {queue.map((q) => (
                  <QueueItem key={q.id} item={q} currentUid={uid} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming schedules */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={18} className="text-green-400" />
              <h2 className="font-bold">Upcoming Schedules</h2>
            </div>
            {loading ? (
              <Skeleton rows={3} />
            ) : schedules.length === 0 ? (
              <Empty label="No upcoming schedules" />
            ) : (
              <div className="space-y-3">
                {schedules.map((s) => (
                  <ScheduleItem key={s.id} schedule={s} currentUid={uid} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Family code */}
        {userModel?.familyCode && (
          <div className="card border-primary/30 bg-primary/5">
            <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1">
              Family Access Code
            </p>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-black tracking-[0.3em] text-primary-light">
                {userModel.familyCode}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(userModel.familyCode ?? '')}
                className="btn-secondary text-xs py-2 px-4"
              >
                Copy
              </button>
            </div>
            <p className="text-white/30 text-xs mt-2">Share this code with family members to join your group.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={clsx('card py-4 px-5', `border-${color}-500/20`)}>
      <div className="mb-3">{icon}</div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-white/40 text-xs font-semibold mt-0.5">{label}</p>
    </div>
  );
}

function XpProgressCard({
  gamification,
  tier,
}: {
  gamification: GamificationData;
  tier: ReturnType<typeof getTier>;
}) {
  const TIERS = [0, 200, 500, 1000, 1500];
  const idx = TIERS.findIndex((t) => gamification.totalXp < t) - 1;
  const current = TIERS[Math.max(idx, 0)];
  const next = TIERS[idx + 1];
  const progress = next ? ((gamification.totalXp - current) / (next - current)) * 100 : 100;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tier.emoji}</span>
          <p className="font-bold">{tier.name} Tier</p>
        </div>
        <p className="text-white/50 text-sm font-semibold">{gamification.totalXp} XP</p>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: `linear-gradient(90deg, #4F46E5, #7C3AED)`,
          }}
        />
      </div>
      {next && (
        <p className="text-white/30 text-xs mt-2">
          {next - gamification.totalXp} XP to next tier
        </p>
      )}
    </div>
  );
}

function QueueItem({ item, currentUid }: { item: QueueModel; currentUid: string }) {
  const isMe = item.userId === currentUid;
  const statusColor = item.status === 'active' ? 'text-green-400' : 'text-yellow-400';
  return (
    <div className={clsx('flex items-center gap-3 p-3 rounded-xl bg-white/5', isMe && 'border border-primary/30 bg-primary/5')}>
      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
        {item.position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.userName} {isMe && <span className="text-primary-light">(you)</span>}</p>
        <p className="text-xs text-white/40 truncate">{item.washingMachineName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={clsx('text-xs font-bold capitalize', statusColor)}>{item.status}</p>
        <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5">
          <Clock size={10} /> {item.durationMinutes}m
        </p>
      </div>
    </div>
  );
}

function ScheduleItem({ schedule, currentUid }: { schedule: LaundrySchedule; currentUid: string }) {
  const isMe = schedule.userId === currentUid;
  const date = schedule.scheduledDate.toDate();
  return (
    <div className={clsx('flex items-center gap-3 p-3 rounded-xl bg-white/5', isMe && 'border border-green-500/30 bg-green-500/5')}>
      <div className="shrink-0 text-center w-10">
        <p className="text-xs text-white/40 font-semibold">{format(date, 'MMM')}</p>
        <p className="text-lg font-black leading-none">{format(date, 'd')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{schedule.taskName || 'Laundry'}</p>
        <p className="text-xs text-white/40">{schedule.userName} · {schedule.timeSlot}</p>
      </div>
      <span className="badge-chip text-yellow-300 bg-yellow-500/10 shrink-0">{schedule.status}</span>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-white/30 text-sm text-center py-6">{label}</p>;
}
