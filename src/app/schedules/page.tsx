'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { LaundrySchedule } from '@/lib/types';
import {
  format, isSameDay, isSameMonth, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, differenceInMinutes, isAfter,
} from 'date-fns';
import {
  Plus, Trash2, CheckCircle, XCircle, Loader2,
  CalendarDays, ChevronLeft, ChevronRight, Edit2, Cloud,
  Sparkles, Clock, TrendingUp, Bell, X,
} from 'lucide-react';
import { clsx } from 'clsx';

// --- constants ----------------------------------------------------------------

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- types --------------------------------------------------------------------

interface WeatherDay {
  day: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
}

interface ScheduleForm {
  taskName: string;
  date: string;   // yyyy-MM-dd
  time: string;   // HH:mm
}

const EMPTY_FORM: ScheduleForm = { taskName: '', date: '', time: '08:00' };

// --- helpers -----------------------------------------------------------------

function buildTimeSlot(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getDailyRec(day: WeatherDay): string {
  if (day.precipProb > 70) return 'High chance of rain — use indoor drying.';
  if (day.precipProb > 30) return 'Possible rain — schedule with caution.';
  return 'Good drying window — outdoor drying is recommended.';
}

function getWeatherLabel(day: WeatherDay): string {
  if (day.precipProb > 70) return 'Rainy';
  if (day.precipProb > 30) return 'Cloudy';
  return 'Clear';
}

function nextInText(schedules: LaundrySchedule[]): string {
  const now = new Date();
  const upcoming = schedules
    .filter(s => s.status === 'Pending' && isAfter(s.scheduledDate.toDate(), now))
    .sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis());
  if (upcoming.length === 0) return '--';
  const diff = differenceInMinutes(upcoming[0].scheduledDate.toDate(), now);
  if (diff <= 0) return 'now';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// --- main page ----------------------------------------------------------------

export default function SchedulesPage() {
  const { userModel } = useAuth();
  const [schedules, setSchedules] = useState<LaundrySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Completed' | 'Cancelled'>('all');

  // calendar
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // weather
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<LaundrySchedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const familyCode = userModel?.familyCode ?? '';
  const uid = userModel?.uid ?? '';

  // -- real-time schedules ---------------------------------------------------

  useEffect(() => {
    if (!familyCode) return;
    setLoading(true);
    const q = query(
      collection(db, 'laundry_schedules'),
      where('familyCode', '==', familyCode),
      orderBy('scheduledDate', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as LaundrySchedule)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [familyCode]);

  // -- weather (open-meteo, no API key) -------------------------------------

  const fetchWeather = useCallback((lat: number, lon: number) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const days: WeatherDay[] = [0, 1, 2].map(i => ({
          day: format(new Date(data.daily.time[i]), 'EEE').toUpperCase(),
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          precipProb: data.daily.precipitation_probability_max[i] ?? 0,
        }));
        setForecast(days);
        setWeatherLoading(false);
      })
      .catch(() => setWeatherLoading(false));
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeather(3.1390, 101.6869) // fallback: Kuala Lumpur
    );
  }, [fetchWeather]);

  // -- derived stats ---------------------------------------------------------

  const activeCount = schedules.filter(s => s.status === 'Pending').length;
  const completedCount = schedules.filter(s => s.status === 'Completed').length;
  const total = schedules.length;
  const successRate = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const nextIn = nextInText(schedules);
  const isActive = activeCount > 0 || forecast.length > 0;

  // -- calendar helpers ------------------------------------------------------

  function calDays(): Date[] {
    const start = startOfWeek(startOfMonth(calMonth));
    const end = endOfWeek(endOfMonth(calMonth));
    return eachDayOfInterval({ start, end });
  }

  function hasEvent(day: Date): boolean {
    return schedules.some(s => isSameDay(s.scheduledDate.toDate(), day));
  }

  function eventsForDay(day: Date): LaundrySchedule[] {
    return schedules.filter(s => isSameDay(s.scheduledDate.toDate(), day));
  }

  // -- modal helpers ---------------------------------------------------------

  function openAdd(day?: Date) {
    setEditTarget(null);
    setSaveError(null);
    const d = day ?? new Date();
    setForm({
      taskName: '',
      date: format(d, 'yyyy-MM-dd'),
      time: '08:00',
    });
    setShowModal(true);
  }

  function openEdit(s: LaundrySchedule) {
    setEditTarget(s);
    setSaveError(null);
    const d = s.scheduledDate.toDate();
    setForm({
      taskName: s.taskName,
      date: format(d, 'yyyy-MM-dd'),
      time: format(d, 'HH:mm'),
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.taskName || !form.date || !userModel) return;
    if (!familyCode) {
      setSaveError('No family code found. Please re-login.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const localDate = new Date(`${form.date}T${form.time}`);
    const weatherLabel = forecast.length > 0 ? getWeatherLabel(forecast[0]) : 'Clear';
    const payload = {
      userId: uid,
      userName: userModel.name,
      scheduledDate: Timestamp.fromDate(localDate),
      timeSlot: buildTimeSlot(form.date, form.time),
      status: 'Pending',
      taskName: form.taskName.trim(),
      weatherCondition: weatherLabel,
      familyCode,
    };

    try {
      if (editTarget) {
        await updateDoc(doc(db, 'laundry_schedules', editTarget.id), payload);
      } else {
        await addDoc(collection(db, 'laundry_schedules'), payload);
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save schedule. Check your connection.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: 'Completed' | 'Cancelled') {
    await updateDoc(doc(db, 'laundry_schedules', id), { status });
  }

  async function deleteSchedule(id: string) {
    await deleteDoc(doc(db, 'laundry_schedules', id));
  }

  // -- filtered list ---------------------------------------------------------

  const filtered = (() => {
    let list = filter === 'all' ? schedules : schedules.filter(s => s.status === filter);
    if (selectedDay) list = list.filter(s => isSameDay(s.scheduledDate.toDate(), selectedDay));
    return list;
  })();

  // -- render ----------------------------------------------------------------

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Smart Schedule</h1>
            <p className="text-white/40 text-sm mt-0.5">AI-powered laundry scheduling</p>
          </div>
          <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 py-2.5 px-4">
            <Plus size={18} />
            <span className="hidden sm:inline">New Schedule</span>
          </button>
        </div>

        {/* stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={<Bell size={16} className="text-blue-400" />} value={activeCount.toString()} label="Active" />
          <StatTile icon={<Clock size={16} className="text-yellow-400" />} value={nextIn} label="Next In" />
          <StatTile icon={<TrendingUp size={16} className="text-green-400" />} value={`${successRate}%`} label="Success Rate" />
        </div>

        {/* AI recommendations */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase mb-1">Weather Analytics</p>
              <h2 className="text-xl font-extrabold">Smart Reminders</h2>
            </div>
            <span className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase',
              isActive ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/40'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-400' : 'bg-white/30')} />
              {isActive ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          <p className="text-sm text-white/50 leading-relaxed -mt-1">
            Current patterns indicate optimal drying cycles for the next 72 hours. Tap a day on the calendar to secure your spot.
          </p>

          {weatherLoading ? (
            <div className="bg-white/5 rounded-xl p-3 flex items-center gap-2 text-sm text-white/40">
              <Loader2 size={14} className="animate-spin" />
              Analyzing weather patterns for the next 3 days…
            </div>
          ) : forecast.length === 0 ? (
            <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2 text-sm">
              <Sparkles size={14} className="text-violet-400 shrink-0 mt-0.5" />
              <span className="text-white/60">Weather data unavailable — check internet connection.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {forecast.map(day => (
                <div key={day.day} className="bg-white/5 rounded-xl p-3 flex items-start gap-2">
                  <Sparkles size={14} className="text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-sm leading-snug">
                    <span className="font-bold text-white">{day.day} ({day.tempMax}°C / {day.tempMin}°C): </span>
                    <span className="text-white/60">{getDailyRec(day)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* calendar */}
        <div className="card space-y-4">
          <p className="text-[10px] font-black text-white/40 tracking-widest uppercase">Calendar</p>

          {/* month nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCalMonth(m => subMonths(m, 1))}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-sm">{format(calMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCalMonth(m => addMonths(m, 1))}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* day labels */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-white/30 py-1">{d}</div>
            ))}
          </div>

          {/* day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calDays().map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const inMonth = isSameMonth(day, calMonth);
              const hasEv = hasEvent(day);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  onDoubleClick={() => openAdd(day)}
                  title={hasEv ? 'Click to filter · Double-click to add' : 'Double-click to add'}
                  className={clsx(
                    'relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-semibold transition-all',
                    !inMonth && 'opacity-30',
                    isSelected && 'bg-indigo-600 text-white',
                    isToday && !isSelected && 'bg-indigo-600/20 text-indigo-400 font-black',
                    !isSelected && !isToday && 'hover:bg-white/10',
                  )}
                >
                  {format(day, 'd')}
                  {hasEv && (
                    <span className={clsx(
                      'absolute bottom-1 w-1.5 h-1.5 rounded-full',
                      isSelected ? 'bg-white' : 'bg-indigo-500'
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* selected day info */}
          {selectedDay && (
            <div className="flex items-center justify-between bg-indigo-600/10 border border-indigo-600/20 rounded-xl px-4 py-2.5">
              <span className="text-sm font-semibold">
                {format(selectedDay, 'EEEE, MMMM d')} — {eventsForDay(selectedDay).length} schedule(s)
              </span>
              <div className="flex gap-3">
                <button onClick={() => openAdd(selectedDay)}
                  className="text-xs font-bold text-indigo-400 hover:text-white transition-colors flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
                <button onClick={() => setSelectedDay(null)}
                  className="text-xs text-white/40 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'Pending', 'Completed', 'Cancelled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                filter === f ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'
              )}
            >
              {f === 'all' ? 'All' : f}{' '}
              ({f === 'all' ? schedules.length : schedules.filter(s => s.status === f).length})
            </button>
          ))}
          {selectedDay && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600/20 text-violet-400 whitespace-nowrap flex items-center gap-1">
              <CalendarDays size={11} />
              {format(selectedDay, 'MMM d')} filter
            </span>
          )}
        </div>

        {/* schedule list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <CalendarDays size={40} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No schedules found</p>
            <button onClick={() => openAdd(selectedDay ?? undefined)} className="mt-4 btn-primary py-2 px-5 text-sm inline-flex items-center gap-2">
              <Plus size={14} /> Add Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                isOwn={s.userId === uid}
                onComplete={() => updateStatus(s.id, 'Completed')}
                onCancel={() => updateStatus(s.id, 'Cancelled')}
                onDelete={() => deleteSchedule(s.id)}
                onEdit={() => openEdit(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* add/edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1e1b4b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg flex items-center gap-2">
                <CalendarDays size={18} className="text-indigo-400" />
                {editTarget ? 'Update Task' : 'New Task'}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Task name</label>
                <input
                  className="input"
                  placeholder="e.g. Bedsheets, Shirts…"
                  value={form.taskName}
                  onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input
                    type="time"
                    className="input"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {forecast.length > 0 && (
                <div className="bg-white/5 rounded-xl p-3 flex items-center gap-2 text-sm">
                  <Cloud size={14} className="text-blue-400 shrink-0" />
                  <span className="text-white/60">Today: <span className="text-white font-semibold">{getWeatherLabel(forecast[0])}</span> — {getDailyRec(forecast[0])}</span>
                </div>
              )}

              {saveError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || !familyCode} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : editTarget ? <Edit2 size={16} /> : <Plus size={16} />}
                  {saving ? 'Saving…' : editTarget ? 'Update' : 'Add'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary py-2.5 px-5">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// --- stat tile ----------------------------------------------------------------

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card py-4 px-3 flex flex-col items-center gap-1.5">
      {icon}
      <span className="text-2xl font-black tracking-tight">{value}</span>
      <span className="text-[11px] font-bold text-white/40 text-center">{label}</span>
    </div>
  );
}

// --- schedule card ------------------------------------------------------------

function ScheduleCard({
  schedule, isOwn, onComplete, onCancel, onDelete, onEdit,
}: {
  schedule: LaundrySchedule;
  isOwn: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const date = schedule.scheduledDate.toDate();
  const statusStyle: Record<string, string> = {
    Pending:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    Completed: 'text-green-400 bg-green-500/10 border-green-500/20',
    Cancelled: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const isPast = !isAfter(date, new Date()) && schedule.status === 'Pending';

  return (
    <div className={clsx(
      'card py-4 px-5 transition-all',
      isOwn && 'border-indigo-600/20 bg-indigo-600/5',
      isPast && 'opacity-70'
    )}>
      <div className="flex items-start gap-4">
        {/* date block */}
        <div className="shrink-0 w-11 text-center">
          <p className="text-[10px] text-white/40 font-bold uppercase">{format(date, 'MMM')}</p>
          <p className="text-2xl font-black leading-none">{format(date, 'd')}</p>
          <p className="text-[10px] text-white/30">{format(date, 'EEE')}</p>
        </div>

        {/* content */}
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{schedule.taskName || 'Laundry'}</p>
          <p className="text-sm text-white/50 mt-0.5">
            {schedule.userName}
            {isOwn && <span className="text-indigo-400/60 text-xs"> (you)</span>}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-indigo-400 font-bold">
              <Clock size={11} /> {schedule.timeSlot}
            </span>
            {schedule.weatherCondition && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Cloud size={11} /> {schedule.weatherCondition}
              </span>
            )}
          </div>
        </div>

        {/* status badge */}
        <span className={clsx('badge-chip text-xs shrink-0 border', statusStyle[schedule.status] ?? '')}>
          {schedule.status}
        </span>
      </div>

      {/* actions */}
      {isOwn && schedule.status === 'Pending' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8 flex-wrap">
          <button onClick={onComplete} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-bold transition-colors">
            <CheckCircle size={13} /> Done Task
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 font-bold transition-colors">
            <XCircle size={13} /> Cancel
          </button>
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">
            <Edit2 size={13} /> Edit
          </button>
          <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold transition-colors ml-auto">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
      {isOwn && schedule.status !== 'Pending' && (
        <div className="flex mt-3 pt-3 border-t border-white/8">
          <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold transition-colors ml-auto">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
