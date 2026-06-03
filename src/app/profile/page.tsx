'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import { Loader2, Copy, Check, LogOut, Crown, User, Shield, Bell, Mail, CloudRain, Edit3, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function ProfilePage() {
  const { userModel, logout } = useAuth();
  const [name, setName] = useState(userModel?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (userModel?.name) setName(userModel.name);
  }, [userModel?.name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModel || !name.trim()) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', userModel.uid), { name: name.trim() });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const copyCode = () => {
    if (!userModel?.familyCode) return;
    navigator.clipboard.writeText(userModel.familyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPrimary = userModel?.role === 'Primary';
  const initials = (userModel?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Profile hero ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-900/25 via-indigo-900/15 to-transparent p-7">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-2xl shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: '2px solid rgba(139,92,246,0.4)' }}>
                {initials}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface border-2 border-white/10">
                {isPrimary ? <Crown size={12} className="text-yellow-400" /> : <User size={12} className="text-violet-300" />}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black truncate">{userModel?.name ?? 'Loading…'}</h1>
                {saved && <CheckCircle size={16} className="text-emerald-400 shrink-0" style={{ animation: 'scaleIn 0.3s ease both' }} />}
              </div>
              <p className="text-white/40 text-sm truncate mb-2.5">{userModel?.email}</p>
              <span className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border',
                isPrimary
                  ? 'bg-yellow-500/12 border-yellow-500/25 text-yellow-400'
                  : 'bg-violet-500/12 border-violet-500/25 text-violet-300'
              )}>
                {isPrimary ? <Crown size={10} /> : <User size={10} />}
                {userModel?.role} Account
              </span>
            </div>
          </div>
        </div>

        {/* ── Edit name ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/20">
                <Edit3 size={14} className="text-violet-400" />
              </div>
              <h2 className="font-black">Edit Profile</h2>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-bold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-3 py-1.5 rounded-xl transition-all"
              >
                Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Display name</label>
              <input
                className={clsx('input', !editing && 'opacity-60 cursor-not-allowed')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!editing}
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Email address</label>
              <input
                className="input opacity-40 cursor-not-allowed"
                value={userModel?.email ?? ''}
                disabled
              />
              <p className="text-white/25 text-xs mt-1.5 font-medium">Email cannot be changed here.</p>
            </div>

            {editing && (
              <div className="flex gap-3 pt-1" style={{ animation: 'fadeInUp 0.3s ease both' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 py-2.5 px-5"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setName(userModel?.name ?? ''); }}
                  className="btn-secondary py-2.5 px-5"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── Family code ── */}
        {userModel?.familyCode && (
          <div className="card border-violet-500/15">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/20">
                <Shield size={14} className="text-violet-400" />
              </div>
              <h2 className="font-black">Family Group</h2>
            </div>

            <p className="text-white/40 text-sm mb-4 font-medium">
              Share this code with family members so they can join your group.
            </p>

            <div className="flex items-center gap-4 bg-white/[0.04] border border-violet-500/15 rounded-2xl px-5 py-4">
              <div className="flex gap-1.5 flex-1">
                {userModel.familyCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="inline-flex h-10 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] text-lg font-black gradient-text"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={copyCode}
                className={clsx(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 active:scale-95 shrink-0',
                  copied
                    ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/20'
                    : 'bg-violet-500/12 text-violet-300 border border-violet-500/20 hover:bg-violet-500/22'
                )}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* ── Notification preferences ── */}
        {userModel?.notificationPreferences && (
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/12 border border-indigo-500/20">
                <Bell size={14} className="text-indigo-400" />
              </div>
              <h2 className="font-black">Notification Preferences</h2>
            </div>

            <div className="space-y-1">
              {(
                [
                  ['rainAlerts', <CloudRain key="rain" size={15} className="text-cyan-400" />, 'Rain alerts'],
                  ['queueAlerts', <Bell key="queue" size={15} className="text-yellow-400" />, 'Queue alerts'],
                  ['pushEnabled', <Bell key="push" size={15} className="text-violet-400" />, 'Push notifications'],
                  ['emailEnabled', <Mail key="email" size={15} className="text-blue-400" />, 'Email notifications'],
                ] as [keyof typeof userModel.notificationPreferences, React.ReactNode, string][]
              ).map(([key, icon, label]) => {
                const isOn = !!userModel.notificationPreferences?.[key];
                return (
                  <div key={key} className="flex items-center gap-4 py-3.5 px-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.07]">
                      {icon}
                    </div>
                    <p className="text-sm font-semibold flex-1">{label}</p>
                    {/* Read-only indicator */}
                    <div className={clsx(
                      'w-11 h-6 rounded-full shrink-0 relative',
                      isOn ? 'bg-violet-600' : 'bg-white/15'
                    )}>
                      <div className={clsx(
                        'absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform duration-200',
                        isOn ? 'translate-x-5' : 'translate-x-0.5'
                      )} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-white/20 text-xs mt-3 px-2 font-medium">Manage notifications in Settings → Notif.</p>
          </div>
        )}

        {/* ── Sign out ── */}
        <button
          onClick={logout}
          className="btn-danger w-full flex items-center justify-center gap-2 py-3.5"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </AppShell>
  );
}
