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
import { QueueModel, WashingMachine, Dryer, DryerQueueModel } from '@/lib/types';
import { format } from 'date-fns';
import {
  Plus, Loader2, Clock, CheckCircle, XCircle, Search, X,
  WashingMachine as WashingMachineIcon, ChevronRight, Wind,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const DURATION_OPTIONS = [1, 5, 10, 15, 30, 60];

function stepDown(v: number): number {
  if (v <= 1)  return 1;
  if (v <= 10) return v - 1;
  if (v <= 30) return v - 5;
  return Math.max(1, v - 15);
}

function stepUp(v: number): number {
  if (v < 10)  return v + 1;
  if (v < 30)  return v + 5;
  return Math.min(240, v + 15);
}

function formatRemainingTime(
  item: { status: string; startTime: Timestamp; durationMinutes: number }
): string {
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
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function QueuePage() {
  const { userModel } = useAuth();

  // ── Washer state ─────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueModel[]>([]);
  const [machines, setMachines] = useState<WashingMachine[]>([]);
  const [showAddMachineForm, setShowAddMachineForm] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [addingMachine, setAddingMachine] = useState(false);
  const [addMachineError, setAddMachineError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc');

  // ── Dryer state ───────────────────────────────────────────────────────────────
  const [dryerQueue, setDryerQueue] = useState<DryerQueueModel[]>([]);
  const [dryers, setDryers] = useState<Dryer[]>([]);
  const [showDryerForm, setShowDryerForm] = useState(false);
  const [dryerId, setDryerId] = useState('');
  const [dryerDuration, setDryerDuration] = useState(60);
  const [savingDryer, setSavingDryer] = useState(false);
  const [dryerJoinError, setDryerJoinError] = useState<string | null>(null);
  const [dryerFilter, setDryerFilter] = useState<'active' | 'all'>('active');
  const [dryerSearch, setDryerSearch] = useState('');
  const [dryerAvailableOnly, setDryerAvailableOnly] = useState(false);
  const [dryerSortMode, setDryerSortMode] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc');
  const [showAddDryerForm, setShowAddDryerForm] = useState(false);
  const [newDryerName, setNewDryerName] = useState('');
  const [addingDryer, setAddingDryer] = useState(false);
  const [addDryerError, setAddDryerError] = useState<string | null>(null);

  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  // 1-second tick — drives the countdown display
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Washer queue subscription
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

  // Machines subscription
  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'washing_machines'), where('familyCode', '==', familyCode));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WashingMachine));
      setMachines(list);
    });
  }, [familyCode]);

  // Dryer queue subscription
  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'dryer_queue'), where('familyCode', '==', familyCode));
    return onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DryerQueueModel))
        .sort((a, b) => a.position - b.position);
      setDryerQueue(items);
    }, (error) => {
      console.error('Failed to load dryer queue:', error);
      setDryerQueue([]);
    });
  }, [familyCode]);

  // Dryers subscription
  useEffect(() => {
    if (!familyCode) return;
    const q = query(collection(db, 'dryers'), where('familyCode', '==', familyCode));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dryer));
      setDryers(list);
      if (list.length > 0 && !dryerId) setDryerId(list[0].id);
    });
  }, [familyCode, dryerId]);

  // ── Add washing machine ───────────────────────────────────────────────────────
  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim() || !familyCode) return;
    setAddingMachine(true);
    setAddMachineError(null);
    try {
      await addDoc(collection(db, 'washing_machines'), {
        name: newMachineName.trim(),
        familyCode,
        isActive: true,
      });
      setNewMachineName('');
      setShowAddMachineForm(false);
    } catch (err: unknown) {
      setAddMachineError(err instanceof Error ? err.message : 'Failed to add machine.');
    } finally {
      setAddingMachine(false);
    }
  };

  // ── Add dryer ─────────────────────────────────────────────────────────────────
  const handleAddDryer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDryerName.trim() || !familyCode) return;
    setAddingDryer(true);
    setAddDryerError(null);
    try {
      await addDoc(collection(db, 'dryers'), {
        name: newDryerName.trim(),
        familyCode,
      });
      setNewDryerName('');
      setShowAddDryerForm(false);
    } catch (err: unknown) {
      setAddDryerError(err instanceof Error ? err.message : 'Failed to add dryer.');
    } finally {
      setAddingDryer(false);
    }
  };

  // ── Join dryer queue ──────────────────────────────────────────────────────────
  const handleJoinDryer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModel || !dryerId) return;
    if (!familyCode) { setDryerJoinError('No family code found. Please re-login.'); return; }
    setSavingDryer(true);
    setDryerJoinError(null);
    try {
      const dryer = dryers.find((d) => d.id === dryerId);
      const activeInDryer = dryerQueue.filter(
        (q) => q.dryerId === dryerId && ['active', 'waiting'].includes(q.status)
      );
      // Position 0 = active (matches Flutter); length+1 for waiting
      const isDryerFirst = activeInDryer.length === 0;
      const position = isDryerFirst ? 0 : activeInDryer.length + 1;
      const status: 'active' | 'waiting' = isDryerFirst ? 'active' : 'waiting';
      await addDoc(collection(db, 'dryer_queue'), {
        userId: uid,
        userName: userModel.name,
        familyCode,
        startTime: Timestamp.now(),
        endTime: isDryerFirst ? Timestamp.fromMillis(Date.now() + dryerDuration * 60 * 1000) : null,
        durationMinutes: dryerDuration,
        durationHours: Math.ceil(dryerDuration / 60),
        status,
        position,
        pickupReminderSent: false,
        dryerId,
        dryerName: dryer?.name ?? 'Dryer',
      });
      setShowDryerForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed. Check Firestore rules.';
      setDryerJoinError(msg);
    } finally {
      setSavingDryer(false);
    }
  };

  const updateWasherStatus = async (id: string, status: 'completed' | 'cancelled') => {
    const item = queue.find((q) => q.id === id);
    await updateDoc(doc(db, 'washing_queue', id), { status, endTime: Timestamp.now() });
    if (item?.status === 'active') {
      const next = queue
        .filter((q) => q.status === 'waiting' && q.washingMachineId === item.washingMachineId)
        .sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime())[0];
      if (next) {
        const now = Date.now();
        await updateDoc(doc(db, 'washing_queue', next.id), {
          status: 'active',
          startTime: Timestamp.fromMillis(now),
          endTime: Timestamp.fromMillis(now + next.durationMinutes * 60 * 1000),
          position: 0,
          pickupReminderSent: false,
        });
      }
    }
  };

  const updateDryerStatus = async (id: string, status: 'completed' | 'cancelled') => {
    const item = dryerQueue.find((q) => q.id === id);
    await updateDoc(doc(db, 'dryer_queue', id), { status, endTime: Timestamp.now() });
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

  // ── Washer derived stats ──────────────────────────────────────────────────────
  const activeMachineIds = new Set(
    queue.filter((q) => q.status === 'active').map((q) => q.washingMachineId)
  );
  const washerAvailable = machines.filter((m) => !activeMachineIds.has(m.id)).length;
  const washerBusy = machines.filter((m) => activeMachineIds.has(m.id)).length;
  const washerWaiting = queue.filter((q) => q.status === 'waiting').length;

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

  // ── Dryer derived stats ───────────────────────────────────────────────────────
  const activeDryerIds = new Set(
    dryerQueue.filter((q) => q.status === 'active').map((q) => q.dryerId)
  );
  const dryerAvailable = dryers.filter((d) => !activeDryerIds.has(d.id)).length;
  const dryerBusy = dryers.filter((d) => activeDryerIds.has(d.id)).length;
  const dryerWaiting = dryerQueue.filter((q) => q.status === 'waiting').length;

  const filteredDryers = dryers
    .filter((d) => {
      if (dryerSearch && !d.name.toLowerCase().includes(dryerSearch.toLowerCase())) return false;
      if (dryerAvailableOnly && activeDryerIds.has(d.id)) return false;
      return true;
    })
    .sort((a, b) => {
      const aActive = activeDryerIds.has(a.id);
      const bActive = activeDryerIds.has(b.id);
      if (dryerSortMode === 'status') {
        if (aActive !== bActive) return aActive ? 1 : -1;
      }
      const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return dryerSortMode === 'name_desc' ? -cmp : cmp;
    });

  const displayedDryerQueue = dryerFilter === 'active'
    ? dryerQueue.filter((q) => ['active', 'waiting'].includes(q.status))
    : dryerQueue;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-0">

        {/* ════════════════════════════════════════════════════════════════════
            WASHING MACHINE SECTION
        ════════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Washing Machine Slots</h1>
            <p className="text-white/40 text-sm mt-0.5">Real-time machine queue</p>
          </div>
          <button
            onClick={() => { setShowAddMachineForm(!showAddMachineForm); setShowAddDryerForm(false); }}
            className="btn-primary flex items-center gap-2 py-2.5 px-4"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add New Washing Machine</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Add Washing Machine Form */}
        {showAddMachineForm && (
          <div
            className="bg-surface border border-indigo-500/30 rounded-2xl p-6 space-y-4 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(30,27,75,1) 100%)' }}
          >
            <h2 className="font-black text-base flex items-center gap-2">
              <WashingMachineIcon size={18} className="text-indigo-400" />
              Add New Washing Machine
            </h2>
            <form onSubmit={handleAddMachine} className="space-y-4">
              <div>
                <label className="label">Machine name</label>
                <input
                  className="input"
                  placeholder="e.g. Washing Machine 1"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  required
                />
              </div>
              {addMachineError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {addMachineError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingMachine || !familyCode || !newMachineName.trim()}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {addingMachine ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {addingMachine ? 'Adding…' : 'Add Machine'}
                </button>
                <button type="button" onClick={() => setShowAddMachineForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Select Machine Section */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4 mb-6">
          <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Select Machine</p>

          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Available" value={washerAvailable} color="text-green-400" />
            <StatPill label="Busy" value={washerBusy} color="text-orange-400" />
            <StatPill label="Waiting" value={washerWaiting} color="text-indigo-400" />
          </div>

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

          {machines.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">No washing machines found.</div>
          ) : filteredMachines.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-2xl text-white/40 text-sm font-bold">
              No machines match your search/filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMachines.map((m) => (
                <MachineCard key={m.id} machine={m} queue={queue} uid={uid} />
              ))}
            </div>
          )}
        </div>

        {/* Washer Queue List */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4 mb-10">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Washer Queue</p>
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
              <p className="text-white/20 text-sm mt-1">Click a machine card to join!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedQueue.map((item) => (
                <WasherQueueCard
                  key={item.id}
                  item={item}
                  isOwn={item.userId === uid}
                  onComplete={() => updateWasherStatus(item.id, 'completed')}
                  onCancel={() => updateWasherStatus(item.id, 'cancelled')}
                />
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            DRYER SECTION
        ════════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Dryer Slots</h2>
            <p className="text-white/40 text-sm mt-0.5">Real-time dryer queue</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAddDryerForm(!showAddDryerForm); setShowDryerForm(false); }}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm bg-white/10 hover:bg-white/15 text-white/70 border border-white/10 transition-all"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add New Dryer</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              onClick={() => { setShowDryerForm(!showDryerForm); setShowAddDryerForm(false); }}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Join Queue</span>
            </button>
          </div>
        </div>

        {/* Add Dryer Form */}
        {showAddDryerForm && (
          <div
            className="bg-surface border border-amber-500/30 rounded-2xl p-6 space-y-4 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(30,27,10,1) 100%)' }}
          >
            <h2 className="font-black text-base flex items-center gap-2">
              <Wind size={18} className="text-amber-400" />
              Add New Dryer
            </h2>
            <form onSubmit={handleAddDryer} className="space-y-4">
              <div>
                <label className="label">Dryer name</label>
                <input
                  className="input"
                  placeholder="e.g. Dryer 1"
                  value={newDryerName}
                  onChange={(e) => setNewDryerName(e.target.value)}
                  required
                />
              </div>
              {addDryerError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {addDryerError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingDryer || !familyCode || !newDryerName.trim()}
                  className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                >
                  {addingDryer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {addingDryer ? 'Adding…' : 'Add Dryer'}
                </button>
                <button type="button" onClick={() => setShowAddDryerForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Dryer Queue Form */}
        {showDryerForm && (
          <div
            className="bg-surface border border-amber-500/30 rounded-2xl p-6 space-y-4 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(30,27,10,1) 100%)' }}
          >
            <h2 className="font-black text-base flex items-center gap-2">
              <Wind size={18} className="text-amber-400" />
              Join Dryer Queue
            </h2>
            <form onSubmit={handleJoinDryer} className="space-y-4">
              <div>
                <label className="label">Dryer</label>
                <select
                  className="input"
                  value={dryerId}
                  onChange={(e) => setDryerId(e.target.value)}
                >
                  {dryers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Duration</label>
                {/* Preset chips */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDryerDuration(d)}
                      className={clsx(
                        'px-4 py-2 rounded-xl text-sm font-bold transition-all border',
                        dryerDuration === d
                          ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/30'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
                {/* Custom stepper */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDryerDuration((v) => stepDown(v))}
                    disabled={dryerDuration <= 1}
                    className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <span className="text-lg font-black leading-none">−</span>
                  </button>
                  <div className="flex-1 text-center py-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-lg font-black text-white">{dryerDuration}</span>
                    <span className="text-white/40 text-sm ml-1">min</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDryerDuration((v) => stepUp(v))}
                    disabled={dryerDuration >= 240}
                    className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <span className="text-lg font-black leading-none">+</span>
                  </button>
                </div>
              </div>

              {dryerId && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-white/70">
                  <span className="font-bold text-amber-300">{dryers.find((d) => d.id === dryerId)?.name}</span>
                  {' · '}{dryerDuration} min session
                  <span className="ml-2 text-white/40">
                    (est. end {format(new Date(Date.now() + dryerDuration * 60000), 'h:mm a')})
                  </span>
                </div>
              )}

              {dryerJoinError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {dryerJoinError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingDryer || !familyCode}
                  className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                >
                  {savingDryer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {savingDryer ? 'Joining…' : 'Join Queue'}
                </button>
                <button type="button" onClick={() => setShowDryerForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Select Dryer Section */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4 mb-6">
          <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Select Dryer</p>

          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Available" value={dryerAvailable} color="text-green-400" />
            <StatPill label="Busy" value={dryerBusy} color="text-orange-400" />
            <StatPill label="Waiting" value={dryerWaiting} color="text-amber-400" />
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                className="input pl-9 pr-9"
                placeholder="Search dryer by name"
                value={dryerSearch}
                onChange={(e) => setDryerSearch(e.target.value)}
              />
              {dryerSearch && (
                <button
                  onClick={() => setDryerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDryerAvailableOnly((v) => !v)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  dryerAvailableOnly
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                )}
              >
                ✓ Available only
              </button>
              <select
                value={dryerSortMode}
                onChange={(e) => setDryerSortMode(e.target.value as typeof dryerSortMode)}
                className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/60 px-3 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="name_asc">A → Z</option>
                <option value="name_desc">Z → A</option>
                <option value="status">Available first</option>
              </select>
              <span className="text-[11px] text-white/30 font-bold ml-auto">
                Showing {filteredDryers.length} / {dryers.length}
              </span>
            </div>
          </div>

          {dryers.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">No dryers found.</div>
          ) : filteredDryers.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-2xl text-white/40 text-sm font-bold">
              No dryers match your search/filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDryers.map((d) => (
                <DryerCard key={d.id} dryer={d} queue={dryerQueue} uid={uid} />
              ))}
            </div>
          )}
        </div>

        {/* Dryer Queue List */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 tracking-[2px] uppercase">Dryer Queue</p>
            <div className="flex gap-2">
              {(['active', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDryerFilter(f)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-bold transition-all',
                    dryerFilter === f ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/40 hover:bg-white/20'
                  )}
                >
                  {f === 'active' ? 'Active' : 'All'}{' '}
                  <span className="opacity-70">
                    ({f === 'active' ? dryerQueue.filter((q) => ['active', 'waiting'].includes(q.status)).length : dryerQueue.length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {displayedDryerQueue.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Wind size={26} className="text-white/20" />
              </div>
              <p className="text-white/30 font-bold">Queue is empty</p>
              <p className="text-white/20 text-sm mt-1">Be the first to join!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedDryerQueue.map((item) => (
                <DryerQueueCard
                  key={item.id}
                  item={item}
                  isOwn={item.userId === uid}
                  onComplete={() => updateDryerStatus(item.id, 'completed')}
                  onCancel={() => updateDryerStatus(item.id, 'cancelled')}
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

// ─── Washer machine card ──────────────────────────────────────────────────────

function MachineCard({ machine, queue, uid }: { machine: WashingMachine; queue: QueueModel[]; uid: string }) {
  const activeSession = queue.find((q) => q.washingMachineId === machine.id && q.status === 'active');
  const isFree = !activeSession;
  let statusLine = '';
  let subLine = '';
  if (activeSession) {
    const remaining = formatRemainingTime(activeSession);
    const userLabel = activeSession.userId === uid ? 'You' : activeSession.userName;
    if (remaining === '0s') { statusLine = `Pickup required · ${userLabel}`; subLine = 'Awaiting pickup'; }
    else { statusLine = `${remaining} · ${userLabel}`; subLine = 'Then available'; }
  } else {
    subLine = 'Ready now';
  }
  return (
    <Link href={`/queue/${machine.id}`} className="block rounded-[20px] overflow-hidden border border-white/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
      style={{ background: 'linear-gradient(145deg, rgba(30,27,75,0.9) 0%, #1E1B4B 100%)' }}>
      <div className="relative w-full aspect-[4/3]"
        style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(79,70,229,0.05) 100%)' }}>
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
        <div className={clsx(
          'absolute top-2 right-2 px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider shadow-lg',
          isFree ? 'bg-green-500/90 text-white shadow-green-500/30' : 'bg-orange-500/90 text-white shadow-orange-500/30'
        )}>
          {isFree ? '✓ FREE' : '⏳ BUSY'}
        </div>
        {!isFree && <div className="absolute bottom-2 left-2"><div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" /></div>}
        <div className="absolute bottom-2 right-2 text-white/20"><ChevronRight size={14} /></div>
      </div>
      <div className="px-3 py-2.5 text-center">
        <p className="font-black text-[13px] text-white truncate">{machine.name}</p>
        {activeSession ? (
          <>
            <p className={clsx('text-[10px] font-bold mt-0.5 truncate', isFree ? 'text-green-400' : 'text-orange-400')}>{statusLine}</p>
            <p className="text-[9px] font-semibold text-white/30 mt-0.5">{subLine}</p>
          </>
        ) : (
          <p className="text-[10px] font-bold text-green-400 mt-0.5">{subLine}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Dryer card ───────────────────────────────────────────────────────────────

function DryerCard({ dryer, queue, uid }: { dryer: Dryer; queue: DryerQueueModel[]; uid: string }) {
  const activeSession = queue.find((q) => q.dryerId === dryer.id && q.status === 'active');
  const isFree = !activeSession;
  let statusLine = '';
  let subLine = '';
  if (activeSession) {
    const remaining = formatRemainingTime(activeSession);
    const userLabel = activeSession.userId === uid ? 'You' : activeSession.userName;
    if (remaining === '0s') { statusLine = `Pickup required · ${userLabel}`; subLine = 'Awaiting pickup'; }
    else { statusLine = `${remaining} · ${userLabel}`; subLine = 'Then available'; }
  } else {
    subLine = 'Ready now';
  }
  return (
    <Link href={`/dryers/${dryer.id}`} className="block rounded-[20px] overflow-hidden border border-white/10 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all"
      style={{ background: 'linear-gradient(145deg, rgba(40,27,0,0.9) 0%, #1a1200 100%)' }}>
      <div className="relative w-full aspect-[4/3]"
        style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.15) 0%, rgba(217,119,6,0.05) 100%)' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-24 rounded-2xl border-2 border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1.5 shadow-lg">
            <div className="w-12 h-12 rounded-full border-2 border-amber-400/40 flex items-center justify-center bg-amber-500/10">
              <div className="w-7 h-7 rounded-full border border-amber-400/60 bg-amber-500/20" />
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            </div>
          </div>
        </div>
        <div className={clsx(
          'absolute top-2 right-2 px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider shadow-lg',
          isFree ? 'bg-green-500/90 text-white shadow-green-500/30' : 'bg-orange-500/90 text-white shadow-orange-500/30'
        )}>
          {isFree ? '✓ FREE' : '⏳ BUSY'}
        </div>
        {!isFree && <div className="absolute bottom-2 left-2"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /></div>}
        <div className="absolute bottom-2 right-2 text-white/20"><ChevronRight size={14} /></div>
      </div>
      <div className="px-3 py-2.5 text-center">
        <p className="font-black text-[13px] text-white truncate">{dryer.name}</p>
        {activeSession ? (
          <>
            <p className={clsx('text-[10px] font-bold mt-0.5 truncate', isFree ? 'text-green-400' : 'text-orange-400')}>{statusLine}</p>
            <p className="text-[9px] font-semibold text-white/30 mt-0.5">{subLine}</p>
          </>
        ) : (
          <p className="text-[10px] font-bold text-green-400 mt-0.5">{subLine}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Washer queue card ────────────────────────────────────────────────────────

function WasherQueueCard({ item, isOwn, onComplete, onCancel }: {
  item: QueueModel; isOwn: boolean; onComplete: () => void; onCancel: () => void;
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
    <div className={clsx('rounded-2xl border px-4 py-3.5 transition-all', isOwn ? 'border-indigo-500/30 bg-indigo-500/8' : 'border-white/8 bg-white/3')}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border', isOwn ? 'bg-indigo-600/40 border-indigo-500/50 text-indigo-300' : 'bg-white/10 border-white/10 text-white/60')}>
          #{item.position}
        </div>
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0', isOwn ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70')}>
          {getInitials(item.userName)}
        </div>
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx('badge-chip border text-[10px]', s.badge)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
            {s.label}
          </span>
          {remaining && remaining !== '0s' && <span className="text-[11px] font-black text-orange-400 tabular-nums">{remaining}</span>}
          {isPickupPending && <span className="text-[10px] font-black text-amber-400 animate-pulse">Pickup!</span>}
        </div>
      </div>
      {item.status === 'active' && item.durationMinutes > 0 && (() => {
        const startMs = item.startTime.toDate().getTime();
        const totalMs = item.durationMinutes * 60 * 1000;
        const progress = Math.min((Date.now() - startMs) / totalMs, 1);
        return (
          <div className="mt-3 h-1 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
          </div>
        );
      })()}
      {isOwn && ['active', 'waiting'].includes(item.status) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-white/8">
          <button onClick={onComplete} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-bold transition-colors">
            <CheckCircle size={14} />
            {isPickupPending ? 'Pick up laundry' : 'Done'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold transition-colors">
            <XCircle size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dryer queue card ─────────────────────────────────────────────────────────

function DryerQueueCard({ item, isOwn, onComplete, onCancel }: {
  item: DryerQueueModel; isOwn: boolean; onComplete: () => void; onCancel: () => void;
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
    <div className={clsx('rounded-2xl border px-4 py-3.5 transition-all', isOwn ? 'border-amber-500/30 bg-amber-500/8' : 'border-white/8 bg-white/3')}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border', isOwn ? 'bg-amber-600/40 border-amber-500/50 text-amber-300' : 'bg-white/10 border-white/10 text-white/60')}>
          #{item.position}
        </div>
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0', isOwn ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70')}>
          {getInitials(item.userName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm truncate">{item.userName}</p>
            {isOwn && <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md">YOU</span>}
          </div>
          <p className="text-[11px] text-white/40 font-semibold truncate">{item.dryerName}</p>
          <div className="flex items-center gap-1 mt-0.5 text-white/30 text-[10px]">
            <Clock size={9} />
            <span>{item.durationMinutes} min</span>
            <span className="opacity-50">·</span>
            <span>Started {format(item.startTime.toDate(), 'h:mm a')}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx('badge-chip border text-[10px]', s.badge)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
            {s.label}
          </span>
          {remaining && remaining !== '0s' && <span className="text-[11px] font-black text-orange-400 tabular-nums">{remaining}</span>}
          {isPickupPending && <span className="text-[10px] font-black text-amber-400 animate-pulse">Pickup!</span>}
        </div>
      </div>
      {item.status === 'active' && item.durationMinutes > 0 && (() => {
        const startMs = item.startTime.toDate().getTime();
        const totalMs = item.durationMinutes * 60 * 1000;
        const progress = Math.min((Date.now() - startMs) / totalMs, 1);
        return (
          <div className="mt-3 h-1 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
          </div>
        );
      })()}
      {isOwn && ['active', 'waiting'].includes(item.status) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-white/8">
          <button onClick={onComplete} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-bold transition-colors">
            <CheckCircle size={14} />
            {isPickupPending ? 'Pick up laundry' : 'Done'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold transition-colors">
            <XCircle size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}
