'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { GamificationData, ALL_BADGES, getTier, TIERS } from '@/lib/types';
import { Award, Flame, Zap, Star, Lock, Trophy } from 'lucide-react';
import { clsx } from 'clsx';

export default function BadgesPage() {
  const { userModel } = useAuth();
  const [gami, setGami] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'badges' | 'tiers'>('badges');

  const uid = userModel?.uid ?? '';

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'gamification'), where('userId', '==', uid)));
      if (!snap.empty) setGami(snap.docs[0].data() as GamificationData);
      setLoading(false);
    })();
  }, [uid]);

  const tier = gami ? getTier(gami.totalXp) : null;
  const earnedCount = gami?.earnedBadgeIds.length ?? 0;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-7">

        {/* ── Hero / Level card ── */}
        {!loading && gami && tier ? (
          <div
            className="relative overflow-hidden rounded-3xl border p-7 md:p-8"
            style={{ borderColor: `${tier.color}35`, background: `linear-gradient(135deg, ${tier.color}12, ${tier.color}05, rgba(15,6,20,0))` }}
          >
            <div
              className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl opacity-40"
              style={{ background: tier.color }}
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl opacity-20"
              style={{ background: tier.color }}
            />

            <div className="relative flex items-start gap-5 flex-wrap">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-4xl shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${tier.color}40, ${tier.color}20)`, border: `2px solid ${tier.color}50`, boxShadow: `0 0 30px ${tier.color}25` }}
              >
                {tier.emoji}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">Current Tier</p>
                <h1 className="text-3xl font-black" style={{ color: tier.color }}>{tier.name}</h1>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-sm text-white/50">
                    <Zap size={13} className="text-yellow-400" /> {gami.totalXp.toLocaleString()} XP
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-white/50">
                    <Flame size={13} className="text-orange-400" /> {gami.currentStreak}d streak
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-white/50">
                    <Award size={13} className="text-violet-400" /> {earnedCount}/{ALL_BADGES.length} badges
                  </span>
                </div>
              </div>
            </div>

            {/* XP bar */}
            {(() => {
              const idx = TIERS.findIndex((t) => gami.totalXp < t.minXp) - 1;
              const curr = TIERS[Math.max(idx, 0)].minXp;
              const next = TIERS[idx + 1]?.minXp;
              const pct = next ? Math.min(((gami.totalXp - curr) / (next - curr)) * 100, 100) : 100;
              return (
                <div className="mt-5">
                  <div className="flex justify-between text-[10px] text-white/25 font-bold mb-2 uppercase tracking-wider">
                    <span>{curr.toLocaleString()} XP</span>
                    {next && <span>{(next - gami.totalXp).toLocaleString()} XP to next tier</span>}
                    {next && <span>{next.toLocaleString()} XP</span>}
                  </div>
                  <div className="h-3 bg-white/[0.07] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tier.color}99, ${tier.color})`, boxShadow: `0 0 12px ${tier.color}50` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : loading ? (
          <div className="h-44 rounded-3xl bg-white/[0.04] animate-pulse border border-white/[0.06]" />
        ) : null}

        {/* ── Tabs ── */}
        <div className="flex gap-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl w-fit">
          {(['badges', 'tiers'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                tab === t
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-white/45 hover:text-white/70'
              )}
            >
              {t === 'badges' ? '🏅 Badges' : '🏆 Tier Progress'}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-32 bg-white/[0.04] rounded-2xl animate-pulse" />)}
          </div>
        ) : tab === 'badges' ? (
          <BadgesGrid earned={gami?.earnedBadgeIds ?? []} />
        ) : (
          <TierProgress currentXp={gami?.totalXp ?? 0} />
        )}
      </div>
    </AppShell>
  );
}

// ── Badges Grid ───────────────────────────────────────────────────────────────

function BadgesGrid({ earned }: { earned: string[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ALL_BADGES.map((badge, i) => {
        const isEarned = earned.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={clsx(
              'group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
              isEarned
                ? 'bg-gradient-to-br from-yellow-500/10 to-amber-600/5 border-yellow-500/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-yellow-500/10'
                : 'bg-white/[0.03] border-white/[0.06] opacity-45 grayscale'
            )}
            style={{ animation: `fadeInUp 0.4s ease ${i * 50}ms both` }}
          >
            {isEarned && (
              <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-yellow-500/10 blur-xl" />
            )}
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{badge.emoji}</span>
                {isEarned ? (
                  <span className="flex items-center gap-1 text-[10px] font-black text-yellow-400 bg-yellow-500/15 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                    <Star size={9} className="fill-yellow-400" /> Earned
                  </span>
                ) : (
                  <Lock size={13} className="text-white/20" />
                )}
              </div>
              <p className="font-black text-sm mb-1">{badge.title}</p>
              <p className="text-white/35 text-xs leading-relaxed">{badge.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tier Progress ─────────────────────────────────────────────────────────────

function TierProgress({ currentXp }: { currentXp: number }) {
  return (
    <div className="space-y-3">
      {TIERS.map((tier, idx) => {
        const next = TIERS[idx + 1];
        const isReached = currentXp >= tier.minXp;
        const isCurrent = isReached && (!next || currentXp < next.minXp);
        const pct = next
          ? Math.min(((currentXp - tier.minXp) / (next.minXp - tier.minXp)) * 100, 100)
          : 100;

        return (
          <div
            key={tier.name}
            className={clsx(
              'relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
              isCurrent
                ? 'border-opacity-40 shadow-lg'
                : isReached
                ? 'opacity-90'
                : 'opacity-35 grayscale'
            )}
            style={{
              animation: `fadeInUp 0.4s ease ${idx * 80}ms both`,
              borderColor: isCurrent ? `${tier.color}45` : isReached ? `${tier.color}20` : 'rgba(255,255,255,0.06)',
              background: isCurrent ? `linear-gradient(135deg, ${tier.color}12, ${tier.color}05)` : 'rgba(255,255,255,0.025)',
              boxShadow: isCurrent ? `0 8px 32px ${tier.color}12` : undefined,
            }}
          >
            {isCurrent && (
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-30" style={{ background: tier.color }} />
            )}
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <p className="font-black text-base" style={{ color: isReached ? tier.color : undefined }}>
                    {tier.name}
                    {isCurrent && (
                      <span className="ml-2 text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5 font-black">
                        CURRENT
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-white/30 font-semibold">{tier.minXp.toLocaleString()} XP required</p>
                </div>
              </div>
              {isReached && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20">
                  <Trophy size={13} className="text-emerald-400" />
                </div>
              )}
            </div>
            {next && (
              <>
                <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`, boxShadow: isCurrent ? `0 0 8px ${tier.color}50` : undefined }}
                  />
                </div>
                {isCurrent && (
                  <p className="text-[10px] text-white/30 font-semibold mt-2">
                    {(next.minXp - currentXp).toLocaleString()} XP to {next.name}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
