'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { WashingMachine, Mail, ArrowLeft, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { auth } from '@/lib/firebase';

type Step = 'form' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('user-not-found') || msg.includes('invalid-email')) {
        setError('No account found with this email address.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.5s ease both' }}>

      {/* Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb-1 absolute -top-32 -left-32 h-80 w-80 rounded-full bg-violet-600/18 blur-3xl" />
        <div className="orb-2 absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/16 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10" style={{ animation: 'fadeInUp 0.4s ease both' }}>
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl bg-violet-600/25 blur-xl scale-110" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/35">
              <WashingMachine size={30} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight gradient-text">HydroHang</h1>
          <p className="text-white/40 mt-1 text-sm font-medium flex items-center gap-1.5">
            <Sparkles size={12} className="text-violet-400" /> Smart laundry management
          </p>
        </div>

        {step === 'form' ? (
          <div
            className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40 p-8"
            style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
          >
            <div className="pointer-events-none absolute -top-14 -right-14 h-40 w-40 rounded-full bg-violet-600/8 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/25">
                  <Mail size={22} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black">Reset Password</h2>
                  <p className="text-white/40 text-sm">We&apos;ll send you a reset link</p>
                </div>
              </div>

              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
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

                {error && (
                  <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2" style={{ animation: 'shakeX 0.4s ease both' }}>
                    <span className="font-black text-base text-red-500">!</span>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-7 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40 p-10 text-center"
            style={{ animation: 'scaleIn 0.4s ease both' }}
          >
            <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-emerald-600/10 blur-2xl" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl scale-110" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-green-600/10 border border-emerald-500/25">
                    <CheckCircle size={40} className="text-emerald-400" />
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-black mb-1">Check Your Email</h2>
              <p className="text-white/40 text-sm mb-6">Reset link sent successfully</p>

              <p className="text-white/50 text-sm mb-2">We&apos;ve sent a password reset link to:</p>
              <p className="text-violet-300 font-bold mb-8 break-all text-lg">{email}</p>

              <p className="text-white/35 text-xs mb-7">
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => { setStep('form'); setError(''); }}
                  className="text-violet-400 hover:text-violet-300 font-semibold underline transition-colors"
                >
                  try again
                </button>
                .
              </p>

              <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2 py-3.5">
                <ArrowLeft size={16} />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
