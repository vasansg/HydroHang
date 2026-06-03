'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useRainSensor } from '@/context/RainSensorContext';
import { useAuth } from '@/context/AuthContext';
import { Wifi, WifiOff, CloudRain, Sun, Loader2, RotateCcw, ArrowDown, ShieldAlert, Settings, Cpu, Activity } from 'lucide-react';
import { clsx } from 'clsx';

const OWNER_EMAIL = 'vasanthavanan12@gmail.com';
type Action = 'auto' | 'outside' | 'retrieve' | 'stop' | null;

export default function ManualControlPage() {
  const { userModel } = useAuth();
  const { sensorData, deviceOnline, sendCommand, setAutoMode } = useRainSensor();
  const [activeAction, setActiveAction] = useState<Action>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const isOwner = userModel?.email === OWNER_EMAIL;

  async function runAction(action: Action, fn: () => Promise<void>, label: string) {
    if (!isOwner) return;
    setActiveAction(action);
    setProgress(0);
    setStatus(`${label}…`);

    const interval = setInterval(() => {
      setProgress((p) => { if (p >= 90) { clearInterval(interval); return 90; } return p + 10; });
    }, 150);

    try {
      await fn();
      clearInterval(interval);
      setProgress(100);
      setStatus(`${label} complete!`);
    } catch {
      clearInterval(interval);
      setProgress(0);
      setStatus('Command failed. Is the device online?');
    } finally {
      setTimeout(() => { setActiveAction(null); setProgress(0); setStatus(''); }, 2200);
    }
  }

  const isWet = sensorData?.condition === 'WET';
  const isDry = sensorData?.condition === 'DRY';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20">
            <Cpu size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Manual Control</h1>
            <p className="text-white/35 text-sm font-medium mt-0.5">Arduino rain sensor & servo controller</p>
          </div>
        </div>

        {/* ── Device status ── */}
        <div className={clsx(
          'relative overflow-hidden rounded-2xl border p-5 transition-all',
          deviceOnline ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20'
        )}>
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-30"
            style={{ background: deviceOnline ? '#10B981' : '#EF4444' }} />
          <div className="relative flex items-center gap-4">
            <div className={clsx(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
              deviceOnline ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-red-500/12 border-red-500/20'
            )}>
              {deviceOnline
                ? <Wifi size={24} className="text-emerald-400" />
                : <WifiOff size={24} className="text-red-400" />}
            </div>
            <div className="flex-1">
              <p className="font-black text-base">{deviceOnline ? 'Device Online' : 'Device Offline'}</p>
              <p className="text-white/40 text-sm font-medium mt-0.5">
                {deviceOnline ? 'Connected to rain sensor' : 'No recent data from sensor'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={clsx(
                'h-2.5 w-2.5 rounded-full',
                deviceOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500/60'
              )} />
              <span className={clsx('text-xs font-black', deviceOnline ? 'text-emerald-400' : 'text-red-400')}>
                {deviceOnline ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Sensor readings ── */}
        {sensorData ? (
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/20">
                <Activity size={15} className="text-violet-400" />
              </div>
              <h2 className="font-black">Sensor Readings</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Condition */}
              <div className={clsx(
                'flex flex-col items-center gap-2.5 rounded-2xl border p-4',
                isWet ? 'bg-blue-500/8 border-blue-500/20' : isDry ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/[0.04] border-white/[0.07]'
              )}>
                {isWet
                  ? <CloudRain size={22} className="text-blue-400" />
                  : <Sun size={22} className="text-yellow-400" />}
                <div className="text-center">
                  <p className={clsx('font-black text-sm', isWet ? 'text-blue-400' : isDry ? 'text-emerald-400' : 'text-white/40')}>
                    {sensorData.condition}
                  </p>
                  <p className="text-[10px] text-white/30 font-semibold mt-0.5">
                    {isWet ? 'Rain detected' : isDry ? 'No rain' : 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Raw value */}
              <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                <div className="text-2xl font-black text-white">{sensorData.value}</div>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Raw Value</p>
              </div>

              {/* Servo angle */}
              <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                <div className="text-2xl font-black text-violet-300">{sensorData.servoPosition}°</div>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Servo Angle</p>
              </div>
            </div>
          </div>
        ) : deviceOnline ? (
          <div className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ) : null}

        {/* ── Commands ── */}
        {isOwner ? (
          <div className="card space-y-5">
            <div>
              <h2 className="font-black">Servo Commands</h2>
              <p className="text-white/35 text-xs font-medium mt-1">Commands sent directly to Arduino via Firebase RTDB</p>
            </div>

            {/* Progress bar */}
            {activeAction && (
              <div className="space-y-2" style={{ animation: 'fadeInUp 0.3s ease both' }}>
                <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }}
                  />
                </div>
                <p className="text-white/40 text-xs font-semibold">{status}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  action: 'auto' as Action,
                  icon: <RotateCcw size={24} />,
                  label: 'Auto Mode',
                  sub: 'Let Arduino decide',
                  color: '#818CF8',
                  bg: 'from-indigo-500/12 to-violet-500/6',
                  border: 'border-indigo-500/20',
                  fn: () => setAutoMode(0, 150),
                },
                {
                  action: 'outside' as Action,
                  icon: <Sun size={24} />,
                  label: 'Bring Outside',
                  sub: 'Servo → 150°',
                  color: '#FBBF24',
                  bg: 'from-yellow-500/12 to-amber-500/6',
                  border: 'border-yellow-500/20',
                  fn: () => sendCommand(150),
                },
                {
                  action: 'retrieve' as Action,
                  icon: <ArrowDown size={24} />,
                  label: 'Retrieve',
                  sub: 'Servo → 0°',
                  color: '#60A5FA',
                  bg: 'from-blue-500/12 to-sky-500/6',
                  border: 'border-blue-500/20',
                  fn: () => sendCommand(0),
                },
                {
                  action: 'stop' as Action,
                  icon: <ShieldAlert size={24} />,
                  label: 'Emergency Stop',
                  sub: 'Servo → 90°',
                  color: '#F87171',
                  bg: 'from-red-500/15 to-red-600/8',
                  border: 'border-red-500/25',
                  fn: () => sendCommand(90),
                },
              ].map(({ action, icon, label, sub, color, bg, border, fn }) => {
                const isActive = activeAction === action;
                return (
                  <button
                    key={action}
                    disabled={!!activeAction || !deviceOnline}
                    onClick={() => runAction(action, fn, label)}
                    className={clsx(
                      'group flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border bg-gradient-to-b transition-all duration-200 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed',
                      bg, border,
                      !activeAction && deviceOnline && 'hover:-translate-y-0.5 hover:shadow-lg'
                    )}
                    style={{ '--hover-shadow': `0 8px 24px ${color}20` } as React.CSSProperties}
                  >
                    <div style={{ color: isActive ? '#ffffff' : color }}>
                      {isActive ? <Loader2 size={24} className="animate-spin" /> : icon}
                    </div>
                    <p className="text-sm font-black" style={{ color: isActive ? '#fff' : color }}>{label}</p>
                    <p className="text-[10px] text-white/30 font-semibold">{sub}</p>
                  </button>
                );
              })}
            </div>

            {!deviceOnline && (
              <div className="flex items-center gap-2.5 bg-amber-500/8 border border-amber-500/18 rounded-xl px-4 py-3">
                <WifiOff size={14} className="text-amber-400 shrink-0" />
                <p className="text-amber-400/80 text-xs font-semibold">Commands disabled while the device is offline</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.07] shrink-0">
              <Settings size={20} className="text-white/35" />
            </div>
            <div>
              <p className="font-black mb-1">View Only Mode</p>
              <p className="text-white/40 text-sm font-medium leading-relaxed">
                Only the device owner can send servo commands. You can view the live sensor readings above.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
