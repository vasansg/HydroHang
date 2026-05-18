'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { Loader2, User, Copy, CheckCheck, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { userModel, logout } = useAuth();
  const [name, setName] = useState(userModel?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModel || !name.trim()) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', userModel.uid), { name: name.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyCode = () => {
    if (!userModel?.familyCode) return;
    navigator.clipboard.writeText(userModel.familyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-black">Profile</h1>

        {/* Avatar + info */}
        <div className="card flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shrink-0">
            <User size={28} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-black">{userModel?.name}</p>
            <p className="text-white/50 text-sm">{userModel?.email}</p>
            <span className="badge-chip mt-1.5">
              {userModel?.role === 'Primary' ? '👑' : '👤'} {userModel?.role} Account
            </span>
          </div>
        </div>

        {/* Edit name */}
        <div className="card">
          <h2 className="font-bold mb-4">Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Display name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Email address</label>
              <input
                className="input opacity-50 cursor-not-allowed"
                value={userModel?.email ?? ''}
                disabled
              />
              <p className="text-white/30 text-xs mt-1">Email cannot be changed here.</p>
            </div>
            <button
              type="submit"
              disabled={saving || saved}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Family code */}
        {userModel?.familyCode && (
          <div className="card">
            <h2 className="font-bold mb-4">Family Group</h2>
            <p className="text-white/50 text-sm mb-3">
              Share this code with family members so they can join your group.
            </p>
            <div className="flex items-center gap-4 bg-white/5 rounded-xl px-5 py-4">
              <p className="text-3xl font-black tracking-[0.35em] text-primary-light flex-1">
                {userModel.familyCode}
              </p>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
              >
                {copied ? <CheckCheck size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Notification preferences */}
        {userModel?.notificationPreferences && (
          <div className="card">
            <h2 className="font-bold mb-4">Notification Preferences</h2>
            <div className="space-y-3">
              {(
                [
                  ['rainAlerts', '🌧️ Rain alerts'],
                  ['queueAlerts', '🔔 Queue alerts'],
                  ['pushEnabled', '📱 Push notifications'],
                  ['emailEnabled', '📧 Email notifications'],
                ] as [keyof typeof userModel.notificationPreferences, string][]
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{label}</p>
                  <div
                    className={`w-10 h-5 rounded-full transition-all ${
                      userModel.notificationPreferences?.[key]
                        ? 'bg-primary'
                        : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${
                        userModel.notificationPreferences?.[key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold transition-all"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </AppShell>
  );
}
