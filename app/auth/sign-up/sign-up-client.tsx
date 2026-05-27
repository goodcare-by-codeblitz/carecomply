'use client';

import { SignUpForm } from '@/components/sign-up-form';
import { getPricingPlan, type BillingInterval } from '@/lib/billing';
import { useSearchParams } from 'next/navigation';

export function SignUpClient() {
  const searchParams = useSearchParams();
  const selectedPlan = getPricingPlan(searchParams.get('plan') ?? '') ?? getPricingPlan('pro')!;
  const selectedInterval: BillingInterval =
    searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly';

  return <SignUpForm initialPlan={selectedPlan} initialInterval={selectedInterval} />;
}
