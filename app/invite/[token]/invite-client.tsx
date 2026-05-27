'use client';

import {
  INVITATION_SETUP_MESSAGE,
  type OrganizationInvitation,
} from '@/lib/invitations';
import { createClient } from '@/lib/supabase/client';
import { Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TopNav } from '@/components/marketing/nav';
import { Pill } from '@/components/marketing/ui/pill';
import { cn } from '@/lib/utils';

type InviteClientProps = {
  token?: string;
};

type InvitationView = OrganizationInvitation & {
  organization?: { name: string; slug: string } | null;
  role?: { name: string } | null;
};

function isExpired(invitation: OrganizationInvitation) {
  return Boolean(invitation.expires_at && new Date(invitation.expires_at) < new Date());
}

const inputCls = 'w-full h-11 rounded-lg border border-line-strong bg-white px-4 text-[14.5px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';

export function InviteClient({ token }: InviteClientProps) {
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadInvitation = async () => {
      const inviteToken = token ?? window.location.pathname.split('/').filter(Boolean).pop();
      if (!inviteToken) { setIsLoading(false); return; }

      setIsLoading(true);
      const supabase = createClient();
      const [
        { data: { user } },
        response,
      ] = await Promise.all([
        supabase.auth.getUser(),
        fetch(`/api/invitations/details?token=${encodeURIComponent(inviteToken)}`),
      ]);

      setIsLoading(false);
      setCurrentUserEmail(user?.email ?? null);

      if (!response.ok) {
        setSetupMissing(response.status === 404);
        toast.error('Invitation could not be loaded');
        return;
      }

      const data = (await response.json()) as InvitationView;
      setInvitation(data);
    };

    loadInvitation();
  }, [token]);

  const inviteState = useMemo(() => {
    if (!invitation) return 'missing';
    if (invitation.status === 'revoked') return 'revoked';
    if (invitation.status === 'accepted') return 'accepted';
    if (invitation.status === 'expired' || isExpired(invitation)) return 'expired';
    return 'pending';
  }, [invitation]);

  const inviteToken = token ?? (typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean).pop()
    : null);
  const organization = invitation?.organization;
  const role = invitation?.role;
  const currentUserMatchesInvite =
    currentUserEmail?.trim().toLowerCase() === invitation?.email.trim().toLowerCase();
  const loginHref = invitation
    ? `/auth/login?${new URLSearchParams({ email: invitation.email, next: 'invite', token: inviteToken ?? '' }).toString()}`
    : '/auth/login';

  useEffect(() => {
    if (invitation?.invite_type === 'carer' && inviteToken) {
      router.replace(`/onboarding/${inviteToken}`);
    }
  }, [invitation?.invite_type, inviteToken, router]);

  const acceptInvitation = async () => {
    if (!inviteToken || !invitation) return;
    setError(null);

    if (!currentUserEmail) {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    }

    setIsAccepting(true);
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, password: currentUserEmail ? undefined : password }),
      });
      const payload = (await response.json()) as {
        error?: string;
        code?: string;
        orgSlug?: string | null;
        email?: string;
        createdUser?: boolean;
      };

      if (!response.ok) {
        if (payload.code === 'existing_account') setExistingAccount(true);
        setError(payload.error ?? 'Invitation could not be accepted.');
        return;
      }

      if (payload.createdUser) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: payload.email ?? invitation.email,
          password,
        });
        if (signInError) { setError('Account created. Please log in with your new password.'); return; }
      }

      toast.success('Invitation accepted');
      router.push(payload.orgSlug ? `/${payload.orgSlug}/dashboard` : '/dashboard');
      router.refresh();
    } catch {
      setError('Invitation could not be accepted.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <TopNav />
        <div className="min-h-[calc(100vh-64px)] bg-surface-page flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  const stateTone: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
    pending: 'ok',
    accepted: 'neutral',
    expired: 'warn',
    revoked: 'danger',
    missing: 'danger',
  };

  return (
    <>
      <TopNav />
      <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

        <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
          {/* Icon + header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mb-5">
              <MailCheck size={24} style={{ width: 24, height: 24 }} />
            </div>
            <h1 className="text-[22px] font-semibold tracking-ultratight text-ink">
              {organization?.name ? `Join ${organization.name} on CareComply.` : 'CareComply invitation'}
            </h1>
            {invitation && (
              <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
                <Pill tone={stateTone[inviteState] ?? 'neutral'}>{inviteState}</Pill>
                <span className="text-[13px] text-slate-500">{invitation.email}</span>
                {role?.name && <span className="text-[13px] text-slate-500">· {role.name}</span>}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {setupMissing ? (
              <p className="rounded-xl border border-dashed border-line-strong p-4 text-[13.5px] text-slate-600 text-center">
                {INVITATION_SETUP_MESSAGE}
              </p>
            ) : invitation ? (
              <>
                {inviteState === 'pending' && invitation.invite_type === 'team_member' ? (
                  <div className="space-y-4">
                    {currentUserEmail && !currentUserMatchesInvite ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13.5px] text-amber-800">
                        You are logged in as <strong>{currentUserEmail}</strong>. Log out and use <strong>{invitation.email}</strong> to accept this invitation.
                      </div>
                    ) : currentUserEmail ? (
                      <div className="rounded-xl border border-line bg-surface-page p-4 text-[13.5px] text-slate-600">
                        You are logged in as <strong>{currentUserEmail}</strong>. Accepting will add this account to the organization.
                      </div>
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-[13px] font-medium text-ink mb-2 block">Create password <span className="text-red-600">*</span></span>
                          <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className={inputCls}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[13px] font-medium text-ink mb-2 block">Confirm password <span className="text-red-600">*</span></span>
                          <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            className={inputCls}
                          />
                        </label>
                      </>
                    )}

                    {error && (
                      <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={acceptInvitation}
                        disabled={isAccepting || Boolean(currentUserEmail && !currentUserMatchesInvite)}
                        className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[14.5px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                        {isAccepting ? (
                          <><Loader2 size={15} className="animate-spin" style={{ width: 15, height: 15 }} /> Accepting…</>
                        ) : 'Accept invitation'}
                      </button>
                      {(!currentUserEmail || existingAccount) && (
                        <Link
                          href={loginHref}
                          className="w-full h-12 rounded-lg border border-line-strong bg-white text-[14px] font-medium text-ink inline-flex items-center justify-center hover:bg-surface-page transition">
                          I already have an account
                        </Link>
                      )}
                    </div>
                  </div>
                ) : inviteState === 'pending' ? (
                  <div className="space-y-3 text-center">
                    <p className="text-[14px] text-slate-600">This invitation is for carer onboarding.</p>
                    {inviteToken && (
                      <Link
                        href={`/onboarding/${inviteToken}`}
                        className="inline-flex h-12 items-center justify-center rounded-lg bg-brand text-white font-medium text-[14.5px] px-6 hover:bg-brand-700 transition">
                        Continue to onboarding
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-600 text-center">
                    This invitation cannot be accepted because it is <strong>{inviteState}</strong>.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[14px] text-slate-600 text-center">This invitation link could not be found.</p>
            )}

            <div className={cn('pt-2', invitation ? 'border-t border-line' : '')}>
              <Link
                href="/auth/login"
                className="w-full h-11 rounded-lg border border-line-strong bg-white text-[14px] font-medium text-ink inline-flex items-center justify-center hover:bg-surface-page transition">
                Go to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
