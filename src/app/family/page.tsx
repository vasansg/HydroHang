'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useFamilyPermissions, ModulePermissions, DEFAULT_PERMISSIONS } from '@/context/FamilyPermissionsContext';
import {
  UserModel, GamificationData, getTier, getTierProgress,
} from '@/lib/types';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users, Crown, Copy, Check, Zap, Flame, Award,
  Shield, Trophy, Share2,
  CalendarDays, Layers, Cloud, Cpu, Bell, Settings,
  Loader2, Home,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface MemberWithStats {
  user: UserModel;
  gamification: GamificationData | null;
  rank: number;
}

// ─── Module definitions shown in the access-control grid ────────────────────

const MODULE_DEFS: {
  key: keyof ModulePermissions;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  { key: 'schedules',           label: 'Schedules',           description: 'Create & view laundry schedules', icon: <CalendarDays size={18} />, accent: '#10B981' },
  { key: 'queue',               label: 'Queue',               description: 'Join & manage washing queues',    icon: <Layers size={18} />,       accent: '#06B6D4' },
  { key: 'weather',             label: 'Weather',             description: 'View weather & drying forecasts', icon: <Cloud size={18} />,        accent: '#3B82F6' },
  { key: 'manualControl',       label: 'Manual Control',      description: 'View sensor readings & controls', icon: <Cpu size={18} />,          accent: '#8B5CF6' },
  { key: 'badges',              label: 'Badges',              description: 'View achievements & tier ranks',  icon: <Award size={18} />,        accent: '#F59E0B' },
  { key: 'notifications',       label: 'Notifications',       description: 'Receive & manage alerts',         icon: <Bell size={18} />,         accent: '#6366F1' },
  { key: 'notificationSettings',label: 'Notif. Settings',     description: 'Configure notification prefs',    icon: <Settings size={18} />,     accent: '#EC4899' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const { userModel } = useAuth();
  const { permissions, updatePermissions } = useFamilyPermissions();
  const [members, setMembers] = useState<UserModel[]>([]);
  const [gamificationMap, setGamificationMap] = useState<Map<string, GamificationData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Module access state (for Primary editor)
  const [localPerms, setLocalPerms] = useState<ModulePermissions>(DEFAULT_PERMISSIONS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedPerms, setSavedPerms] = useState(false);

  const familyCode = userModel?.familyCode ?? '';
  const isPrimary = userModel?.role === 'Primary';

  // Keep local editor in sync with live permissions
  useEffect(() => { setLocalPerms(permissions); }, [permissions]);

  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'users'), where('familyCode', '==', familyCode));
    const unsub = onSnapshot(q, async (snap) => {
      const users = snap.docs.map((d) => d.data() as UserModel);
      setMembers(users);

      const uids = users.map((u) => u.uid);
      const gamiMap = new Map<string, GamificationData>();
      for (let i = 0; i < uids.length; i += 10) {
        const chunk = uids.slice(i, i + 10);
        const gq = query(collection(db, 'gamification'), where('userId', 'in', chunk));
        const gSnap = await getDocs(gq);
        gSnap.docs.forEach((d) => { const g = d.data() as GamificationData; gamiMap.set(g.userId, g); });
      }
      setGamificationMap(gamiMap);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [familyCode]);

  const rankedMembers: MemberWithStats[] = [...members]
    .map((user) => ({ user, gamification: gamificationMap.get(user.uid) ?? null, rank: 0 }))
    .sort((a, b) => (b.gamification?.totalXp ?? 0) - (a.gamification?.totalXp ?? 0))
    .map((m, i) => ({ ...m, rank: i + 1 }));

  const totalXp = rankedMembers.reduce((s, m) => s + (m.gamification?.totalXp ?? 0), 0);
  const totalBadges = rankedMembers.reduce((s, m) => s + (m.gamification?.earnedBadgeIds.length ?? 0), 0);
  const activeStreaks = rankedMembers.filter((m) => (m.gamification?.currentStreak ?? 0) > 0).length;

  const copyCode = async () => {
    await navigator.clipboard.writeText(familyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join my HydroHang family', text: `Use code ${familyCode} to join my laundry family on HydroHang!` });
    } else { copyCode(); }
  };

  const handleSavePerms = async () => {
    setSavingPerms(true);
    await updatePermissions(localPerms);
    setSavingPerms(false);
    setSavedPerms(true);
    setTimeout(() => setSavedPerms(false), 2500);
  };

  // ── Secondary users: access denied ────────────────────────────────────────
  if (!isPrimary) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[62vh] text-center px-4" style={{ animation: 'scaleIn 0.4s ease both' }}>
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-3xl bg-violet-500/15 blur-2xl scale-110" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-600/8 border border-violet-500/20">
              <Crown size={40} className="text-yellow-400" />
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2">Primary Members Only</h2>
          <p className="text-white/40 text-base font-medium mb-1 max-w-sm">
            The Family Hub is exclusively for the Primary account holder.
          </p>
          <p className="text-white/25 text-sm max-w-xs mb-8">
            Only the owner who created the family group can view and manage family settings.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn-primary flex items-center gap-2 py-2.5 px-6">
              <Home size={15} /> Back to Dashboard
            </Link>
          </div>
          <p className="text-white/15 text-xs mt-8 font-medium">
            Your family code: <span className="text-white/30 font-black tracking-widest">{familyCode}</span>
          </p>
        </div>
      </AppShell>
    );
  }

  // ── Primary user view ──────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Hero ── */}
        <div className="family-hero relative overflow-hidden rounded-3xl border border-violet-500/20 p-8 md:p-10">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-600/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/40">
                  <Users size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300/60 mb-0.5">Family Hub · Primary</p>
                  <h1 className="text-4xl font-black family-gradient-text leading-none">Your Family</h1>
                </div>
              </div>
              <p className="text-white/45 text-sm font-medium">
                {loading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''} · You control module access below`}
              </p>
            </div>

            {familyCode && (
              <div className="shrink-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-2.5">Family Access Code</p>
                <div className="flex items-center gap-3 bg-white/5 border border-violet-500/25 rounded-2xl px-5 py-4 backdrop-blur-sm family-code-card">
                  <div className="flex gap-1">
                    {familyCode.split('').map((char, i) => (
                      <span key={i} className="family-code-char inline-flex h-9 w-8 items-center justify-center rounded-xl bg-white/8 border border-white/10 text-lg font-black tracking-wider family-gradient-text" style={{ animationDelay: `${i * 80}ms` }}>
                        {char}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 ml-1">
                    <button onClick={copyCode} className={clsx('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-95', copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/35')}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={shareCode} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold bg-white/8 text-white/50 border border-white/10 hover:bg-white/12 hover:text-white/80 transition-all duration-200">
                      <Share2 size={13} /> Share
                    </button>
                  </div>
                </div>
                <p className="text-white/22 text-[10px] font-semibold mt-2 pl-1">Share with family members to join your group</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users size={18} className="text-violet-400" />} label="Members" value={loading ? '—' : members.length.toString()} borderClass="border-violet-500/20" glowClass="from-violet-500/8" />
          <StatCard icon={<Zap size={18} className="text-yellow-400" />} label="Combined XP" value={loading ? '—' : totalXp.toLocaleString()} borderClass="border-yellow-500/20" glowClass="from-yellow-500/8" />
          <StatCard icon={<Flame size={18} className="text-orange-400" />} label="Active Streaks" value={loading ? '—' : activeStreaks.toString()} borderClass="border-orange-500/20" glowClass="from-orange-500/8" />
          <StatCard icon={<Award size={18} className="text-purple-400" />} label="Total Badges" value={loading ? '—' : totalBadges.toString()} borderClass="border-purple-500/20" glowClass="from-purple-500/8" />
        </div>

        {/* ── Module Access Control ── */}
        <div className="card border-violet-500/15">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20">
                <Shield size={18} className="text-violet-400" />
              </div>
              <div>
                <h2 className="font-black text-lg">Module Access Control</h2>
                <p className="text-white/35 text-xs font-medium mt-0.5">Toggle which features Secondary members can access</p>
              </div>
            </div>
            <button
              onClick={handleSavePerms}
              disabled={savingPerms || savedPerms}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
                savedPerms ? 'bg-emerald-600/80 text-white border border-emerald-500/30' : 'btn-primary'
              )}
            >
              {savingPerms ? <Loader2 size={15} className="animate-spin" /> : savedPerms ? <Check size={15} /> : <Shield size={15} />}
              {savedPerms ? 'Saved!' : savingPerms ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_DEFS.map(({ key, label, description, icon, accent }) => {
              const isOn = localPerms[key];
              return (
                <button
                  key={key}
                  onClick={() => setLocalPerms((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={clsx(
                    'group flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5',
                    isOn
                      ? 'border-opacity-40 bg-opacity-8'
                      : 'bg-white/[0.025] border-white/[0.06] opacity-70'
                  )}
                  style={isOn ? { borderColor: `${accent}40`, background: `${accent}08` } : undefined}
                >
                  {/* Module icon */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all"
                    style={{
                      background: isOn ? `${accent}18` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isOn ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
                      color: isOn ? accent : 'rgba(255,255,255,0.25)',
                    }}
                  >
                    {icon}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight mb-0.5">{label}</p>
                    <p className="text-white/30 text-[11px] font-medium leading-snug">{description}</p>
                  </div>

                  {/* Toggle */}
                  <div
                    className="relative shrink-0 w-11 h-6 rounded-full transition-all duration-300"
                    style={{
                      background: isOn ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : 'rgba(255,255,255,0.1)',
                      boxShadow: isOn ? `0 0 10px ${accent}40` : undefined,
                    }}
                  >
                    <div
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300"
                      style={{ transform: isOn ? 'translateX(22px)' : 'translateX(2px)' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <Shield size={13} className="text-white/25 shrink-0 mt-0.5" />
            <p className="text-white/25 text-xs font-medium leading-relaxed">
              Changes apply to all Secondary members in your family.{' '}
              <strong className="text-white/40">Primary users always retain full access</strong> regardless of these settings.
            </p>
          </div>
        </div>

        {/* ── Leaderboard ── */}
        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/20">
              <Trophy size={17} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight">Leaderboard</h2>
              <p className="text-white/35 text-xs font-semibold">Ranked by total XP earned</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)}</div>
          ) : rankedMembers.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No family members found</p>
          ) : (
            <>
              {rankedMembers.length >= 2 && (
                <div className="hidden md:flex items-end justify-center gap-3 pt-2 pb-4">
                  {rankedMembers[1] && <PodiumCard member={rankedMembers[1]} currentUid={userModel?.uid ?? ''} size="md" />}
                  {rankedMembers[0] && <PodiumCard member={rankedMembers[0]} currentUid={userModel?.uid ?? ''} size="lg" />}
                  {rankedMembers[2] && <PodiumCard member={rankedMembers[2]} currentUid={userModel?.uid ?? ''} size="sm" />}
                </div>
              )}
              <div className="space-y-2">
                {rankedMembers.map((m, idx) => (
                  <LeaderboardRow key={m.user.uid} member={m} currentUid={userModel?.uid ?? ''} delay={idx * 55} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Members Grid ── */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-black">All Members</h2>
            {!loading && <span className="bg-white/10 text-white/55 text-xs font-bold px-2.5 py-1 rounded-full">{members.length}</span>}
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-52 bg-surface border border-white/10 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rankedMembers.map((m, idx) => (
                <MemberCard key={m.user.uid} member={m} currentUid={userModel?.uid ?? ''} delay={idx * 70} permissions={permissions} />
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, borderClass, glowClass }: { icon: React.ReactNode; label: string; value: string; borderClass: string; glowClass: string }) {
  return (
    <div className={clsx('card py-4 px-5 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5', borderClass)}>
      <div className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300', glowClass)} />
      <div className="mb-3">{icon}</div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-white/40 text-xs font-semibold mt-0.5">{label}</p>
    </div>
  );
}

// ── PodiumCard ────────────────────────────────────────────────────────────────

type PodiumSize = 'lg' | 'md' | 'sm';

const PODIUM: Record<PodiumSize, { height: string; label: string; avatarClass: string; bgFrom: string; bgTo: string; border: string; shadow: string; textColor: string }> = {
  lg: { height: 'h-52', label: '1st', avatarClass: 'h-16 w-16 text-xl', bgFrom: 'from-yellow-500/20', bgTo: 'to-amber-600/5', border: 'border-yellow-500/35', shadow: 'shadow-yellow-500/15', textColor: 'text-yellow-400' },
  md: { height: 'h-44', label: '2nd', avatarClass: 'h-12 w-12 text-lg', bgFrom: 'from-slate-400/12', bgTo: 'to-slate-600/5', border: 'border-slate-400/25', shadow: 'shadow-slate-400/8', textColor: 'text-slate-300' },
  sm: { height: 'h-36', label: '3rd', avatarClass: 'h-11 w-11 text-base', bgFrom: 'from-amber-700/12', bgTo: 'to-amber-900/5', border: 'border-amber-700/25', shadow: 'shadow-amber-700/8', textColor: 'text-amber-500' },
};

function PodiumCard({ member, currentUid, size }: { member: MemberWithStats; currentUid: string; size: PodiumSize }) {
  const cfg = PODIUM[size];
  const tier = getTier(member.gamification?.totalXp ?? 0);
  const isMe = member.user.uid === currentUid;
  const initials = member.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const xp = member.gamification?.totalXp ?? 0;
  const medal = size === 'lg' ? '🥇' : size === 'md' ? '🥈' : '🥉';

  return (
    <div className={clsx('relative flex flex-col items-center justify-end w-36 pb-5 rounded-2xl border bg-gradient-to-b backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:scale-102 shadow-lg', cfg.height, cfg.bgFrom, cfg.bgTo, cfg.border, cfg.shadow, isMe && 'ring-2 ring-violet-500/50')}>
      {size === 'lg' && <Crown size={22} className={clsx('mb-2 animate-[float_3s_ease-in-out_infinite]', cfg.textColor)} />}
      {size !== 'lg' && <span className="text-xl mb-2">{medal}</span>}
      <div className={clsx('flex items-center justify-center rounded-2xl font-black text-white mb-2.5 shadow-lg', cfg.avatarClass)} style={{ background: `linear-gradient(135deg, ${tier.color}90, ${tier.color}50)`, border: `2px solid ${tier.color}60`, boxShadow: `0 0 18px ${tier.color}30` }}>
        {initials}
      </div>
      <p className="text-xs font-bold text-center truncate max-w-[112px] px-2 leading-tight mb-0.5">{member.user.name}{isMe && <span className="ml-1 text-[9px] text-violet-400">★</span>}</p>
      <p className={clsx('text-[10px] font-black', cfg.textColor)}>{medal} {cfg.label}</p>
      <p className="text-[10px] text-white/35 font-semibold mt-0.5">{xp.toLocaleString()} XP</p>
    </div>
  );
}

// ── LeaderboardRow ────────────────────────────────────────────────────────────

const RANK_BADGE: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-yellow-500/12', text: 'text-yellow-400', border: 'border-yellow-500/25' },
  2: { bg: 'bg-slate-400/12', text: 'text-slate-300', border: 'border-slate-400/25' },
  3: { bg: 'bg-amber-600/12', text: 'text-amber-500', border: 'border-amber-600/25' },
};

function LeaderboardRow({ member, currentUid, delay }: { member: MemberWithStats; currentUid: string; delay: number }) {
  const isMe = member.user.uid === currentUid;
  const tier = getTier(member.gamification?.totalXp ?? 0);
  const xp = member.gamification?.totalXp ?? 0;
  const streak = member.gamification?.currentStreak ?? 0;
  const progress = getTierProgress(xp) * 100;
  const rankStyle = RANK_BADGE[member.rank];
  const initials = member.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const medal = member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : null;

  return (
    <div className={clsx('group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 hover:bg-white/5', isMe ? 'bg-violet-500/10 border-violet-500/25' : 'bg-white/[0.025] border-white/[0.07]')} style={{ animation: `fadeInUp 0.4s ease ${delay}ms both` }}>
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black border', rankStyle ? `${rankStyle.bg} ${rankStyle.text} ${rankStyle.border}` : 'bg-white/5 text-white/35 border-white/10')}>
        {medal ?? member.rank}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm text-white" style={{ background: `linear-gradient(135deg, ${tier.color}55, ${tier.color}25)`, border: `1px solid ${tier.color}45` }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-sm font-bold truncate leading-none">{member.user.name}</p>
          {isMe && <span className="text-[9px] font-black text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded-full border border-violet-500/30 shrink-0">YOU</span>}
          {member.user.role === 'Primary' && <Crown size={11} className="text-yellow-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${tier.color}, ${tier.color}80)` }} />
          </div>
          <span className="text-[10px] text-white/30 font-semibold shrink-0">{tier.emoji} {tier.name}</span>
        </div>
      </div>
      <div className="hidden xs:flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-black text-yellow-400">{xp.toLocaleString()}</p>
          <p className="text-[10px] text-white/30 font-semibold">XP</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-xl px-2.5 py-1.5">
            <Flame size={12} className="text-orange-400" />
            <span className="text-xs font-bold text-orange-400">{streak}d</span>
          </div>
        )}
      </div>
      <div className="xs:hidden shrink-0">
        <p className="text-sm font-black text-yellow-400">{xp.toLocaleString()}</p>
        <p className="text-[10px] text-white/30 font-semibold">XP</p>
      </div>
    </div>
  );
}

