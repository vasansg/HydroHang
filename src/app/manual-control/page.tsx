'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useRainSensor } from '@/context/RainSensorContext';
import { useAuth } from '@/context/AuthContext';
import {
  Wifi,
  WifiOff,
  CloudRain,
  Sun,
  Loader2,
  RotateCcw,
  ArrowDown,
  ShieldAlert,
  Settings,
} from 'lucide-react';

// Only the owner can send servo commands
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

    // Animate progress bar
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + 10;
      });
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
      setTimeout(() => {
        setActiveAction(null);
        setProgress(0);
        setStatus('');
      }, 2000);
    }
  }

  const conditionColor =
    sensorData?.condition === 'WET'
      ? 'text-blue-400'
      : sensorData?.condition === 'DRY'
      ? 'text-green-400'
      : 'text-white/40';

  const conditionLabel =
    sensorData?.condition === 'WET'
      ? 'WET — Rain detected'
      : sensorData?.condition === 'DRY'
      ? 'DRY — No rain'
      : 'UNKNOWN';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Manual Control</h1>
          <p className="text-white/50 text-sm mt-1">
            Arduino rain sensor and servo controller
          </p>
        </div>

        {/* Device status */}
        <div className="card flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              deviceOnline ? 'bg-green-500/20' : 'bg-red-500/10'
            }`}
          >
            {deviceOnline ? (
              <Wifi size={22} className="text-green-400" />
            ) : (
              <WifiOff size={22} className="text-red-400" />
            )}
          </div>
          <div>
            <p className="font-bold">{deviceOnline ? 'Device Online' : 'Device Offline'}</p>
            <p className="text-white/40 text-xs">
              {deviceOnline
                ? 'Connected to rain sensor'
                : 'No recent data from sensor'}
            </p>
          </div>
          <div className="ml-auto">
            <div
              className={`w-3 h-3 rounded-full ${
                deviceOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500/60'
              }`}
            />
          </div>
        </div>

        {/* Sensor readings */}
        {sensorData && (
          <div className="card">
            <h2 className="font-bold mb-4">Sensor Readings</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-white/40 text-xs mb-1">Condition</p>
                <div className={`font-black text-sm ${conditionColor}`}>
                  {sensorData.condition === 'WET' ? (
                    <CloudRain size={20} className="mx-auto mb-1" />
                  ) : (
                    <Sun size={20} className="mx-auto mb-1 text-yellow-400" />
                  )}
                  {conditionLabel}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-white/40 text-xs mb-1">Raw Value</p>
                <p className="font-black text-xl">{sensorData.value}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-white/40 text-xs mb-1">Servo Angle</p>
                <p className="font-black text-xl">{sensorData.servoPosition}°</p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isOwner ? (
          <div className="card space-y-4">
            <h2 className="font-bold">Servo Commands</h2>
            <p className="text-white/40 text-xs -mt-2">
              Commands are sent directly to the Arduino via Firebase RTDB.
            </p>

            {/* Progress bar */}
            {activeAction && (
              <div className="space-y-1">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-white/50 text-xs">{status}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!!activeAction || !deviceOnline}
                onClick={() =>
                  runAction('auto', () => setAutoMode(0, 150), 'Auto mode restored')
                }
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeAction === 'auto' ? (
                  <Loader2 size={22} className="animate-spin text-primary-light" />
                ) : (
                  <RotateCcw size={22} className="text-primary-light" />
                )}
                <span className="text-sm font-bold">Auto Mode</span>
                <span className="text-[10px] text-white/40 text-center">Let Arduino decide</span>
              </button>

              <button
                disabled={!!activeAction || !deviceOnline}
                onClick={() =>
                  runAction('outside', () => sendCommand(150), 'Moved outside')
                }
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeAction === 'outside' ? (
                  <Loader2 size={22} className="animate-spin text-yellow-400" />
                ) : (
                  <Sun size={22} className="text-yellow-400" />
                )}
                <span className="text-sm font-bold">Bring Outside</span>
                <span className="text-[10px] text-white/40 text-center">Servo → 150°</span>
              </button>

              <button
                disabled={!!activeAction || !deviceOnline}
                onClick={() =>
                  runAction('retrieve', () => sendCommand(0), 'Clothes retrieved')
                }
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeAction === 'retrieve' ? (
                  <Loader2 size={22} className="animate-spin text-blue-400" />
                ) : (
                  <ArrowDown size={22} className="text-blue-400" />
                )}
                <span className="text-sm font-bold">Retrieve</span>
                <span className="text-[10px] text-white/40 text-center">Servo → 0°</span>
              </button>

              <button
                disabled={!!activeAction || !deviceOnline}
                onClick={() =>
                  runAction('stop', () => sendCommand(90), 'Emergency stop')
                }
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeAction === 'stop' ? (
                  <Loader2 size={22} className="animate-spin text-red-400" />
                ) : (
                  <ShieldAlert size={22} className="text-red-400" />
                )}
                <span className="text-sm font-bold text-red-400">Emergency Stop</span>
                <span className="text-[10px] text-red-400/60 text-center">Servo → 90°</span>
              </button>
            </div>

            {!deviceOnline && (
              <p className="text-yellow-400/80 text-xs text-center bg-yellow-500/10 rounded-xl py-2 px-4">
                Commands are disabled while the device is offline.
              </p>
            )}
          </div>
        ) : (
          <div className="card flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Settings size={20} className="text-white/40" />
            </div>
            <div>
              <p className="font-bold">View Only</p>
              <p className="text-white/40 text-sm mt-0.5">
                Only the device owner can send servo commands. You can view the live sensor
                readings above.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
