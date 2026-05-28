'use client';

import {
  isKnownBillingPlan,
  normalizeBillingPlan,
  type BillingInterval,
} from '@/lib/billing';
import { initOrgStore } from '@/lib/init-org';
import {
  getSlugTakenErrorMessage,
  slugify,
  validateOrganizationSlug,
} from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { useSlugAvailability } from '@/lib/use-slug-availability';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Field } from '@/components/auth/field';
import { TopNav } from '@/components/marketing/nav';
import { Container } from '@/components/marketing/ui/container';

export default function CreateOrgPage() {
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgSlugTouched, setOrgSlugTouched] = useState(false);
  const [billingPlan, setBillingPlan] = useState('starter');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Redirect platform admins away from tenant org creation
  useEffect(() => {
    const supabase = createClient();
    supabase.from('platform_memberships').select('id').maybeSingle().then(({ data }) => {
      if (data) router.replace('/admin/reminders');
    });
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgNameParam = params.get('orgName');
    const orgSlugParam = params.get('orgSlug');
    const planParam = params.get('plan');
    const intervalParam = params.get('interval');

    if (orgNameParam) setOrgName(orgNameParam);
    if (orgSlugParam) { setOrgSlug(slugify(orgSlugParam)); setOrgSlugTouched(true); }
    if (planParam) {
      setBillingPlan(isKnownBillingPlan(planParam) ? normalizeBillingPlan(planParam) : 'starter');
    }
    if (intervalParam === 'monthly' || intervalParam === 'yearly') {
      setBillingInterval(intervalParam satisfies BillingInterval);
    }
  }, []);

  const resolvedSlug = useMemo(() => slugify(orgSlug || orgName), [orgName, orgSlug]);
  const slugAvailability = useSlugAvailability(resolvedSlug);

  useEffect(() => {
    if (orgSlugTouched) return;
    setOrgSlug(slugify(orgName));
  }, [orgName, orgSlugTouched]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const slugValidationMessage = validateOrganizationSlug(resolvedSlug);
    if (slugValidationMessage) { setError(slugValidationMessage); return; }
    if (slugAvailability.status === 'taken') { setError('That workspace URL is already taken. Choose another one.'); return; }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { error: orgError } = await supabase.rpc('create_organization_with_roles', {
        p_user_id: user.id,
        org_name: orgName,
        org_slug: resolvedSlug,
        p_billing_plan: billingPlan,
        p_billing_interval: billingInterval,
      });

      if (orgError) {
        const shouldTryLegacyCreate =
          orgError.message?.includes('Invalid billing plan') ||
          orgError.message?.includes('Could not find the function') ||
          orgError.code === 'PGRST202';

        if (!shouldTryLegacyCreate) throw orgError;

        const { error: legacyOrgError } = await supabase.rpc('create_organization_with_roles', {
          p_user_id: user.id,
          org_name: orgName,
          org_slug: resolvedSlug,
        });
        if (legacyOrgError) throw legacyOrgError;
      }

      document.cookie = `current_org_slug=${resolvedSlug}; path=/; samesite=lax`;
      await initOrgStore();
      router.push(`/${resolvedSlug}/dashboard`);
    } catch (err: unknown) {
      setError(
        getSlugTakenErrorMessage(err) ??
          (err instanceof Error ? err.message : 'Unable to create organization'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const PLAN_OPTIONS = [
    { id: 'starter', t: 'Starter', p: '£29/mo', d: '25 active carers' },
    { id: 'pro',     t: 'Pro',     p: '£59/mo', d: '40 active carers · automation' },
  ];

  return (
    <>
      <TopNav />
      <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
        <Container className="w-full">
        <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
          <h1 className="text-[28px] font-semibold tracking-ultratight text-ink">Create a workspace.</h1>
          <p className="mt-2 text-[14.5px] text-slate-600">
            Set up your organization before entering the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field
              label="Organization name"
              placeholder="Linden Domiciliary"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />

            <Field
              label="Workspace URL"
              placeholder={slugify(orgName) || 'linden-domiciliary'}
              required
              value={orgSlug}
              onChange={(e) => { setOrgSlugTouched(true); setOrgSlug(slugify(e.target.value)); }}
              suffix=".carecomply.co.uk"
              hint={
                slugAvailability.status === 'available' ? (
                  <span className="text-[12px] text-emerald-700 font-medium inline-flex items-center gap-1">
                    <Check size={12} style={{ width: 12, height: 12 }} /> Available
                  </span>
                ) : (slugAvailability.status === 'taken' || slugAvailability.status === 'invalid') ? (
                  <span className="text-[12px] text-red-600">{slugAvailability.message}</span>
                ) : null
              }
            />

            {slugAvailability.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
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

            <div>
              <div className="text-[13px] font-medium text-ink mb-2">Plan</div>
              <div className="grid grid-cols-2 gap-2.5">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBillingPlan(p.id)}
                    className={cn(
                      'text-left rounded-lg border p-4 transition',
                      billingPlan === p.id
                        ? 'border-ink ring-2 ring-ink/10 bg-surface-page'
                        : 'border-line-strong bg-white hover:border-ink',
                    )}>
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] font-semibold text-ink">{p.t}</div>
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 grid place-items-center',
                        billingPlan === p.id ? 'border-ink bg-ink' : 'border-line-strong',
                      )}>
                        {billingPlan === p.id && <Check size={10} className="text-white" style={{ width: 10, height: 10 }} />}
                      </div>
                    </div>
                    <div className="text-[13px] text-ink-3 mt-1">{p.p}</div>
                    <div className="text-[12px] text-slate-600 mt-0.5">{p.d}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBillingInterval('monthly')}
                  className={cn(
                    'h-8 px-3 rounded-md text-[12px] font-medium transition border',
                    billingInterval === 'monthly'
                      ? 'border-ink bg-surface-page text-ink'
                      : 'border-line-strong bg-white text-slate-500 hover:border-ink',
                  )}>
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval('yearly')}
                  className={cn(
                    'h-8 px-3 rounded-md text-[12px] font-medium transition border',
                    billingInterval === 'yearly'
                      ? 'border-ink bg-surface-page text-ink'
                      : 'border-line-strong bg-white text-slate-500 hover:border-ink',
                  )}>
                  Yearly <span className="text-emerald-700 ml-1">−17%</span>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[13.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={
                isLoading ||
                slugAvailability.status === 'checking' ||
                slugAvailability.status === 'taken' ||
                slugAvailability.status === 'invalid'
              }
              className="w-full h-12 rounded-lg bg-brand text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? 'Creating workspace…' : (
                <>Create workspace <ArrowRight size={15} style={{ width: 15, height: 15 }} /></>
              )}
            </button>
          </form>
        </div>
        </div>
        </Container>
      </div>
    </>
  );
}
