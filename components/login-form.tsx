'use client';

import { initOrgStore } from '@/lib/init-org';
import { initProfile } from '@/lib/init-profile';
import { getOrgRedirectPath, type UserOrganization } from '@/lib/orgs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Field } from '@/components/auth/field';

const PENDING_CREATE_ORG_KEY = 'carecomply_pending_create_org';

type PendingCreateOrg = {
  email?: string;
  orgName?: string;
  orgSlug?: string;
  plan?: string;
  interval?: string;
};

type PlatformAccess = {
  role: 'platform_super_admin' | 'platform_admin' | 'support' | null;
  canAccessAdmin: boolean;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Login failed. Please try again.');
  }
  return (await response.json()) as T;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteRedirect, setInviteRedirect] = useState<string | null>(null);
  const [adminRedirect, setAdminRedirect] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const nextParam = params.get('next');
    const tokenParam = params.get('token');

    if (emailParam) setEmail(emailParam);

    if (nextParam === 'create-org') {
      setNotice('Log in to add a new organization to your account.');
    }
    if (nextParam === 'admin') {
      setAdminRedirect(true);
      setNotice('Log in with a platform admin account to continue.');
    }
    if (nextParam === 'invite' && tokenParam) {
      setInviteRedirect(`/invite/${tokenParam}`);
      setNotice('Log in with the invited email address to accept this invitation.');
    }
  }, []);

  const getCreateOrgRedirect = (loginEmail: string) => {
    const stored = localStorage.getItem(PENDING_CREATE_ORG_KEY);
    if (!stored) return null;
    try {
      const pending = JSON.parse(stored) as PendingCreateOrg;
      if (pending.email?.toLowerCase() !== loginEmail.trim().toLowerCase()) return null;
      localStorage.removeItem(PENDING_CREATE_ORG_KEY);
      const params = new URLSearchParams();
      if (pending.orgName) params.set('orgName', pending.orgName);
      if (pending.orgSlug) params.set('orgSlug', pending.orgSlug);
      if (pending.plan) params.set('plan', pending.plan);
      if (pending.interval) params.set('interval', pending.interval);
      return `/create-org${params.toString() ? `?${params.toString()}` : ''}`;
    } catch {
      localStorage.removeItem(PENDING_CREATE_ORG_KEY);
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await readJsonResponse<{
        error?: string;
        organizations?: UserOrganization[];
        platformAccess?: PlatformAccess;
      }>(response);

      if (!response.ok || !payload.organizations) {
        throw new Error(payload.error || 'Login failed. Please try again.');
      }

      await initProfile();
      await initOrgStore();

      const organizations = payload.organizations;
      const pendingCreateOrgRedirect =
        organizations.length === 0 || organizations.length === 1
          ? getCreateOrgRedirect(email)
          : null;
      const platformAdminRedirect =
        payload.platformAccess?.canAccessAdmin
          ? '/admin/reminders'
          : null;

      router.push(
        inviteRedirect ??
          pendingCreateOrgRedirect ??
          platformAdminRedirect ??
          getOrgRedirectPath(organizations),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Sign in"
      title="Welcome back."
      subtitle="Sign in to your CareComply workspace."
      footer={
        <>
          New to CareComply?{' '}
          <Link href="/auth/sign-up" className="text-brand-700 hover:text-brand-800 font-semibold">
            Create an account →
          </Link>
        </>
      }>
      {notice && (
        <div className="mb-5 rounded-lg border border-line bg-surface-page px-4 py-3 text-[13.5px] text-slate-600">
          {notice}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleLogin}>
        <Field
          label="Work email"
          type="email"
          placeholder="you@youragency.co.uk"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password with show/hide toggle */}
        <label className="block">
          <div className="flex items-center justify-between text-[13px] font-medium text-ink mb-2">
            <span>Password<span className="text-red-600 ml-0.5">*</span></span>
            <Link
              href="/auth/forgot-password"
              className="text-brand-700 hover:text-brand-800 text-[13px] font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-lg border border-line-strong bg-white pl-4 pr-12 text-[15px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-slate-500 hover:text-ink rounded-md hover:bg-surface-page transition">
              {showPassword
                ? <EyeOff size={16} style={{ width: 16, height: 16 }} />
                : <Eye size={16} style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </label>

        <label className="flex items-center gap-2.5 text-[14px] text-ink-3 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand/20"
          />
          Keep me signed in on this device
        </label>

        {error && (
          <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
          {isLoading ? 'Signing in…' : (
            <>Sign in <ArrowRight size={15} style={{ width: 15, height: 15 }} /></>
          )}
        </button>

        <div className="relative my-3">
          <div className="h-px bg-line" />
          <span className="absolute inset-0 -top-2 mx-auto w-fit bg-white px-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
            or
          </span>
        </div>

        <button
          type="button"
          className="w-full h-12 rounded-lg border border-line-strong bg-white text-[14px] font-medium text-ink inline-flex items-center justify-center gap-2.5 hover:bg-surface-page transition">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23 12.27c0-.86-.07-1.7-.21-2.5H12v4.76h6.18a5.28 5.28 0 0 1-2.29 3.46v2.88h3.7C21.74 18.85 23 15.84 23 12.27z"/>
            <path fill="#34A853" d="M12 23c3.1 0 5.7-1.03 7.6-2.78l-3.7-2.88c-1.03.7-2.34 1.12-3.9 1.12-3 0-5.54-2.03-6.45-4.76H1.72v2.99A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC04" d="M5.55 13.7a6.6 6.6 0 0 1 0-3.4V7.31H1.72a11 11 0 0 0 0 9.38l3.83-2.99z"/>
            <path fill="#EA4335" d="M12 5.36c1.69 0 3.2.58 4.4 1.72l3.27-3.27C17.69 1.92 15.1 1 12 1A11 11 0 0 0 1.72 7.31l3.83 2.99C6.46 7.4 9 5.36 12 5.36z"/>
          </svg>
          Continue with Google
        </button>
      </form>
    </AuthFrame>
  );
}
