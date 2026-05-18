'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { QueueModel, WashingMachine } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, Loader2, Clock, CheckCircle, XCircle, Search, X, WashingMachine as WashingMachineIcon, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function formatRemainingTime(item: QueueModel): string {
  if (item.status !== 'active') return '';
  const startMs = item.startTime.toDate().getTime();
  const endMs = startMs + item.durationMinutes * 60 * 1000;
  const remainingSec = Math.floor((endMs - Date.now()) / 1000);
  if (remainingSec <= 0) return '0s';
  if (remainingSec < 60) return `${remainingSec}s`;
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
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

export default function QueuePage() {
  const { userModel } = useAuth();
  const [queue, setQueue] = useState<QueueModel[]>([]);
  const [machines, setMachines] = useState<WashingMachine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [machineId, setMachineId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc');
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  // 1-second tick for live countdowns
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Live queue
  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'washing_queue'), where('familyCode', '==', familyCode));
    return onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as QueueModel))
        .sort((a, b) => a.position - b.position);
      setQueue(items);
    }, (error) => {
      console.error('Failed to load queue:', error);
      setQueue([]);
    });
  }, [familyCode]);

  // Machines (live)
  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'washing_machines'), where('familyCode', '==', familyCode));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WashingMachine));
      setMachines(list);
      if (list.length > 0 && !machineId) setMachineId(list[0].id);
    });
  }, [familyCode, machineId]);

  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModel || !machineId) return;
    if (!familyCode) {
      setJoinError('No family code found. Please re-login.');
      return;
    }
    setSaving(true);
    setJoinError(null);
    try {
      const machine = machines.find((m) => m.id === machineId);
      const activeInMachine = queue.filter(
        (q) => q.washingMachineId === machineId && ['active', 'waiting'].includes(q.status)
      );
      const position = activeInMachine.length + 1;
      const status = position === 1 ? 'active' : 'waiting';
      const startTs = Timestamp.now();
      const endTs = Timestamp.fromMillis(Date.now() + durationMinutes * 60 * 1000);
      await addDoc(collection(db, 'washing_queue'), {
        userId: uid,
        userName: userModel.name,
        familyCode,
        startTime: startTs,
        endTime: endTs,
        durationMinutes,
        durationHours: Math.ceil(durationMinutes / 60),
        status,
        position,
        pickupReminderSent: false,
        washingMachineId: machineId,
        washingMachineName: machine?.name ?? 'Machine',
      });
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed. Check Firestore rules.';
      setJoinError(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    await updateDoc(doc(db, 'washing_queue', id), { status, endTime: Timestamp.now() });
  };

  // Derive stats
  const activeMachineIds = new Set(
    queue.filter((q) => q.status === 'active').map((q) => q.washingMachineId)
  );
  const availableCount = machines.filter((m) => !activeMachineIds.has(m.id)).length;
  const busyCount = machines.filter((m) => activeMachineIds.has(m.id)).length;
  const waitingCount = queue.filter((q) => q.status === 'waiting').length;

  // Filter & sort machines
  const filteredMachines = machines
    .filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (showAvailableOnly && activeMachineIds.has(m.id)) return false;
      return true;
    })
    .sort((a, b) => {
      const aActive = activeMachineIds.has(a.id);
      const bActive = activeMachineIds.has(b.id);
      if (sortMode === 'status') {
        if (aActive !== bActive) return aActive ? 1 : -1;
      }
      const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return sortMode === 'name_desc' ? -cmp : cmp;
    });

  const displayedQueue = filter === 'active'
    ? queue.filter((q) => ['active', 'waiting'].includes(q.status))
    : queue;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Washing Machine Slots</h1>
            <p className="text-white/40 text-sm mt-0.5">Real-time machine queue</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-2 py-2.5 px-4"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Join Queue</span>
          </button>
        </div>

        {/* ── SELECT MACHINE SECTION ───────────────────────────────────── */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4 mb-6">
          <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Select Machine</p>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Available" value={availableCount} color="text-green-400" />
            <StatPill label="Busy" value={busyCount} color="text-orange-400" />
            <StatPill label="Waiting" value={waitingCount} color="text-indigo-400" />
          </div>

          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                className="input pl-9 pr-9"
                placeholder="Search machine by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAvailableOnly((v) => !v)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  showAvailableOnly
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                )}
              >
                ✓ Available only
              </button>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/60 px-3 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                <option value="name_asc">A → Z</option>
                <option value="name_desc">Z → A</option>
                <option value="status">Available first</option>
              </select>

              <span className="text-[11px] text-white/30 font-bold ml-auto">
                Showing {filteredMachines.length} / {machines.length}
              </span>
            </div>
          </div>

          {/* Machine cards grid */}
          {machines.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">No washing machines found.</div>
          ) : filteredMachines.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-2xl text-white/40 text-sm font-bold">
              No machines match your search/filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMachines.map((m) => (
                <MachineCard
                  key={m.id}
                  machine={m}
                  queue={queue}
                  uid={uid}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── JOIN QUEUE FORM ──────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-surface border border-indigo-500/30 rounded-2xl p-6 space-y-4 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(30,27,75,1) 100%)' }}>
            <h2 className="font-black text-base flex items-center gap-2">
              <WashingMachineIcon size={18} className="text-indigo-400" />
              Join Queue
            </h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="label">Washing machine</label>
                <select
                  className="input"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Duration</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={clsx(
                        'px-4 py-2 rounded-xl text-sm font-bold transition-all',
                        durationMinutes === d
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking summary */}
              {machineId && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm text-white/70">
                  <span className="font-bold text-indigo-300">{machines.find((m) => m.id === machineId)?.name}</span>
                  {' · '}{durationMinutes} min session
                  <span className="ml-2 text-white/40">
                    (est. end {format(new Date(Date.now() + durationMinutes * 60000), 'h:mm a')})
                  </span>
                </div>
              )}

              {joinError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {joinError}
                </div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={saving || !familyCode} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {saving ? 'Joining…' : 'Join Queue'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── QUEUE LIST SECTION ───────────────────────────────────────── */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Queue List</p>
            <div className="flex gap-2">
              {(['active', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-bold transition-all',
                    filter === f ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/40 hover:bg-white/20'
                  )}
                >
                  {f === 'active' ? 'Active' : 'All'}{' '}
                  <span className="opacity-70">
                    ({f === 'active' ? queue.filter((q) => ['active', 'waiting'].includes(q.status)).length : queue.length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {displayedQueue.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <WashingMachineIcon size={26} className="text-white/20" />
              </div>
              <p className="text-white/30 font-bold">Queue is empty</p>
              <p className="text-white/20 text-sm mt-1">Be the first to join!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedQueue.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  isOwn={item.userId === uid}
                  onComplete={() => updateStatus(item.id, 'completed')}
                  onCancel={() => updateStatus(item.id, 'cancelled')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2.5 text-center">
      <p className={clsx('text-base font-black', color)}>{value}</p>
      <p className="text-[10px] font-bold text-white/30 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─── Machine card ─────────────────────────────────────────────────────────────

function MachineCard({
  machine,
  queue,
  uid,
}: {
  machine: WashingMachine;
  queue: QueueModel[];
  uid: string;
}) {
  const activeSession = queue.find(
    (q) => q.washingMachineId === machine.id && q.status === 'active'
  );
  const isFree = !activeSession;

  let statusLine = '';
  let subLine = '';

  if (activeSession) {
    const remaining = formatRemainingTime(activeSession);
    const userLabel = activeSession.userId === uid ? 'You' : activeSession.userName;
    if (remaining === '0s') {
      statusLine = `Pickup required · ${userLabel}`;
      subLine = 'Awaiting pickup';
    } else {
      statusLine = `${remaining} · ${userLabel}`;
      subLine = 'Then available';
    }
  } else {
    subLine = 'Ready now';
  }

  return (
    <Link href={`/queue/${machine.id}`} className="block rounded-[20px] overflow-hidden border border-white/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
      style={{ background: 'linear-gradient(145deg, rgba(30,27,75,0.9) 0%, #1E1B4B 100%)' }}>
      {/* Image area */}
      <div className="relative w-full aspect-[4/3]"
        style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(79,70,229,0.05) 100%)' }}>
        {/* Washing machine graphic */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-24 rounded-2xl border-2 border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1.5 shadow-lg">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 flex items-center justify-center bg-indigo-500/10">
              <div className="w-7 h-7 rounded-full border border-indigo-400/60 bg-indigo-500/20" />
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
            </div>
          </div>
        </div>

        {/* FREE / BUSY badge */}
        <div className={clsx(
          'absolute top-2 right-2 px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider shadow-lg',
          isFree
            ? 'bg-green-500/90 text-white shadow-green-500/30'
            : 'bg-orange-500/90 text-white shadow-orange-500/30'
        )}>
          {isFree ? '✓ FREE' : '⏳ BUSY'}
        </div>

        {/* Spinning indicator when active */}
        {!isFree && (
          <div className="absolute bottom-2 left-2">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          </div>
        )}

        {/* Tap arrow */}
        <div className="absolute bottom-2 right-2 text-white/20">
          <ChevronRight size={14} />
        </div>
      </div>

      {/* Info area */}
      <div className="px-3 py-2.5 text-center">
        <p className="font-black text-[13px] text-white truncate">{machine.name}</p>
        {activeSession ? (
          <>
            <p className={clsx('text-[10px] font-bold mt-0.5 truncate', isFree ? 'text-green-400' : 'text-orange-400')}>
              {statusLine}
            </p>
            <p className="text-[9px] font-semibold text-white/30 mt-0.5">{subLine}</p>
          </>
        ) : (
          <p className="text-[10px] font-bold text-green-400 mt-0.5">{subLine}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({
  item,
  isOwn,
  onComplete,
  onCancel,
}: {
  item: QueueModel;
  isOwn: boolean;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const remaining = item.status === 'active' ? formatRemainingTime(item) : null;
  const isPickupPending = item.status === 'active' && remaining === '0s';

  const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
    active: { dot: 'bg-green-400', badge: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Active' },
    waiting: { dot: 'bg-yellow-400', badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'Waiting' },
    completed: { dot: 'bg-white/20', badge: 'text-white/30 bg-white/5 border-white/10', label: 'Done' },
    cancelled: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Cancelled' },
  };
  const s = statusConfig[item.status] ?? statusConfig.completed;

  return (
    <div className={clsx(
      'rounded-2xl border px-4 py-3.5 transition-all',
      isOwn
        ? 'border-indigo-500/30 bg-indigo-500/8'
        : 'border-white/8 bg-white/3'
    )}>
      <div className="flex items-center gap-3">
        {/* Position badge */}
        <div className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border',
          isOwn
            ? 'bg-indigo-600/40 border-indigo-500/50 text-indigo-300'
            : 'bg-white/10 border-white/10 text-white/60'
        )}>
          #{item.position}
        </div>

        {/* Avatar with initials */}
        <div className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0',
          isOwn ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70'
        )}>
          {getInitials(item.userName)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm truncate">{item.userName}</p>
            {isOwn && <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-md">YOU</span>}
          </div>
          <p className="text-[11px] text-white/40 font-semibold truncate">{item.washingMachineName}</p>
          <div className="flex items-center gap-1 mt-0.5 text-white/30 text-[10px]">
            <Clock size={9} />
            <span>{item.durationMinutes} min</span>
            <span className="opacity-50">·</span>
            <span>Started {format(item.startTime.toDate(), 'h:mm a')}</span>
          </div>
        </div>

        {/* Right side: status + countdown */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx('badge-chip border text-[10px]', s.badge)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
            {s.label}
          </span>
          {remaining && remaining !== '0s' && (
            <span className="text-[11px] font-black text-orange-400 tabular-nums">{remaining}</span>
          )}
          {isPickupPending && (
            <span className="text-[10px] font-black text-amber-400 animate-pulse">Pickup!</span>
          )}
        </div>
      </div>

      {/* Progress bar for active sessions */}
      {item.status === 'active' && item.durationMinutes > 0 && (() => {
        const startMs = item.startTime.toDate().getTime();
        const totalMs = item.durationMinutes * 60 * 1000;
        const progress = Math.min((Date.now() - startMs) / totalMs, 1);
        return (
          <div className="mt-3 h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        );
      })()}

      {/* Actions */}
      {isOwn && ['active', 'waiting'].includes(item.status) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-white/8">
          <button
            onClick={onComplete}
            className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-bold transition-colors"
          >
            <CheckCircle size={14} />
            {isPickupPending ? 'Pick up laundry' : 'Done'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
          >
            <XCircle size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}
