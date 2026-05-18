'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WashingMachine, Eye, EyeOff, Loader2 } from 'lucide-react';
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

    if (password !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (role === 'Secondary') {
      if (!familyCode.trim()) {
        setError('Please enter a family code.');
        return;
      }
      // Verify family code exists
      const q = query(collection(db, 'users'), where('familyCode', '==', familyCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError('Family code not found. Please check and try again.');
        return;
      }
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/40">
            <WashingMachine size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">HydroHang</h1>
          <p className="text-white/50 mt-1 text-sm">Create your account</p>
        </div>

        <div className="card shadow-2xl shadow-black/40">
          <h2 className="text-xl font-bold mb-6">Join HydroHang</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="Alex Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
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
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="Re-enter password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Role */}
            <div>
              <label className="label">Account type</label>
              <div className="grid grid-cols-2 gap-3">
                {(['Primary', 'Secondary'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 px-4 rounded-xl text-sm font-bold border transition-all ${
                      role === r
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
                    }`}
                  >
                    {r === 'Primary' ? '👑 Primary' : '👤 Secondary'}
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2">
                {role === 'Primary'
                  ? 'Creates a new family group — a code will be generated for you.'
                  : 'Joins an existing family group using a code.'}
              </p>
            </div>

            {/* Family code (secondary only) */}
            {role === 'Secondary' && (
              <div>
                <label className="label">Family code</label>
                <input
                  type="text"
                  className="input uppercase tracking-widest font-mono"
                  placeholder="ABC123"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-light hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
