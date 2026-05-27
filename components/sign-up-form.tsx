'use client';

import { initOrgStore } from '@/lib/init-org';
import { initProfile } from '@/lib/init-profile';
import type { BillingInterval, PricingPlan } from '@/lib/billing';
import {
  getSlugTakenErrorMessage,
  slugify,
  validateOrganizationSlug,
} from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { useSlugAvailability } from '@/lib/use-slug-availability';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle, ArrowRight } from 'lucide-react';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Field } from '@/components/auth/field';
import { cn } from '@/lib/utils';

const PENDING_CREATE_ORG_KEY = 'carecomply_pending_create_org';

const CARER_COUNTS = ['1–25', '25–50', '50–100', '100+'];

const PLAN_OPTIONS: { id: 'starter' | 'pro'; t: string; p: string; d: string }[] = [
  { id: 'starter', t: 'Starter', p: '£29/mo', d: '25 active carers' },
  { id: 'pro',     t: 'Pro',     p: '£59/mo', d: '40 active carers · automation' },
];

const PROVISION_STEPS = [
  'Account created',
  'Provisioning workspace',
  'Loading default document types',
  'Loading default reminder schedule',
  'Preparing your dashboard',
];

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Create your CareComply workspace.',
  2: 'Tell us about your agency.',
  3: "You're in. Let's get to work.",
};

const STEP_SUBTITLES: Record<Step, string> = {
  1: 'Two minutes. No card required. UK-hosted.',
  2: "We'll tune compliance defaults to your size.",
  3: 'Your workspace is being provisioned.',
};

