'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { GamificationData, LeaderboardEntry, UserModel } from '@/lib/types';
import {
  fetchGamification,
  recordActivity,
  recordAiScheduleUse,
  performCheckIn,
  awardFamilyBadge,
  familyLeaderboard,
} from '@/lib/services/gamification-service';

interface GamificationContextType {
  data: GamificationData | null;
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  lastNewBadgeId: string | null;
  load: (userId: string) => Promise<void>;
  recordActivity: (opts: {
    userId: string;
    activityTime: Date;
    weatherCondition?: string;
  }) => Promise<void>;
  recordAiScheduleUse: (userId: string) => Promise<void>;
  awardFamilyBadge: (userId: string) => Promise<void>;
  checkIn: (userId: string) => Promise<number | null>;
  loadLeaderboard: (members: UserModel[]) => Promise<void>;
  consumeNewBadge: () => void;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<GamificationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastNewBadgeId, setLastNewBadgeId] = useState<string | null>(null);

  function checkNewBadges(before: Set<string>, updated: GamificationData) {
    const newBadges = updated.earnedBadgeIds.filter((b) => !before.has(b));
    if (newBadges.length > 0) setLastNewBadgeId(newBadges[0]);
  }

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const d = await fetchGamification(userId);
      setData(d);
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRecordActivity = useCallback(
    async (opts: { userId: string; activityTime: Date; weatherCondition?: string }) => {
      const before = new Set<string>(data?.earnedBadgeIds ?? []);
      try {
        const updated = await recordActivity(opts);
        checkNewBadges(before, updated);
        setData(updated);
      } catch {
        // non-critical
      }
    },
    [data]
  );

  const handleRecordAi = useCallback(
    async (userId: string) => {
      const before = new Set<string>(data?.earnedBadgeIds ?? []);
      try {
        const updated = await recordAiScheduleUse(userId);
        checkNewBadges(before, updated);
        setData(updated);
      } catch {}
    },
    [data]
  );

  const handleAwardFamily = useCallback(
    async (userId: string) => {
      if (data?.earnedBadgeIds.includes('family_first')) return;
      const before = new Set<string>(data?.earnedBadgeIds ?? []);
      try {
        const updated = await awardFamilyBadge(userId);
        checkNewBadges(before, updated);
        setData(updated);
      } catch {}
    },
    [data]
  );

  const handleCheckIn = useCallback(
    async (userId: string): Promise<number | null> => {
      const before = new Set<string>(data?.earnedBadgeIds ?? []);
      try {
        const updated = await performCheckIn(userId);
        if (!updated) return null;
        checkNewBadges(before, updated);
        const xp = Math.min(Math.max(updated.checkInDay, 1), 7);
        setData(updated);
        return xp;
      } catch {
        return null;
      }
    },
    [data]
  );

  const handleLoadLeaderboard = useCallback(async (members: UserModel[]) => {
    try {
      const entries = await familyLeaderboard(members);
      setLeaderboard(entries);
    } catch {
      setLeaderboard([]);
    }
  }, []);

  const consumeNewBadge = useCallback(() => setLastNewBadgeId(null), []);

  return (
    <GamificationContext.Provider
      value={{
        data,
        leaderboard,
        loading,
        lastNewBadgeId,
        load,
        recordActivity: handleRecordActivity,
        recordAiScheduleUse: handleRecordAi,
        awardFamilyBadge: handleAwardFamily,
        checkIn: handleCheckIn,
        loadLeaderboard: handleLoadLeaderboard,
        consumeNewBadge,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error('useGamification must be used within GamificationProvider');
  return ctx;
}
