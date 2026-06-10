'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Crown, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<'Primary' | 'Secondary'>('Primary');
  const [familyCode, setFamilyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    if (role === 'Secondary') {
      if (!familyCode.trim()) { setError('Please enter a family code.'); return; }
      const q = query(collection(db, 'users'), where('familyCode', '==', familyCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Family code not found. Please check and try again.'); return; }
    }

    setLoading(true);
    try {
      await register(email, password, name, role, familyCode.trim().toUpperCase() || undefined);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('email-already-in-use')) {
        setError('An account already exists with this email.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 py-10" style={{ animation: 'fadeIn 0.5s ease both' }}>

      {/* Animated orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb-1 absolute -top-32 -right-32 h-80 w-80 rounded-full bg-violet-600/18 blur-3xl" />
        <div className="orb-2 absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/16 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8" style={{ animation: 'fadeInUp 0.4s ease both' }}>
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl bg-violet-600/20 blur-xl scale-110" />
            <Image src="/logo.png" alt="HydroHang" width={80} height={80} className="relative rounded-3xl shadow-2xl shadow-violet-500/25" />
          </div>
          <h1 className="text-3xl font-black tracking-tight gradient-text">HydroHang</h1>
          <p className="text-white/40 mt-1 text-sm font-medium flex items-center gap-1.5">
            <Sparkles size={12} className="text-violet-400" /> Create your account
          </p>
        </div>

        {/* Card */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40 p-8"
          style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
        >
          <div className="pointer-events-none absolute -top-14 -left-14 h-40 w-40 rounded-full bg-violet-600/8 blur-2xl" />

          <div className="relative">
            <h2 className="text-2xl font-black mb-1">Join HydroHang</h2>
            <p className="text-white/40 text-sm mb-7">Fill in the details below to get started</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="label">Full name</label>
                <input type="text" className="input" placeholder="Alex Smith" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              {/* Email */}
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              {/* Password */}
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input pr-12"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="label">Confirm password</label>
                <input type="password" className="input" placeholder="Re-enter password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required autoComplete="new-password" />
              </div>

              {/* Role selector */}
              <div>
                <label className="label">Account type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Primary', 'Secondary'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`relative flex flex-col items-center gap-2 py-4 px-3 rounded-2xl text-sm font-bold border transition-all duration-200 ${
                        role === r
                          ? 'bg-gradient-to-b from-violet-600/30 to-indigo-600/20 border-violet-500/50 text-white shadow-lg shadow-violet-500/15'
                          : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/70'
                      }`}
                    >
                      {r === 'Primary' ? (
                        <Crown size={22} className={role === r ? 'text-yellow-400' : 'text-white/30'} />
                      ) : (
                        <User size={22} className={role === r ? 'text-violet-300' : 'text-white/30'} />
                      )}
                      {r}
                      {role === r && (
                        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-violet-400" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-white/30 text-xs mt-2.5 px-0.5">
                  {role === 'Primary'
                    ? 'Creates a new family group — a unique code is generated for you.'
                    : 'Joins an existing family group using a shared code.'}
                </p>
              </div>

              {/* Family code input for Secondary */}
              {role === 'Secondary' && (
                <div style={{ animation: 'fadeInUp 0.3s ease both' }}>
                  <label className="label">Family code</label>
                  <input
                    type="text"
                    className="input uppercase tracking-[0.3em] font-mono text-center text-lg"
                    placeholder="ABC123"
                    value={familyCode}
                    onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2" style={{ animation: 'shakeX 0.4s ease both' }}>
                  <span className="text-red-500 font-black text-base">!</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-white/25 text-xs font-semibold">HAVE AN ACCOUNT?</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            <Link
              href="/login"
              className="flex items-center justify-center w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-sm font-bold text-white/70 hover:text-white transition-all duration-200"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