// ── MemberCard ────────────────────────────────────────────────────────────────

function MemberCard({ member, currentUid, delay, permissions }: { member: MemberWithStats; currentUid: string; delay: number; permissions: ModulePermissions }) {
  const isMe = member.user.uid === currentUid;
  const isPrimary = member.user.role === 'Primary';
  const tier = getTier(member.gamification?.totalXp ?? 0);
  const xp = member.gamification?.totalXp ?? 0;
  const streak = member.gamification?.currentStreak ?? 0;
  const badges = member.gamification?.earnedBadgeIds.length ?? 0;
  const progress = getTierProgress(xp) * 100;
  const initials = member.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // Count how many modules this member can access
  const accessibleCount = isPrimary
    ? MODULE_DEFS.length
    : MODULE_DEFS.filter((m) => permissions[m.key]).length;

  return (
    <div
      className={clsx('group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl', isMe ? 'bg-gradient-to-br from-violet-900/55 to-indigo-900/35 border-violet-500/35 shadow-lg shadow-violet-500/10' : 'bg-surface/90 border-white/10 hover:border-white/18 shadow-xl shadow-black/15')}
      style={{ animation: `fadeInUp 0.4s ease ${delay}ms both` }}
    >
      {isMe && <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-violet-600/12 blur-2xl" />}

      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {isMe && <span className="text-[9px] font-black text-violet-400 bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 rounded-full">YOU</span>}
        {isPrimary && <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/15 border border-yellow-500/25 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown size={8} /> Owner</span>}
      </div>

      {/* Avatar */}
      <div className="flex items-start gap-3.5 mb-5">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl font-black text-lg text-white transition-transform duration-300 group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${tier.color}80, ${tier.color}40)`, border: `2px solid ${tier.color}55`, boxShadow: `0 0 22px ${tier.color}22` }}>
            {initials}
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface border border-white/20 text-xs shadow-lg">{tier.emoji}</div>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-black text-sm truncate leading-tight mb-1">{member.user.name}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: tier.color, background: `${tier.color}20`, border: `1px solid ${tier.color}35` }}>{tier.name}</span>
            <span className="text-[10px] text-white/30 font-semibold">#{member.rank}</span>
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-black text-yellow-400">{xp.toLocaleString()} XP</span>
          <span className="text-[10px] text-white/30 font-semibold">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${tier.color}, ${tier.color}70)`, boxShadow: `0 0 8px ${tier.color}50` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat icon={<Flame size={11} className="text-orange-400" />} value={`${streak}d`} label="Streak" />
        <MiniStat icon={<Award size={11} className="text-purple-400" />} value={badges.toString()} label="Badges" />
        <MiniStat
          icon={isPrimary ? <Crown size={11} className="text-yellow-400" /> : <Shield size={11} className="text-blue-400" />}
          value={isPrimary ? 'All' : `${accessibleCount}/${MODULE_DEFS.length}`}
          label={isPrimary ? 'Modules' : 'Access'}
          small
        />
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label, small = false }: { icon: React.ReactNode; value: string; label: string; small?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 p-2.5 rounded-xl bg-white/5 border border-white/8">
      {icon}
      <p className={clsx('font-black leading-none mt-0.5', small ? 'text-[9px]' : 'text-xs')}>{value}</p>
      <p className="text-[9px] text-white/30 font-semibold">{label}</p>
    </div>
  );
}
