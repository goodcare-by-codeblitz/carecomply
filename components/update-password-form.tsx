'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Field } from '@/components/auth/field';
import { Container } from '@/components/marketing/ui/container';

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your password reset link is missing, expired, or already used. Request a new reset email.');
      }
      setIsCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push('/dashboard');
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
        <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
          <h1 className="text-[28px] font-semibold tracking-ultratight text-ink">Set a new password.</h1>
          <p className="mt-2 text-[14.5px] text-slate-600">
            Choose a strong password for your CareComply account.
          </p>
          <form className="mt-8 space-y-4" onSubmit={handleUpdatePassword}>
            <Field
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Confirm new password"
              type="password"
              placeholder="Repeat new password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && (
              <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={isLoading || isCheckingSession}
              className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? 'Saving…' : (
                <>Save new password <ArrowRight size={15} style={{ width: 15, height: 15 }} /></>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 flex items-center gap-2 text-[12px] text-slate-500">
          <Lock size={13} style={{ width: 13, height: 13 }} />
          <span>Encrypted in transit · UK-hosted · ICO-registered</span>
        </div>
      </div>
      </Container>
    </div>
  );
}
