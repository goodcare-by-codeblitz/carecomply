'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { Field } from '@/components/auth/field';
import { Container } from '@/components/marketing/ui/container';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
      <Container className="w-full">
      <div className="w-full max-w-md">
        {success ? (
          <div className="rounded-2xl border border-line bg-white p-8 shadow-card text-center">
            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center">
              <Mail size={24} style={{ width: 24, height: 24 }} />
            </div>
            <h1 className="text-[24px] font-semibold tracking-ultratight text-ink">Check your email</h1>
            <p className="mt-3 text-[14.5px] text-slate-600 leading-[1.6]">
              If you registered with your email and password, you will receive a password reset link shortly.
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex items-center gap-2 text-[14px] text-brand-700 hover:text-brand-800 font-medium">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
            <h1 className="text-[28px] font-semibold tracking-ultratight text-ink">Reset your password.</h1>
            <p className="mt-2 text-[14.5px] text-slate-600">
              Enter your work email and we'll send you a reset link.
            </p>
            <form className="mt-8 space-y-4" onSubmit={handleForgotPassword}>
              <Field
                label="Work email"
                type="email"
                placeholder="you@youragency.co.uk"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && (
                <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                {isLoading ? 'Sending…' : (
                  <>Send reset email <ArrowRight size={15} style={{ width: 15, height: 15 }} /></>
                )}
              </button>
              <p className="text-center text-[14px] text-slate-600">
                Remember your password?{' '}
                <Link href="/auth/login" className="text-brand-700 hover:text-brand-800 font-semibold">
                  Sign in →
                </Link>
              </p>
            </form>
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-[12px] text-slate-500">
          <Lock size={13} style={{ width: 13, height: 13 }} />
          <span>Encrypted in transit · UK-hosted · ICO-registered</span>
        </div>
      </div>
      </Container>
    </div>
  );
}
