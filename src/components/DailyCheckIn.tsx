'use client';

import { useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { xpForDay } from '@/lib/services/gamification-service';
import { Timestamp } from 'firebase/firestore';
import { Calendar, Check, Zap, Loader2, Flame } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Day state ────────────────────────────────────────────────────────────────

type DayState = 'completed' | 'today_pending' | 'future';

function getDayState(day: number, checkInDay: number, doneToday: boolean): DayState {
  if (doneToday) {
    return day <= checkInDay ? 'completed' : 'future';
  }
  const nextDay = (checkInDay % 7) + 1;
  if (day < nextDay) return 'completed';
  if (day === nextDay) return 'today_pending';
  return 'future';
}

function isCheckedInToday(ts?: Timestamp): boolean {
  if (!ts || typeof ts.toDate !== 'function') return false;
  const d = ts.toDate();
  const n = new Date();
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyCheckIn({ uid }: { uid: string }) {
  const { data, checkIn } = useGamification();
  const [loading, setLoading] = useState(false);
  const [xpFlash, setXpFlash] = useState<number | null>(null);

  const checkInDay = data?.checkInDay ?? 0;
  const doneToday = isCheckedInToday(data?.lastCheckInDate);
  const nextDay = (checkInDay % 7) + 1;
  const upcomingXp = xpForDay(nextDay);

  const handleCheckIn = async () => {
    if (loading || doneToday) return;
    setLoading(true);
    try {
      const xp = await checkIn(uid);
      if (xp !== null) {
        setXpFlash(xp);
        setTimeout(() => setXpFlash(null), 2800);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* ── Floating XP toast ── */}
      {xpFlash !== null && (
        <div
          key={xpFlash}
          className="pointer-events-none absolute -top-14 left-1/2 z-20"
          style={{ animation: 'checkInToast 2.8s ease both' }}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 shadow-2xl shadow-violet-500/30 whitespace-nowrap">
            <Zap size={15} className="text-yellow-300 shrink-0" />
            <span className="text-sm font-black text-white">+{xpFlash} XP earned!</span>
            <span className="text-lg">🎉</span>
          </div>
        </div>
      )}

      {/* ── Card ── */}
      <div
        className={clsx(
          'relative overflow-hidden rounded-2xl border p-5 transition-all duration-500',
          doneToday
            ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
            : 'border-violet-500/25 bg-gradient-to-br from-violet-900/25 to-indigo-900/10'
        )}
      >
        {/* Background glow */}
        <div
          className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl opacity-25 transition-all duration-500"
          style={{ background: doneToday ? '#10B981' : '#7C3AED' }}
        />

        {/* ── Header ── */}
        <div className="relative flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'flex h-9 w-9 items-center justify-center rounded-xl border',
              doneToday
                ? 'bg-emerald-500/15 border-emerald-500/20'
                : 'bg-violet-500/15 border-violet-500/20'
            )}>
              <Calendar size={15} className={doneToday ? 'text-emerald-400' : 'text-violet-400'} />
            </div>
            <div>
              <p className="font-black text-sm leading-tight">Daily Check-In</p>
              <p className="text-[10px] text-white/35 font-semibold">Earn XP every day · resets weekly</p>
            </div>
          </div>

          {doneToday && (
            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">
              <Check size={10} /> Done today
            </span>
          )}
          {!doneToday && (
            <span className="flex items-center gap-1 text-[10px] font-black text-violet-300 bg-violet-500/15 border border-violet-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <Zap size={10} className="text-yellow-300" /> +{upcomingXp} XP ready
            </span>
          )}
        </div>

        {/* ── 7-day grid ── */}
        <div className="relative grid grid-cols-7 gap-1.5 mb-5">
          {Array.from({ length: 7 }, (_, i) => i + 1).map(day => {
            const state = getDayState(day, checkInDay, doneToday);
            const dayXp = xpForDay(day);

            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={clsx(
                    'relative flex h-9 w-full max-w-[40px] items-center justify-center rounded-xl border text-xs font-black transition-all duration-300',
                    state === 'completed' && 'bg-emerald-500/20 border-emerald-500/35 text-emerald-400',
                    state === 'today_pending' && 'bg-violet-500/25 border-violet-500/50 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]',
                    state === 'future' && 'bg-white/[0.04] border-white/[0.07] text-white/22',
                  )}
                >
                  {state === 'completed'
                    ? <Check size={12} className="text-emerald-400" />
                    : <span>{day}</span>
                  }
                  {/* Pulsing ring on today's slot */}
                  {state === 'today_pending' && (
                    <span className="absolute inset-0 rounded-xl border-2 border-violet-400/50 animate-ping opacity-60" />
                  )}
                </div>
                <p className={clsx(
                  'text-[9px] font-bold',
                  state === 'completed' ? 'text-emerald-400/60' :
                  state === 'today_pending' ? 'text-violet-300' :
                  'text-white/18'
                )}>
                  +{dayXp}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Streak info ── */}
        {(data?.currentStreak ?? 0) > 0 && (
          <div className="relative flex items-center gap-2 bg-orange-500/8 border border-orange-500/15 rounded-xl px-3 py-2 mb-4">
            <Flame size={13} className="text-orange-400 shrink-0" />
            <p className="text-xs text-orange-300 font-semibold">
              {data!.currentStreak}-day activity streak
            </p>
          </div>
        )}

        {/* ── Button ── */}
        <button
          onClick={handleCheckIn}
          disabled={loading || doneToday}
          className={clsx(
            'relative w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all duration-200',
            doneToday
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed'
              : 'btn-primary active:scale-[0.98]'
          )}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : doneToday ? (
            <><Check size={15} /> Checked in today</>
          ) : (
            <><Zap size={15} className="text-yellow-300" /> Check In · +{upcomingXp} XP</>
          )}
        </button>
      </div>
    </div>
  );
}
