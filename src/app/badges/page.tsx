'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { GamificationData, ALL_BADGES, getTier, TIERS } from '@/lib/types';
import { Award, Flame, Zap, Star } from 'lucide-react';
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

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black">Achievements</h1>
          <p className="text-white/40 text-sm mt-0.5">Your badges & progress</p>
        </div>

        {/* Level card */}
        {!loading && gami && tier && (
          <div
            className="card relative overflow-hidden"
            style={{ borderColor: `${tier.color}40` }}
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: `radial-gradient(circle at 80% 50%, ${tier.color}, transparent 70%)` }}
            />
            <div className="relative flex items-center gap-4">
              <span className="text-5xl">{tier.emoji}</span>
              <div className="flex-1">
                <p className="font-black text-xl" style={{ color: tier.color }}>{tier.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-sm text-white/60">
                    <Zap size={14} className="text-yellow-400" /> {gami.totalXp} XP
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-white/60">
                    <Flame size={14} className="text-orange-400" /> {gami.currentStreak}d streak
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-white/60">
                    <Award size={14} className="text-purple-400" /> {gami.earnedBadgeIds.length} badges
                  </span>
                </div>
              </div>
            </div>
            {/* XP bar */}
            {(() => {
              const idx = TIERS.findIndex((t) => gami.totalXp < t.minXp) - 1;
              const curr = TIERS[Math.max(idx, 0)].minXp;
              const next = TIERS[idx + 1]?.minXp;
              const pct = next ? ((gami.totalXp - curr) / (next - curr)) * 100 : 100;
              return (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-white/30 mb-1">
                    <span>{curr} XP</span>
                    {next && <span>{next} XP</span>}
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: `linear-gradient(90deg, ${tier.color}aa, ${tier.color})`,
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {(['badges', 'tiers'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-5 py-2 rounded-full text-sm font-bold transition-all',
                tab === t ? 'bg-primary text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'
              )}
            >
              {t === 'badges' ? '🏅 Badges' : '🏆 Tier Progress'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />)}
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

function BadgesGrid({ earned }: { earned: string[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ALL_BADGES.map((badge) => {
        const isEarned = earned.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={clsx(
              'card py-4 px-4 transition-all',
              isEarned
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'opacity-40 grayscale'
            )}
          >
            <span className="text-3xl">{badge.emoji}</span>
            <p className="font-bold text-sm mt-2">{badge.title}</p>
            <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{badge.description}</p>
            {isEarned && (
              <span className="badge-chip text-yellow-300 bg-yellow-500/15 mt-2">
                <Star size={10} /> Earned
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TierProgress({ currentXp }: { currentXp: number }) {
  return (
    <div className="space-y-4">
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
              'card py-4 px-5 transition-all',
              isCurrent && 'border-yellow-500/30 bg-yellow-500/5',
              !isReached && 'opacity-40'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <p className="font-bold" style={{ color: isReached ? tier.color : undefined }}>
                    {tier.name}
                    {isCurrent && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 rounded-full px-2 py-0.5">Current</span>}
                  </p>
                  <p className="text-xs text-white/40">{tier.minXp} XP required</p>
                </div>
              </div>
              {isReached && <span className="text-green-400 text-lg">✓</span>}
            </div>
            {next && (
              <>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`,
                    }}
                  />
                </div>
                {isCurrent && (
                  <p className="text-xs text-white/30 mt-1.5">{next.minXp - currentXp} XP to {next.name}</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
