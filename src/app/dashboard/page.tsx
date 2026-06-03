'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { LaundrySchedule, QueueModel, GamificationData, getTier, getTierProgress, xpToNextTier, TIERS } from '@/lib/types';
import { format } from 'date-fns';
import { CalendarDays, Layers, Zap, Flame, Award, Clock, TrendingUp, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const { userModel } = useAuth();
  const [schedules, setSchedules] = useState<LaundrySchedule[]>([]);
  const [queue, setQueue] = useState<QueueModel[]>([]);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  useEffect(() => {
    if (!familyCode || !uid) return;

    const fetchSchedules = async () => {
      try {
        const q = query(collection(db, 'laundry_schedules'), where('familyCode', '==', familyCode));
        const snap = await getDocs(q);
        const pending = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as LaundrySchedule))
          .filter((s) => s.status === 'Pending')
          .sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis())
          .slice(0, 5);
        setSchedules(pending);
      } catch { setSchedules([]); }
    };
    fetchSchedules();

    const queueQuery = query(collection(db, 'washing_queue'), where('familyCode', '==', familyCode));
    const unsubQueue = onSnapshot(
      queueQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as QueueModel))
          .filter((item) => ['active', 'waiting'].includes(item.status))
          .sort((a, b) => a.position - b.position);
        setQueue(items);
      },
      () => setQueue([])
    );

    const fetchGami = async () => {
      const snap = await getDocs(query(collection(db, 'gamification'), where('userId', '==', uid)));
      if (!snap.empty) setGamification(snap.docs[0].data() as GamificationData);
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

  const copyCode = () => {
    navigator.clipboard.writeText(familyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-7">

        {/* ── Hero header ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-purple-900/25 p-7 md:p-9">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-600/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-indigo-600/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300/60 mb-1.5">{greeting}</p>
              <h1 className="text-3xl md:text-4xl font-black leading-tight">
                {userModel?.name ?? 'Loading…'}
              </h1>
              <p className="text-white/35 text-sm mt-2 font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {tier && (
              <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 backdrop-blur-sm">
                <span className="text-3xl">{tier.emoji}</span>
                <div>
                  <p className="text-[10px] text-white/35 font-black uppercase tracking-wider">Tier</p>
                  <p className="font-black text-sm" style={{ color: tier.color }}>{tier.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PremiumStatCard
            icon={<Zap size={19} className="text-yellow-400" />}
            label="Total XP"
            value={loading ? '—' : (gamification?.totalXp.toLocaleString() ?? '0')}
            accent="#EAB308"
          />
          <PremiumStatCard
            icon={<Flame size={19} className="text-orange-400" />}
            label="Day Streak"
            value={loading ? '—' : `${gamification?.currentStreak ?? 0}d`}
            accent="#F97316"
          />
          <PremiumStatCard
            icon={<Award size={19} className="text-violet-400" />}
            label="Badges"
            value={loading ? '—' : `${gamification?.earnedBadgeIds.length ?? 0}`}
            accent="#8B5CF6"
          />
          <PremiumStatCard
            icon={<Layers size={19} className="text-cyan-400" />}
            label="In Queue"
            value={queue.length.toString()}
            accent="#06B6D4"
          />
        </div>

        {/* ── XP Progress ── */}
        {gamification && tier && (
          <XpProgressCard gamification={gamification} tier={tier} />
        )}

        {/* ── Active queue + upcoming schedules ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Queue */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/20">
                <Layers size={15} className="text-cyan-400" />
              </div>
              <h2 className="font-black">Active Queue</h2>
              {queue.length > 0 && (
                <span className="ml-auto bg-cyan-500/15 text-cyan-400 text-xs font-black px-2.5 py-1 rounded-full border border-cyan-500/20">
                  {queue.length}
                </span>
              )}
            </div>
            {loading ? <SkeletonRows rows={3} /> : queue.length === 0 ? <EmptyState label="No active queue entries" /> : (
              <div className="space-y-2.5">
                {queue.map((q) => <QueueItem key={q.id} item={q} currentUid={uid} />)}
              </div>
            )}
          </div>

          {/* Upcoming schedules */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                <CalendarDays size={15} className="text-emerald-400" />
              </div>
              <h2 className="font-black">Upcoming Schedules</h2>
            </div>
            {loading ? <SkeletonRows rows={3} /> : schedules.length === 0 ? <EmptyState label="No upcoming schedules" /> : (
              <div className="space-y-2.5">
                {schedules.map((s) => <ScheduleItem key={s.id} schedule={s} currentUid={uid} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── Family code ── */}
        {familyCode && (
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-900/25 to-indigo-900/15 p-6">
            <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl" />
            <div className="relative flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-2">Family Access Code</p>
                <div className="flex items-center gap-1.5">
                  {familyCode.split('').map((char, i) => (
                    <span
                      key={i}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-xl bg-white/[0.07] border border-white/[0.1] text-xl font-black gradient-text"
                    >
                      {char}
                    </span>
                  ))}
                </div>
                <p className="text-white/25 text-xs mt-2 font-medium">Share with family members to join your group</p>
              </div>
              <button
                onClick={copyCode}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95',
                  copied
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25'
                )}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Premium Stat Card ─────────────────────────────────────────────────────────

function PremiumStatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-sm"
      style={{ borderColor: `${accent}25` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(ellipse at top left, ${accent}10, transparent 70%)` }}
      />
      <div className="mb-3.5">{icon}</div>
      <p className="text-2xl font-black leading-none mb-1">{value}</p>
      <p className="text-white/35 text-xs font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ── XP Progress Card ──────────────────────────────────────────────────────────

function XpProgressCard({ gamification, tier }: { gamification: GamificationData; tier: ReturnType<typeof getTier> }) {
  const progress = getTierProgress(gamification.totalXp) * 100;
  const toNext = xpToNextTier(gamification.totalXp);
  const tierIndex = TIERS.findIndex(t => t.name === tier.name);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{tier.emoji}</span>
          <div>
            <p className="font-black text-base" style={{ color: tier.color }}>{tier.name} Tier</p>
            <p className="text-white/35 text-xs font-semibold">{gamification.totalXp.toLocaleString()} XP total</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-violet-400" />
          <span className="text-xs font-black text-violet-300">
            {toNext > 0 ? `${toNext} XP to next tier` : 'Max tier!'}
          </span>
        </div>
      </div>

      {/* Tier track */}
      <div className="flex items-center gap-1.5 mb-3">
        {TIERS.map((t, i) => (
          <div
            key={t.name}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1',
              i <= tierIndex ? 'opacity-100' : 'opacity-30'
            )}
          >
            <div
              className="h-1.5 w-full rounded-full"
              style={{ background: i <= tierIndex ? `linear-gradient(90deg, ${t.color}, ${t.color}80)` : 'rgba(255,255,255,0.1)' }}
            />
            <span className="text-[9px] text-white/30 font-bold hidden sm:block">{t.emoji}</span>
          </div>
        ))}
      </div>

      {/* XP Bar */}
      <div className="h-3 bg-white/[0.07] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: `linear-gradient(90deg, ${tier.color}, ${tier.color}99)`,
            boxShadow: `0 0 10px ${tier.color}50`,
          }}
        />
      </div>
    </div>
  );
}

// ── Queue Item ────────────────────────────────────────────────────────────────

function QueueItem({ item, currentUid }: { item: QueueModel; currentUid: string }) {
  const isMe = item.userId === currentUid;
  const isActive = item.status === 'active';
  return (
    <div className={clsx(
      'flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
      isMe
        ? 'bg-violet-500/[0.08] border-violet-500/20'
        : 'bg-white/[0.03] border-white/[0.06]'
    )}>
      <div className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black border',
        isActive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
      )}>
        {item.position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">
          {item.userName}
          {isMe && <span className="ml-1.5 text-[10px] font-black text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full">YOU</span>}
        </p>
        <p className="text-xs text-white/35 truncate">{item.washingMachineName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={clsx('text-xs font-black capitalize', isActive ? 'text-emerald-400' : 'text-amber-400')}>{item.status}</p>
        <p className="text-[10px] text-white/25 flex items-center gap-1 mt-0.5 justify-end">
          <Clock size={9} /> {item.durationMinutes}m
        </p>
      </div>
    </div>
  );
}

// ── Schedule Item ─────────────────────────────────────────────────────────────

function ScheduleItem({ schedule, currentUid }: { schedule: LaundrySchedule; currentUid: string }) {
  const isMe = schedule.userId === currentUid;
  const date = schedule.scheduledDate.toDate();
  return (
    <div className={clsx(
      'flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
      isMe
        ? 'bg-emerald-500/[0.06] border-emerald-500/20'
        : 'bg-white/[0.03] border-white/[0.06]'
    )}>
      <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08]">
        <p className="text-[10px] text-white/35 font-bold uppercase leading-none">{format(date, 'MMM')}</p>
        <p className="text-xl font-black leading-tight">{format(date, 'd')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{schedule.taskName || 'Laundry'}</p>
        <p className="text-xs text-white/35">{schedule.userName} · {schedule.timeSlot}</p>
      </div>
      <span className="badge-warning shrink-0 text-[10px]">{schedule.status}</span>
    </div>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-white/[0.04] rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-white/25 text-sm text-center py-8 font-medium">{label}</p>;
}
