'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { WashingMachine, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/40">
            <WashingMachine size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">HydroHang</h1>
          <p className="text-white/50 mt-1 text-sm">Smart laundry management</p>
        </div>

        {step === 'form' ? (
          <div className="card shadow-2xl shadow-black/40">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Mail size={20} className="text-primary-light" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Reset Password</h2>
                <p className="text-white/40 text-sm">We&apos;ll send you a reset link</p>
              </div>
            </div>

            <p className="text-white/60 text-sm mb-6">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-white/40 text-sm mt-6">
              <Link
                href="/login"
                className="text-primary-light hover:underline font-semibold inline-flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </p>
          </div>
        ) : (
          <div className="card shadow-2xl shadow-black/40 text-center">
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={36} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Check Your Email</h2>
                <p className="text-white/40 text-sm mt-1">Reset link sent successfully</p>
              </div>
            </div>

            <p className="text-white/60 text-sm mb-2">
              We&apos;ve sent a password reset link to:
            </p>
            <p className="text-primary-light font-semibold mb-6 break-all">{email}</p>

            <p className="text-white/50 text-xs mb-6">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setStep('form');
                  setError('');
                }}
                className="text-primary-light hover:underline"
              >
                try again
              </button>
              .
            </p>

            <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2">
              <ArrowLeft size={16} />
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
