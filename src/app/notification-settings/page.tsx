'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { NotificationPreferences } from '@/lib/types';
import { Bell, Mail, CloudRain, Clock, Loader2 } from 'lucide-react';

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
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // swallow
    } finally {
      setSaving(false);
    }
  };

  const settings: {
    key: keyof Pick<NotificationPreferences, 'pushEnabled' | 'emailEnabled' | 'rainAlerts' | 'queueAlerts'>;
    icon: React.ReactNode;
    label: string;
    description: string;
  }[] = [
    {
      key: 'pushEnabled',
      icon: <Bell size={18} className="text-primary-light" />,
      label: 'Push Notifications',
      description: 'Receive real-time alerts on this device',
    },
    {
      key: 'emailEnabled',
      icon: <Mail size={18} className="text-blue-400" />,
      label: 'Email Notifications',
      description: 'Get summaries and alerts via email',
    },
    {
      key: 'rainAlerts',
      icon: <CloudRain size={18} className="text-cyan-400" />,
      label: 'Rain Alerts',
      description: 'Notify when rain is detected by the sensor',
    },
    {
      key: 'queueAlerts',
      icon: <Bell size={18} className="text-yellow-400" />,
      label: 'Queue Alerts',
      description: 'Notify when your laundry session is ready or complete',
    },
  ];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Notification Settings</h1>
          <p className="text-white/50 text-sm mt-1">
            Control when and how you receive notifications.
          </p>
        </div>

        {/* Toggle settings */}
        <div className="card space-y-1">
          <h2 className="font-bold mb-4">Alert Preferences</h2>
          {settings.map(({ key, icon, label, description }, i) => (
            <div key={key}>
              {i > 0 && <div className="border-t border-white/5 my-1" />}
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-4 py-3 hover:bg-white/5 rounded-xl px-2 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-white/40 text-xs">{description}</p>
                </div>
                {/* Toggle pill */}
                <div
                  className={`w-11 h-6 rounded-full transition-colors shrink-0 ${
                    prefs[key] ? 'bg-primary' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-transform ${
                      prefs[key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Quiet hours */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <Clock size={18} className="text-white/60" />
            </div>
            <div>
              <h2 className="font-bold">Quiet Hours</h2>
              <p className="text-white/40 text-xs">Suppress notifications during this window</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start time</label>
              <input
                type="time"
                className="input"
                value={prefs.quietHoursStart}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, quietHoursStart: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">End time</label>
              <input
                type="time"
                className="input"
                value={prefs.quietHoursEnd}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, quietHoursEnd: e.target.value }))
                }
              />
            </div>
          </div>

          <p className="text-white/30 text-xs mt-3">
            Notifications will be silenced from{' '}
            <span className="text-white/60">{prefs.quietHoursStart}</span> to{' '}
            <span className="text-white/60">{prefs.quietHoursEnd}</span>.
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </AppShell>
  );
}