export function SignUpForm({
  initialPlan,
  initialInterval,
}: {
  initialPlan: PricingPlan;
  initialInterval: BillingInterval;
}) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 fields
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgSlugTouched, setOrgSlugTouched] = useState(false);
  const [carerCount, setCarerCount] = useState('');
  const [plan, setPlan] = useState(initialPlan.id);
  const [interval] = useState<BillingInterval>(initialInterval);

  // Step 3 provisioning
  const [provisionStep, setProvisionStep] = useState(0);
  const [provisionDone, setProvisionDone] = useState(false);
  const [dashboardPath, setDashboardPath] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const resolvedSlug = useMemo(() => slugify(orgSlug || orgName), [orgName, orgSlug]);
  const slugAvailability = useSlugAvailability(resolvedSlug);

  useEffect(() => {
    if (orgSlugTouched) return;
    setOrgSlug(slugify(orgName));
  }, [orgName, orgSlugTouched]);

  const handleExistingAccount = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const params = new URLSearchParams({ email: normalizedEmail, next: 'create-org' });
    localStorage.setItem(
      PENDING_CREATE_ORG_KEY,
      JSON.stringify({ email: normalizedEmail, orgName, orgSlug: resolvedSlug, plan, interval }),
    );
    router.push(`/auth/login?${params.toString()}`);
  };

  const handleStep1 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const slugValidationMessage = validateOrganizationSlug(resolvedSlug);
    if (slugValidationMessage) { setError(slugValidationMessage); return; }
    if (slugAvailability.status === 'taken') { setError('That workspace URL is already taken.'); return; }

    setStep(3);
    setIsLoading(true);
    setProvisionStep(0);

    try {
      const supabase = createClient();

      // Check for existing profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileData) { handleExistingAccount(); return; }

      setProvisionStep(1);
      const fullName = `${firstName} ${lastName}`.trim();
      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/login`,
        },
      });

      if (signUpError?.code === 'user_already_exists') { handleExistingAccount(); return; }
      if (signUpError) throw signUpError;

      setProvisionStep(2);
      const { error: orgError } = await supabase.rpc('create_organization_with_roles', {
        p_user_id: data.user?.id,
        org_name: orgName,
        org_slug: resolvedSlug,
        p_billing_plan: plan,
        p_billing_interval: interval,
      });
      if (orgError) throw orgError;

      setProvisionStep(3);
      await initProfile();

      setProvisionStep(4);
      await initOrgStore();

      setProvisionStep(5);
      document.cookie = `current_org_slug=${resolvedSlug}; path=/; samesite=lax`;
      setDashboardPath(`/${resolvedSlug}/dashboard`);
      setProvisionDone(true);
    } catch (err: unknown) {
      setError(
        getSlugTakenErrorMessage(err) ??
          (err instanceof Error ? err.message : 'An error occurred'),
      );
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const stepFooter = step === 1 ? (
    <>
      Already have an account?{' '}
      <Link href="/auth/login" className="text-brand-700 hover:text-brand-800 font-semibold">
        Sign in →
      </Link>
    </>
  ) : undefined;

  return (
    <AuthFrame
      eyebrow={step === 1 ? 'Start your 14-day trial' : undefined}
      title={STEP_TITLES[step]}
      subtitle={STEP_SUBTITLES[step]}
      footer={stepFooter}>

      {/* Step indicator */}
      <div className="mb-7 flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((n) => (
          <div key={n} className="flex-1 flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-full grid place-items-center text-[12px] font-semibold shrink-0',
              n < step ? 'bg-emerald-600 text-white' :
              n === step ? 'bg-ink text-white' :
              'bg-surface-muted text-slate-500 border border-line-strong',
            )}>
              {n < step ? <Check size={13} style={{ width: 13, height: 13 }} /> : n}
            </div>
            {n < 3 && (
              <div className={cn('h-0.5 flex-1 rounded', n < step ? 'bg-emerald-600' : 'bg-line')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <form className="space-y-4" onSubmit={handleStep1}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" placeholder="Imogen" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Field label="Last name"  placeholder="Reed"   autoComplete="family-name" required value={lastName}  onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Field label="Work email" type="email" placeholder="you@youragency.co.uk" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            type="password"
            placeholder="At least 12 characters"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={<span className="text-[12px] text-slate-500">12+ chars, 1 number</span>}
          />
          <label className="flex items-start gap-2.5 text-[13px] text-slate-700 cursor-pointer">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand/20" />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="underline text-ink font-medium">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline text-ink font-medium">Privacy Policy</Link>.
            </span>
          </label>
          <button type="submit" className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition">
            Continue <ArrowRight size={15} style={{ width: 15, height: 15 }} />
          </button>
        </form>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <form className="space-y-4" onSubmit={handleStep2}>
          <Field label="Agency name" placeholder="Linden Domiciliary" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Field
            label="Workspace URL"
            placeholder="linden"
            suffix=".carecomply.co.uk"
            required
            value={orgSlug}
            onChange={(e) => { setOrgSlugTouched(true); setOrgSlug(slugify(e.target.value)); }}
            hint={
              slugAvailability.status === 'available' ? (
                <span className="text-[12px] text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Check size={12} style={{ width: 12, height: 12 }} /> Available
                </span>
              ) : slugAvailability.status === 'taken' || slugAvailability.status === 'invalid' ? (
                <span className="text-[12px] text-red-600">{slugAvailability.message}</span>
              ) : null
            }
          />
          {slugAvailability.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 -mt-2">
              {slugAvailability.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setOrgSlugTouched(true); setOrgSlug(suggestion); }}
                  className="h-7 px-3 rounded-md border border-line-strong bg-white text-[12px] text-ink-3 hover:border-ink hover:text-ink transition">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <label className="block">
            <div className="text-[13px] font-medium text-ink mb-2">How many active carers today?</div>
            <div className="flex flex-wrap gap-2">
              {CARER_COUNTS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setCarerCount(o)}
                  className={cn(
                    'h-10 px-4 rounded-lg border text-[14px] transition',
                    carerCount === o
                      ? 'border-ink bg-surface-page text-ink font-medium'
                      : 'border-line-strong bg-white text-ink-3 hover:border-ink hover:text-ink',
                  )}>
                  {o}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-ink mb-2">Recommended plan</div>
            <div className="grid grid-cols-2 gap-2.5">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    'text-left rounded-lg border p-4 transition',
                    plan === p.id
                      ? 'border-ink ring-2 ring-ink/10 bg-surface-page'
                      : 'border-line-strong bg-white hover:border-ink',
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-semibold text-ink">{p.t}</div>
                    <div className={cn(
                      'h-4 w-4 rounded-full border-2 grid place-items-center',
                      plan === p.id ? 'border-ink bg-ink' : 'border-line-strong',
                    )}>
                      {plan === p.id && <Check size={10} className="text-white" style={{ width: 10, height: 10 }} />}
                    </div>
                  </div>
                  <div className="text-[13px] text-ink-3 mt-1">{p.p}</div>
                  <div className="text-[12px] text-slate-600 mt-0.5">{p.d}</div>
                </button>
              ))}
            </div>
            <div className="text-[12px] text-slate-600 mt-2">Trial includes full Pro access regardless of plan choice.</div>
          </label>

          {error && (
            <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || slugAvailability.status === 'checking' || slugAvailability.status === 'taken' || slugAvailability.status === 'invalid'}
            className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
            Create workspace <ArrowRight size={15} style={{ width: 15, height: 15 }} />
          </button>
        </form>
      )}

      {/* Step 3 — Provisioning */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-page p-5">
            {PROVISION_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 text-[14px]">
                {provisionStep > i ? (
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" style={{ width: 16, height: 16 }} />
                ) : provisionStep === i ? (
                  <span className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin inline-block shrink-0" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-line-strong inline-block shrink-0" />
                )}
                <span className={provisionStep > i ? 'text-ink-3' : provisionStep === i ? 'text-ink font-medium' : 'text-slate-400'}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            disabled={!provisionDone}
            onClick={() => router.push(dashboardPath)}
            className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            Open workspace <ArrowRight size={15} style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
    </AuthFrame>
  );
}
