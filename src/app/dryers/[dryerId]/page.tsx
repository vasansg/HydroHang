'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { DryerQueueModel, QueueMessage, Dryer } from '@/lib/types';
import { sendDryerQueueMessage } from '@/lib/services/dryer-queue-service';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Plus,
  Minus,
  Lightbulb,
  AlertCircle,
  Send,
  MessageSquare,
  BarChart2,
  Wind,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const DRYER_TIPS = [
  'Clean the lint filter before every cycle for best efficiency.',
  'Avoid overloading — clothes need room to tumble freely.',
  'Separate heavy items like towels from lighter fabrics.',
  'Use lower heat settings for delicate fabrics.',
  'Check care labels — some items should air-dry only.',
  'Keep the dryer vent clean to prevent fire hazards.',
  'Dry full loads to save energy, but don\'t overstuff.',
  'Remove clothes promptly to reduce wrinkles.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRemainingSeconds(item: DryerQueueModel): number {
  const startMs = item.startTime.toDate().getTime();
  const endMs = startMs + item.durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DryerDetailPage() {
  const params = useParams();
  const dryerId = params.dryerId as string;
  const { userModel } = useAuth();

  const [dryer, setDryer] = useState<Dryer | null>(null);
  const [dryerQueue, setDryerQueue] = useState<DryerQueueModel[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chat state
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showCustomMsg, setShowCustomMsg] = useState(false);
  const [customMsgText, setCustomMsgText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Analytics state
  type Analytics = { usageByWeekday: Record<number, number>; busiestWeekday: number; busiestHour: number; total: number };
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  const activeSession = dryerQueue.find((q) => q.status === 'active');
  const isFree = !activeSession;

  // 1-second tick — drives the countdown display
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Real-time dryer doc
  useEffect(() => {
    if (!dryerId) return;
    const unsub = onSnapshot(doc(db, 'dryers', dryerId), (snap) => {
      if (snap.exists()) {
        setDryer({ id: snap.id, ...snap.data() } as Dryer);
      } else {
        setDryer(null);
      }
    });
    return unsub;
  }, [dryerId]);

  // Real-time queue for this dryer
  useEffect(() => {
    if (!familyCode || !dryerId) return;
    const q = query(
      collection(db, 'dryer_queue'),
      where('familyCode', '==', familyCode),
      where('dryerId', '==', dryerId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DryerQueueModel))
        .sort((a, b) => a.position - b.position);
      setDryerQueue(items);
    });
    return unsub;
  }, [familyCode, dryerId]);

  // Real-time chat messages for the active session
  const activeSessionId = activeSession?.id;
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(db, 'dryer_queue', activeSessionId, 'messages'),
        orderBy('timestamp', 'asc')
      ),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueueMessage)));
      }
    );
    return unsub;
  }, [activeSessionId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myActiveSession = dryerQueue.find((q) => q.userId === uid && q.status === 'active');
  const myWaitingSession = dryerQueue.find((q) => q.userId === uid && q.status === 'waiting');
  const mySession = myActiveSession ?? myWaitingSession;
  const alreadyInQueue = !!mySession;
  const activeAndWaiting = dryerQueue.filter((q) => ['active', 'waiting'].includes(q.status));

  const remainingSec = myActiveSession ? getRemainingSeconds(myActiveSession) : 0;
  const isPickupPending = myActiveSession && remainingSec === 0;

  const tip = DRYER_TIPS[new Date().getDate() % DRYER_TIPS.length];

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModel || !dryer) return;
    if (!familyCode) {
      setJoinError('No family code found. Please re-login.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const isFirst = activeAndWaiting.length === 0;
      const position = isFirst ? 0 : activeAndWaiting.length + 1;
      const status: 'active' | 'waiting' = isFirst ? 'active' : 'waiting';
      const startTs = Timestamp.now();
      const endTs = Timestamp.fromMillis(Date.now() + durationMinutes * 60 * 1000);
      await addDoc(collection(db, 'dryer_queue'), {
        userId: uid,
        userName: userModel.name,
        familyCode,
        startTime: startTs,
        endTime: status === 'active' ? endTs : null,
        durationMinutes,
        durationHours: Math.ceil(durationMinutes / 60),
        status,
        position,
        pickupReminderSent: false,
        dryerId,
        dryerName: dryer.name,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed. Check Firestore rules.';
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  // Analytics loader
  const loadAnalytics = async (range: number) => {
    if (!familyCode || !dryerId) return;
    setAnalyticsRange(range);
    setAnalyticsLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - range);
      const q = query(
        collection(db, 'dryer_queue'),
        where('familyCode', '==', familyCode),
        where('dryerId', '==', dryerId),
        where('status', '==', 'completed')
      );
      const snap = await getDocs(q);
      const weekdayCounts: Record<number, number> = {};
      const hourCounts: Record<number, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const startTime: Date = (data.startTime as Timestamp).toDate();
        if (startTime < since) return;
        const jsDay = startTime.getDay();
        const wd = jsDay === 0 ? 7 : jsDay;
        weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;
        const hr = startTime.getHours();
        hourCounts[hr] = (hourCounts[hr] ?? 0) + 1;
      });
      const total = Object.values(weekdayCounts).reduce((s, v) => s + v, 0);
      let busiestWeekday = 1;
      if (Object.keys(weekdayCounts).length > 0) {
        busiestWeekday = Number(Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0][0]);
      }
      let busiestHour = 0;
      if (Object.keys(hourCounts).length > 0) {
        busiestHour = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0]);
      }
      setAnalytics({ usageByWeekday: weekdayCounts, busiestWeekday, busiestHour, total });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (familyCode && dryerId) loadAnalytics(analyticsRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyCode, dryerId]);

  // Send a chat message
  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeSession || !userModel) return;
    setSendingMsg(true);
    try {
      await sendDryerQueueMessage({
        queueId: activeSession.id,
        senderId: uid,
        senderName: userModel.name,
        message: text.trim(),
      });
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(chatInput);
    setChatInput('');
  };

  const handleComplete = async (id: string) => {
    const item = dryerQueue.find((q) => q.id === id);
    await updateDoc(doc(db, 'dryer_queue', id), { status: 'completed', endTime: Timestamp.now() });
    if (item?.status === 'active') {
      const next = dryerQueue
        .filter((q) => q.status === 'waiting' && q.dryerId === item.dryerId)
        .sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime())[0];
      if (next) {
        const now = Date.now();
        await updateDoc(doc(db, 'dryer_queue', next.id), {
          status: 'active',
          startTime: Timestamp.fromMillis(now),
          endTime: Timestamp.fromMillis(now + next.durationMinutes * 60 * 1000),
          position: 0,
          pickupReminderSent: false,
        });
      }
    }
  };

  const handleCancel = async (id: string) => {
    const item = dryerQueue.find((q) => q.id === id);
    await updateDoc(doc(db, 'dryer_queue', id), { status: 'cancelled', endTime: Timestamp.now() });
    if (item?.status === 'active') {
      const next = dryerQueue
        .filter((q) => q.status === 'waiting' && q.dryerId === item.dryerId)
        .sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime())[0];
      if (next) {
        const now = Date.now();
        await updateDoc(doc(db, 'dryer_queue', next.id), {
          status: 'active',
          startTime: Timestamp.fromMillis(now),
          endTime: Timestamp.fromMillis(now + next.durationMinutes * 60 * 1000),
          position: 0,
          pickupReminderSent: false,
        });
      }
    }
  };

  if (!dryer) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-amber-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Link href="/dryers"
            className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black tracking-tight">{dryer.name}</h1>
            <p className="text-white/40 text-xs mt-0.5">Live dryer details & booking</p>
          </div>
        </div>

        {/* ── Dryer graphic + status ─────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-xl shadow-black/30">
          {/* Visual header */}
          <div className="relative h-52 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.2) 0%, rgba(251,146,60,0.12) 50%, rgba(30,15,0,1) 100%)' }}>
            {/* Dryer illustration */}
            <div className="relative">
              <div className="w-32 h-40 rounded-3xl border-2 border-white/15 bg-white/5 flex flex-col items-center justify-between py-4 shadow-2xl shadow-amber-500/20">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400/60" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
                <div className={clsx(
                  'w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors',
                  isFree ? 'border-green-500/50 bg-green-500/10' : 'border-orange-500/50 bg-orange-500/10'
                )}>
                  <div className={clsx(
                    'w-12 h-12 rounded-full border-2 transition-colors',
                    isFree ? 'border-green-400/60 bg-green-500/15' : 'border-orange-400/60 bg-orange-500/15'
                  )} style={!isFree ? { animation: 'spin 4s linear infinite' } : {}} />
                </div>
                <div className="flex gap-2">
                  <div className={clsx('w-2 h-2 rounded-full', isFree ? 'bg-green-400' : 'bg-amber-400 animate-pulse')} />
                  <div className="w-2 h-2 rounded-full bg-white/15" />
                </div>
              </div>
            </div>

            {/* Status badge overlay */}
            <div className={clsx(
              'absolute top-4 right-4 px-3 py-1.5 rounded-xl text-xs font-black tracking-wider shadow-lg',
              isFree ? 'bg-green-500/90 text-white shadow-green-500/30' : 'bg-orange-500/90 text-white shadow-orange-500/30'
            )}>
              {isFree ? '✓ FREE' : '⏳ BUSY'}
            </div>
          </div>

          {/* Status info bar */}
          <div className="bg-surface px-5 py-4 flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
              isFree ? 'bg-green-500/15' : 'bg-orange-500/15'
            )}>
              {isFree
                ? <CheckCircle size={20} className="text-green-400" />
                : <Clock size={20} className="text-orange-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={clsx('text-[11px] font-black tracking-wider uppercase',
                isFree ? 'text-green-400' : 'text-orange-400')}>
                {isFree ? 'Dryer Ready' : 'Dryer Busy'}
              </p>
              <p className="text-sm font-bold text-white/70 mt-0.5">
                {isFree
                  ? 'Available for new session'
                  : activeSession
                    ? getRemainingSeconds(activeSession) > 0
                      ? `Time left: ${formatDuration(getRemainingSeconds(activeSession))}`
                      : 'Cycle finished. Please pick up laundry'
                    : ''
                }
              </p>
            </div>
            {!isFree && activeSession && getRemainingSeconds(activeSession) > 0 && (
              <span className="text-lg font-black text-orange-400 tabular-nums shrink-0">
                {formatDuration(getRemainingSeconds(activeSession))}
              </span>
            )}
          </div>

          {/* Progress bar for active session */}
          {activeSession && activeSession.durationMinutes > 0 && (() => {
            const startMs = activeSession.startTime.toDate().getTime();
            const totalMs = activeSession.durationMinutes * 60 * 1000;
            const progress = Math.min((Date.now() - startMs) / totalMs, 1);
            return (
              <div className="h-1.5 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-400 transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            );
          })()}
        </div>

        {/* ── My active session card ─────────────────────────────────── */}
        {myActiveSession && (
          <div className="rounded-3xl p-6 space-y-5"
            style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', boxShadow: '0 15px 40px rgba(217,119,6,0.4)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-white/70 tracking-widest uppercase">
                {remainingSec > 0 ? 'Active Session' : 'Reserved Slot'}
              </p>
              <Wind size={18} className="text-white/50" />
            </div>

            {remainingSec > 0 ? (
              <>
                <div>
                  <p className="text-5xl font-black text-white tracking-tight tabular-nums leading-none">
                    {formatDuration(remainingSec)}
                  </p>
                  <p className="text-white/50 text-sm mt-2">remaining</p>
                </div>
                <div className="rounded-xl overflow-hidden h-2.5 bg-white/20">
                  <div
                    className="h-full bg-white transition-all duration-1000 rounded-xl"
                    style={{
                      width: `${Math.min(
                        ((myActiveSession.durationMinutes * 60 - remainingSec) / (myActiveSession.durationMinutes * 60)) * 100,
                        100
                      )}%`
                    }}
                  />
                </div>
              </>
            ) : (
              <div>
                <p className="text-5xl font-black text-white">0s</p>
                <p className="text-white/80 font-bold mt-2">Please pick up your laundry</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleComplete(myActiveSession.id)}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {isPickupPending ? '📦 PICK UP LAUNDRY' : '✓ MARK DONE'}
              </button>
              {!isPickupPending && (
                <button
                  onClick={() => handleCancel(myActiveSession.id)}
                  className="px-5 py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── My waiting session card ────────────────────────────────── */}
        {myWaitingSession && !myActiveSession && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-amber-300">You&apos;re in queue</p>
              <p className="text-amber-400/70 text-xs mt-0.5">Position #{myWaitingSession.position} · {myWaitingSession.durationMinutes} min session</p>
            </div>
            <button
              onClick={() => handleCancel(myWaitingSession.id)}
              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            >
              <XCircle size={14} /> Leave
            </button>
          </div>
        )}

        {/* ── Join queue form ────────────────────────────────────────── */}
        {!alreadyInQueue && (
          <div className="rounded-2xl border border-amber-500/25 p-5 space-y-4"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(30,15,0,0.95) 100%)' }}>
            <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Book This Dryer</p>

            <form onSubmit={handleJoin} className="space-y-4">
              {/* Duration selector */}
              <div>
                <label className="label">Select duration</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={clsx(
                        'px-4 py-2.5 rounded-xl text-sm font-black transition-all border',
                        durationMinutes === d
                          ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/30'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom duration stepper */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDurationMinutes((v) => Math.max(15, v - 15))}
                  className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                >
                  <Minus size={16} />
                </button>
                <div className="flex-1 text-center py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg font-black text-white">{durationMinutes}</span>
                  <span className="text-white/40 text-sm ml-1">min</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDurationMinutes((v) => Math.min(240, v + 15))}
                  className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Booking summary */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Dryer</span>
                  <span className="font-bold text-amber-300">{dryer.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/50">Duration</span>
                  <span className="font-bold text-white">{durationMinutes} min</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/50">Est. end</span>
                  <span className="font-bold text-white">
                    {format(new Date(Date.now() + durationMinutes * 60000), 'h:mm a')}
                  </span>
                </div>
                {!isFree && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/50">Position</span>
                    <span className="font-bold text-yellow-400">#{activeAndWaiting.length + 1} (waiting)</span>
                  </div>
                )}
              </div>

              {joinError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-start gap-2 text-sm">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-300">{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={joining || !familyCode}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {joining
                  ? <><Loader2 size={17} className="animate-spin" /> Joining…</>
                  : isFree
                    ? <><CheckCircle size={17} /> Start Session</>
                    : <><Plus size={17} /> Join Queue (#{activeAndWaiting.length + 1})</>
                }
              </button>
            </form>
          </div>
        )}

        {/* ── Queue for this dryer ───────────────────────────────────── */}
        <div className="bg-surface border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">
              Current Queue
            </p>
            <span className="text-[11px] font-bold text-white/30">
              {activeAndWaiting.length} active
            </span>
          </div>

          {activeAndWaiting.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={22} className="text-green-400" />
              </div>
              <p className="text-white/40 font-bold text-sm">Queue is empty</p>
              <p className="text-white/20 text-xs mt-0.5">Dryer is free to use</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeAndWaiting.map((item) => {
                const isOwn = item.userId === uid;
                const remSec = item.status === 'active' ? getRemainingSeconds(item) : 0;
                const pct = item.status === 'active' && item.durationMinutes > 0
                  ? Math.min(
                      ((item.durationMinutes * 60 - remSec) / (item.durationMinutes * 60)) * 100,
                      100
                    )
                  : 0;

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'rounded-2xl border px-4 py-3 transition-all',
                      isOwn ? 'border-amber-500/30 bg-amber-500/8' : 'border-white/8 bg-white/3'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Position */}
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 border',
                        isOwn ? 'bg-amber-600/40 border-amber-500/50 text-amber-300' : 'bg-white/10 border-white/10 text-white/50'
                      )}>
                        #{item.position}
                      </div>

                      {/* Avatar */}
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                        isOwn ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70'
                      )}>
                        {getInitials(item.userName)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm truncate">{item.userName}</p>
                          {isOwn && <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md">YOU</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-white/30 text-[10px]">
                          <Clock size={9} />
                          <span>{item.durationMinutes} min · {format(item.startTime.toDate(), 'h:mm a')}</span>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={clsx(
                          'text-[10px] font-black px-2.5 py-1 rounded-full border',
                          item.status === 'active'
                            ? 'text-green-400 bg-green-500/10 border-green-500/20'
                            : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                        )}>
                          <span className={clsx(
                            'inline-block w-1.5 h-1.5 rounded-full mr-1',
                            item.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
                          )} />
                          {item.status === 'active' ? 'Active' : 'Waiting'}
                        </span>
                        {item.status === 'active' && remSec > 0 && (
                          <span className="text-[11px] font-black text-orange-400 tabular-nums">
                            {formatDuration(remSec)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {item.status === 'active' && item.durationMinutes > 0 && (
                      <div className="mt-2.5 h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Dryer tip ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb size={17} className="text-amber-400" />
          </div>
          <div>
            <p className="text-[11px] font-black text-white/40 tracking-wider uppercase mb-1">💡 Dryer Tip</p>
            <p className="text-sm font-semibold text-white/70">{tip}</p>
          </div>
        </div>

        {/* ── Chat / Communication ───────────────────────────────────── */}
        {activeSession && (
          <div className="bg-surface border border-white/10 rounded-2xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <MessageSquare size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">💬 Communication</p>
                <p className="text-xs text-white/30 mt-0.5">Chat with family during this session</p>
              </div>
            </div>

            {/* Quick message buttons */}
            <div>
              {activeSession.userId === uid ? (
                <>
                  <p className="text-xs font-black text-white/40 mb-2 uppercase tracking-wider">Quick Reply</p>
                  <div className="flex flex-wrap gap-2">
                    {['Done', 'On my way – pick up', 'On the way'].map((msg) => (
                      <button key={msg} type="button"
                        onClick={() => sendMessage(msg)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-colors">
                        {msg}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setShowCustomMsg((v) => !v)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white/8 border border-white/10 text-white/50 hover:bg-white/15 transition-colors">
                      Custom…
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-black text-white/40 mb-2 uppercase tracking-wider">Notify {activeSession.userName}</p>
                  <div className="flex flex-wrap gap-2">
                    {['Almost done', 'Please pick up'].map((msg) => (
                      <button key={msg} type="button"
                        onClick={() => sendMessage(msg)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-colors">
                        {msg}
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => setShowCustomMsg((v) => !v)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white/8 border border-white/10 text-white/50 hover:bg-white/15 transition-colors">
                      Custom…
                    </button>
                  </div>
                </>
              )}

              {/* Custom message input */}
              {showCustomMsg && (
                <form onSubmit={async (e) => { e.preventDefault(); await sendMessage(customMsgText); setCustomMsgText(''); setShowCustomMsg(false); }}
                  className="mt-3 flex gap-2">
                  <input
                    value={customMsgText}
                    onChange={(e) => setCustomMsgText(e.target.value)}
                    placeholder="Type a custom message…"
                    className="flex-1 input text-sm py-2"
                  />
                  <button type="submit" disabled={!customMsgText.trim() || sendingMsg}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-500 disabled:opacity-40 transition-colors">
                    Send
                  </button>
                </form>
              )}
            </div>

            {/* Messages list */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No messages yet.</p>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === uid;
                  const ts = msg.timestamp.toDate();
                  const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;
                  return (
                    <div key={msg.id} className={clsx('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div className={clsx(
                        'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm',
                        isOwn
                          ? 'bg-amber-600 text-white rounded-br-sm'
                          : 'bg-white/10 text-white/80 rounded-bl-sm'
                      )}>
                        {!isOwn && (
                          <p className="text-[10px] font-black text-amber-300 mb-0.5">{msg.senderName}</p>
                        )}
                        <p className="font-semibold leading-snug">{msg.message}</p>
                        <p className={clsx('text-[9px] mt-1', isOwn ? 'text-white/50 text-right' : 'text-white/30')}>{timeStr}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message…"
                className="flex-1 input text-sm py-2.5"
              />
              <button type="submit" disabled={!chatInput.trim() || sendingMsg}
                className="w-10 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0">
                {sendingMsg
                  ? <Loader2 size={15} className="animate-spin text-white" />
                  : <Send size={15} className="text-white" />}
              </button>
            </form>
          </div>
        )}

        {/* ── Usage Analytics ────────────────────────────────────────── */}
        <div className="bg-surface border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <BarChart2 size={15} className="text-orange-400" />
              </div>
              <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">📊 Usage Analytics</p>
            </div>
            {/* Range selector */}
            <div className="flex gap-1">
              {[7, 30, 90].map((r) => (
                <button key={r} type="button"
                  onClick={() => loadAnalytics(r)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors',
                    analyticsRange === r
                      ? 'bg-amber-600 text-white'
                      : 'bg-white/8 text-white/40 hover:bg-white/15'
                  )}>
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-amber-400" />
            </div>
          ) : analytics === null ? (
            <p className="text-white/30 text-sm text-center py-4">No analytics available yet.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-white/60">
                Used <span className="text-white font-black">{analytics.total}</span> times in the last {analyticsRange} days
              </p>

              {/* Bar chart */}
              <div className="flex items-end justify-between gap-1 h-28 mt-2">
                {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((label, i) => {
                  const wd = i + 1;
                  const count = analytics.usageByWeekday[wd] ?? 0;
                  const maxVal = Math.max(...Object.values(analytics.usageByWeekday), 1);
                  const pct = (count / maxVal) * 100;
                  const isBusiest = wd === analytics.busiestWeekday && analytics.total > 0;
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                      {count > 0 && (
                        <span className="text-[9px] font-black text-white/40">{count}</span>
                      )}
                      <div className="w-full flex items-end" style={{ height: 80 }}>
                        <div
                          className={clsx(
                            'w-full rounded-t-lg transition-all duration-500',
                            isBusiest ? 'bg-amber-500' : 'bg-amber-500/40'
                          )}
                          style={{ height: `${Math.max(pct, count > 0 ? 8 : 2)}%` }}
                        />
                      </div>
                      <span className={clsx(
                        'text-[10px] font-bold',
                        isBusiest ? 'text-amber-400' : 'text-white/30'
                      )}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Stats summary */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-3.5 py-2.5">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">Busiest Day</p>
                  <p className="text-sm font-black text-amber-300 mt-0.5">
                    {analytics.total > 0
                      ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(analytics.busiestWeekday - 1) % 7]
                      : '—'}
                  </p>
                </div>
                <div className="bg-orange-500/8 border border-orange-500/15 rounded-xl px-3.5 py-2.5">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">Peak Hour</p>
                  <p className="text-sm font-black text-orange-300 mt-0.5">
                    {analytics.total > 0 ? `${analytics.busiestHour}:00` : '—'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </AppShell>
  );
}
