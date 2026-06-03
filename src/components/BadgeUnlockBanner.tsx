'use client';

import { useEffect, useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { ALL_BADGES } from '@/lib/types';
import { X } from 'lucide-react';

export default function BadgeUnlockBanner() {
  const { lastNewBadgeId, consumeNewBadge } = useGamification();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lastNewBadgeId) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(consumeNewBadge, 400);
      }, 3800);
      return () => clearTimeout(t);
    }
  }, [lastNewBadgeId, consumeNewBadge]);

  const badge = lastNewBadgeId ? ALL_BADGES.find(b => b.id === lastNewBadgeId) : null;
  if (!badge) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-[100] -translate-x-1/2"
      style={{ animation: visible ? 'badgeSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' : 'fadeOut 0.35s ease both' }}
    >
      <div className="relative flex items-center gap-4 rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-900/60 to-amber-900/50 px-5 py-4 shadow-2xl shadow-yellow-500/20 backdrop-blur-2xl">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-500/8 to-amber-500/8" />

        {/* Badge emoji */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 border border-yellow-500/25 text-2xl shadow-lg shadow-yellow-500/20">
          {badge.emoji}
        </div>

        {/* Text */}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-400/70 mb-0.5">Badge Unlocked!</p>
          <p className="font-black text-sm text-white leading-tight">{badge.title}</p>
          <p className="text-white/50 text-xs font-medium mt-0.5 leading-snug max-w-[240px]">{badge.description}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => { setVisible(false); setTimeout(consumeNewBadge, 300); }}
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/35 hover:bg-white/[0.12] hover:text-white transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
