'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { NotificationPreferences } from '@/lib/types';
import { Bell, Mail, CloudRain, Clock, Loader2, Settings, Check } from 'lucide-react';
import { clsx } from 'clsx';

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  rainAlerts: true,
  queueAlerts: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

export default function NotificationSettingsPage() {
  const { userModel } = useAuth();
  const { updatePreferences } = useNotification();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userModel?.notificationPreferences) {
      setPrefs({ ...DEFAULT_PREFS, ...userModel.notificationPreferences });
    }
  }, [userModel]);

  const toggle = (key: keyof Pick<NotificationPreferences, 'pushEnabled' | 'emailEnabled' | 'rainAlerts' | 'queueAlerts'>) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* swallow */ } finally { setSaving(false); }
  };

  const toggleSettings: {
    key: keyof Pick<NotificationPreferences, 'pushEnabled' | 'emailEnabled' | 'rainAlerts' | 'queueAlerts'>;
    icon: React.ReactNode;
    label: string;
    description: string;
    accent: string;
  }[] = [
    { key: 'pushEnabled', icon: <Bell size={17} />, label: 'Push Notifications', description: 'Real-time alerts on this device', accent: '#8B5CF6' },
    { key: 'emailEnabled', icon: <Mail size={17} />, label: 'Email Notifications', description: 'Summaries and alerts via email', accent: '#3B82F6' },
    { key: 'rainAlerts', icon: <CloudRain size={17} />, label: 'Rain Alerts', description: 'Notify when rain is detected by sensor', accent: '#06B6D4' },
    { key: 'queueAlerts', icon: <Bell size={17} />, label: 'Queue Alerts', description: 'Notify when your laundry session is ready', accent: '#F59E0B' },
  ];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20">
            <Settings size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Notification Settings</h1>
            <p className="text-white/35 text-sm font-medium mt-0.5">Control when and how you receive notifications</p>
          </div>
        </div>

        {/* ── Toggle list ── */}
        <div className="card">
          <h2 className="font-black mb-5 flex items-center gap-2">
            <span>Alert Preferences</span>
          </h2>
          <div className="space-y-1">
            {toggleSettings.map(({ key, icon, label, description, accent }, i) => {
              const isOn = prefs[key];
              return (
                <div key={key}>
                  {i > 0 && <div className="h-px bg-white/[0.05] my-1" />}
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-4 py-3.5 px-2 rounded-2xl hover:bg-white/[0.04] transition-all text-left group"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all"
                      style={{ background: isOn ? `${accent}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${isOn ? `${accent}30` : 'rgba(255,255,255,0.07)'}`, color: isOn ? accent : 'rgba(255,255,255,0.3)' }}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-white/35 text-xs mt-0.5 font-medium">{description}</p>
                    </div>
                    {/* Premium toggle */}
                    <div
                      className="relative w-12 h-6 rounded-full shrink-0 transition-all duration-300"
                      style={{ background: isOn ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : 'rgba(255,255,255,0.1)', boxShadow: isOn ? `0 0 10px ${accent}40` : undefined }}
                    >
                      <div
                        className="absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-md transition-transform duration-300"
                        style={{ transform: isOn ? 'translateX(24px)' : 'translateX(2px)' }}
                      />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Quiet hours ── */}
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
              <Clock size={17} className="text-white/50" />
            </div>
            <div>
              <h2 className="font-black">Quiet Hours</h2>
              <p className="text-white/35 text-xs font-medium mt-0.5">Suppress notifications during this window</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start time</label>
              <input
                type="time"
                className="input"
                value={prefs.quietHoursStart}
                onChange={(e) => setPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End time</label>
              <input
                type="time"
                className="input"
                value={prefs.quietHoursEnd}
                onChange={(e) => setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
            <Clock size={13} className="text-white/30 shrink-0" />
            <p className="text-white/30 text-xs font-medium">
              Notifications silenced from{' '}
              <span className="text-white/60 font-bold">{prefs.quietHoursStart}</span>
              {' '}to{' '}
              <span className="text-white/60 font-bold">{prefs.quietHoursEnd}</span>
            </p>
          </div>
        </div>

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all active:scale-95',
            saved
              ? 'bg-emerald-600/80 text-white border border-emerald-500/30'
              : 'btn-primary'
          )}
        >
          {saving ? <Loader2 size={17} className="animate-spin" /> : saved ? <Check size={17} /> : null}
          {saved ? 'Settings Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </AppShell>
  );
}
