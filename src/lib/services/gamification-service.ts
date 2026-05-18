import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GamificationData, LeaderboardEntry, UserModel, getTier } from '@/lib/types';

const COLLECTION = 'gamification';

// XP Rewards matching Flutter GamificationService
const XP_REWARDS = {
  laundryActivity: 20,
  earlyWash: 15,
  aiScheduleUsed: 30,
  dailyStreakBonus: 10,
  streak7Bonus: 100,
  streak30Bonus: 500,
};

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function fetchGamification(userId: string): Promise<GamificationData> {
  const snap = await getDoc(doc(db, COLLECTION, userId));
  if (!snap.exists() || !snap.data()) {
    return {
      userId,
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      earnedBadgeIds: [],
      aiScheduleCount: 0,
      checkInDay: 0,
    };
  }
  const data = snap.data();
  return {
    userId: data.userId ?? userId,
    totalXp: data.totalXp ?? 0,
    currentStreak: data.currentStreak ?? 0,
    longestStreak: data.longestStreak ?? 0,
    lastActivityDate: data.lastActivityDate,
    earnedBadgeIds: data.earnedBadgeIds ?? [],
    aiScheduleCount: data.aiScheduleCount ?? 0,
    checkInDay: data.checkInDay ?? 0,
    lastCheckInDate: data.lastCheckInDate,
  };
}

async function saveGamification(data: GamificationData): Promise<void> {
  await setDoc(doc(db, COLLECTION, data.userId), data, { merge: true });
}

export async function recordActivity({
  userId,
  activityTime,
  weatherCondition,
}: {
  userId: string;
  activityTime: Date;
  weatherCondition?: string;
}): Promise<GamificationData> {
  const data = await fetchGamification(userId);
  let xpGained = XP_REWARDS.laundryActivity;
  const earned = new Set<string>(data.earnedBadgeIds);

  // Early riser
  if (activityTime.getHours() < 8) {
    xpGained += XP_REWARDS.earlyWash;
    earned.add('early_riser');
  }

  // Rain warrior
  if (weatherCondition) {
    const lc = weatherCondition.toLowerCase();
    if (lc.includes('rain') || lc.includes('drizzle') || lc.includes('shower')) {
      earned.add('rain_warrior');
    }
  }

  // Streak logic
  const today = dateOnly(activityTime);
  let streak = data.currentStreak;

  if (!data.lastActivityDate) {
    streak = 1;
  } else {
    const lastDay = dateOnly((data.lastActivityDate as Timestamp).toDate());
    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / 86400000);
    if (diffDays === 0) {
      // Same day — no streak update
    } else if (diffDays === 1) {
      streak += 1;
      xpGained += XP_REWARDS.dailyStreakBonus;
    } else {
      streak = 1;
    }
  }

  // Streak milestones
  if (streak === 7 && !earned.has('week_strong')) {
    xpGained += XP_REWARDS.streak7Bonus;
    earned.add('week_strong');
  }
  if (streak === 30 && !earned.has('month_master')) {
    xpGained += XP_REWARDS.streak30Bonus;
    earned.add('month_master');
  }
  if (streak >= 3) earned.add('streak_starter');

  // First wash
  earned.add('first_wash');

  const newXp = data.totalXp + xpGained;
  if (newXp >= 100) earned.add('centurion');
  if (newXp >= 1500) earned.add('legendary');

  const longest = Math.max(streak, data.longestStreak);

  const updated: GamificationData = {
    ...data,
    totalXp: newXp,
    currentStreak: streak,
    longestStreak: longest,
    lastActivityDate: Timestamp.fromDate(activityTime),
    earnedBadgeIds: Array.from(earned),
  };

  await saveGamification(updated);
  return updated;
}

export async function recordAiScheduleUse(userId: string): Promise<GamificationData> {
  const data = await fetchGamification(userId);
  const earned = new Set<string>(data.earnedBadgeIds);
  const newCount = data.aiScheduleCount + 1;
  const xpGained = XP_REWARDS.aiScheduleUsed;

  if (newCount >= 5) earned.add('ai_planner');

  const newXp = data.totalXp + xpGained;
  if (newXp >= 100) earned.add('centurion');
  if (newXp >= 1500) earned.add('legendary');

  const updated: GamificationData = {
    ...data,
    totalXp: newXp,
    earnedBadgeIds: Array.from(earned),
    aiScheduleCount: newCount,
  };

  await saveGamification(updated);
  return updated;
}

export async function performCheckIn(userId: string): Promise<GamificationData | null> {
  const data = await fetchGamification(userId);

  // Check if already checked in today
  if (data.lastCheckInDate) {
    const lastCheckIn = (data.lastCheckInDate as Timestamp).toDate();
    const now = new Date();
    if (
      lastCheckIn.getFullYear() === now.getFullYear() &&
      lastCheckIn.getMonth() === now.getMonth() &&
      lastCheckIn.getDate() === now.getDate()
    ) {
      return null; // already checked in
    }
  }

  const today = new Date();
  let nextDay: number;

  if (!data.lastCheckInDate) {
    nextDay = 1;
  } else {
    const lastDate = dateOnly((data.lastCheckInDate as Timestamp).toDate());
    const todayDate = dateOnly(today);
    const diff = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
    if (diff === 1) {
      nextDay = (data.checkInDay % 7) + 1;
    } else {
      nextDay = 1;
    }
  }

  const xpGained = Math.min(Math.max(nextDay, 1), 7);
  const newXp = data.totalXp + xpGained;
  const earned = new Set<string>(data.earnedBadgeIds);
  if (newXp >= 100) earned.add('centurion');
  if (newXp >= 1500) earned.add('legendary');

  const updated: GamificationData = {
    ...data,
    totalXp: newXp,
    earnedBadgeIds: Array.from(earned),
    lastCheckInDate: Timestamp.fromDate(today),
    checkInDay: nextDay,
  };

  await saveGamification(updated);
  return updated;
}

export async function awardFamilyBadge(userId: string): Promise<GamificationData> {
  const data = await fetchGamification(userId);
  if (data.earnedBadgeIds.includes('family_first')) return data;

  const earned = new Set<string>(data.earnedBadgeIds);
  earned.add('family_first');

  const updated: GamificationData = {
    ...data,
    earnedBadgeIds: Array.from(earned),
  };

  await saveGamification(updated);
  return updated;
}

export async function familyLeaderboard(members: UserModel[]): Promise<LeaderboardEntry[]> {
  const entries = await Promise.all(
    members.map(async (m) => {
      const d = await fetchGamification(m.uid);
      return {
        userId: m.uid,
        name: m.name,
        totalXp: d.totalXp,
        tier: getTier(d.totalXp),
        currentStreak: d.currentStreak,
      } as LeaderboardEntry;
    })
  );
  entries.sort((a, b) => b.totalXp - a.totalXp);
  return entries;
}

export function xpForDay(day: number): number {
  return Math.min(Math.max(day, 1), 7);
}
