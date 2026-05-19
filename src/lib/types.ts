import { Timestamp } from 'firebase/firestore';

// ─── Notification ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: Timestamp;
  type: 'Rain' | 'Queue' | 'Schedule' | 'System' | string;
  isRead: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  rainAlerts: boolean;
  queueAlerts: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface UserModel {
  uid: string;
  email: string;
  name: string;
  role: 'Primary' | 'Secondary';
  familyCode?: string;
  primaryUserId?: string;
  createdAt: Timestamp;
  notificationPreferences?: NotificationPreferences;
  isActive: boolean;
  fcmTokens?: string[];
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface LaundrySchedule {
  id: string;
  userId: string;
  userName: string;
  scheduledDate: Timestamp;
  timeSlot: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  taskName: string;
  weatherCondition: string;
  familyCode: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export interface QueueMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Timestamp;
}

export interface QueueModel {
  id: string;
  userId: string;
  userName: string;
  familyCode: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  durationMinutes: number;
  status: 'active' | 'waiting' | 'completed' | 'cancelled';
  position: number;
  washingMachineId: string;
  washingMachineName: string;
  pickupReminderSent?: boolean;
}

// ─── Washing Machine ──────────────────────────────────────────────────────────

export interface WashingMachine {
  id: string;
  name: string;
  familyCode: string;
  isActive?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  lastUsed?: Timestamp;
}

// ─── Dryer ────────────────────────────────────────────────────────────────────

export interface Dryer {
  id: string;
  name: string;
  familyCode: string;
}

export interface DryerQueueModel {
  id: string;
  userId: string;
  userName: string;
  familyCode: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  durationMinutes: number;
  status: 'active' | 'waiting' | 'completed' | 'cancelled';
  position: number;
  dryerId: string;
  dryerName: string;
  pickupReminderSent?: boolean;
}

// ─── Laundry Activity ─────────────────────────────────────────────────────────

export interface LaundryActivity {
  id: string;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  type: 'Automatic' | 'Manual';
  action: 'Retrieved' | 'Deployed' | 'Scheduled' | string;
  weatherCondition: string;
  temperature: number;
  familyCode: string;
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export interface GamificationData {
  userId: string;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: Timestamp;
  earnedBadgeIds: string[];
  aiScheduleCount: number;
  checkInDay: number;
  lastCheckInDate?: Timestamp;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const ALL_BADGES: BadgeDefinition[] = [
  { id: 'first_wash',      title: 'First Wash',      description: 'Complete your very first laundry activity.',  emoji: '🧺' },
  { id: 'early_riser',     title: 'Early Riser',      description: 'Start a wash before 8 AM.',                  emoji: '🌅' },
  { id: 'rain_warrior',    title: 'Rain Warrior',     description: 'Log a laundry activity during rainy weather.',emoji: '⛈️' },
  { id: 'streak_starter',  title: 'Streak Starter',   description: 'Maintain a 3-day activity streak.',           emoji: '🔥' },
  { id: 'week_strong',     title: 'Week Strong',      description: 'Maintain a 7-day activity streak.',           emoji: '💪' },
  { id: 'month_master',    title: 'Month Master',     description: 'Maintain a 30-day activity streak.',          emoji: '🏅' },
  { id: 'family_first',    title: 'Family First',     description: 'Be part of a family group.',                  emoji: '👨‍👩‍👧' },
  { id: 'ai_planner',      title: 'AI Planner',       description: 'Use smart scheduling 5 times.',               emoji: '🤖' },
  { id: 'centurion',       title: 'Centurion',        description: 'Reach 100 XP.',                               emoji: '⚡' },
  { id: 'legendary',       title: 'Legendary',        description: 'Reach 1,500 XP — Master tier.',              emoji: '🏆' },
];

// ─── Tier ─────────────────────────────────────────────────────────────────────

export interface Tier {
  name: string;
  emoji: string;
  minXp: number;
  maxXp: number; // -1 = no cap
  color: string;
}

export const TIERS: Tier[] = [
  { name: 'Rookie',     emoji: '🧺', minXp: 0,    maxXp: 99,   color: '#94a3b8' },
  { name: 'Regular',    emoji: '🫧', minXp: 100,  maxXp: 299,  color: '#60a5fa' },
  { name: 'Pro Washer', emoji: '⚡', minXp: 300,  maxXp: 699,  color: '#a78bfa' },
  { name: 'Expert',     emoji: '💎', minXp: 700,  maxXp: 1499, color: '#34d399' },
  { name: 'Master',     emoji: '🏆', minXp: 1500, maxXp: -1,   color: '#fbbf24' },
];

export function getTier(xp: number): Tier {
  return [...TIERS].reverse().find((t) => xp >= t.minXp) ?? TIERS[0];
}

export function getTierProgress(xp: number): number {
  const tier = getTier(xp);
  if (tier.maxXp === -1) return 1.0;
  const span = tier.maxXp - tier.minXp + 1;
  const gained = xp - tier.minXp;
  return Math.min(Math.max(gained / span, 0), 1);
}

export function xpToNextTier(xp: number): number {
  const tier = getTier(xp);
  if (tier.maxXp === -1) return 0;
  return tier.maxXp + 1 - xp;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  name: string;
  totalXp: number;
  tier: Tier;
  currentStreak: number;
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export interface WeatherData {
  cityName: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  timestamp: Date;
  isGoodForDrying: boolean;
}

export interface WeatherForecast {
  date: Date;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  precipitationProbability: number;
}

// ─── Rain Sensor ──────────────────────────────────────────────────────────────

export interface RainSensorData {
  value: number;
  condition: 'WET' | 'DRY' | 'UNKNOWN';
  servoPosition: number;
  timestamp: number;
}

// ─── Washing Machine Analytics ────────────────────────────────────────────────

export interface WashingMachineAnalytics {
  usageByWeekday: Record<number, number>;
  busiestWeekday: number;
  busiestHour: number;
  total: number;
}
