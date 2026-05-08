'use client';

import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	DEFAULT_BILLING_SUMMARY,
	PRICING_PLANS,
	getPricingPlan,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
	type OrganizationBillingSummary,
} from '@/lib/billing';
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import { CreditCard, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type BillingRow = {
	plan: BillingPlan;
	interval: BillingInterval;
	status: BillingStatus;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	stripe_price_id: string | null;
	current_period_start: string | null;
	current_period_end: string | null;
	trial_start: string | null;
	trial_end: string | null;
	cancel_at_period_end: boolean | null;
};

export default function BillingSettingsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const [organization, setOrganization] = useState(storeOrg ?? null);
	const [isResolvingOrg, setIsResolvingOrg] = useState(!storeOrg);
	const [billing, setBilling] = useState<OrganizationBillingSummary>(
		DEFAULT_BILLING_SUMMARY,
	);
	const [isLoadingBilling, setIsLoadingBilling] = useState(false);
	const [isOpeningPortal, setIsOpeningPortal] = useState(false);
	const [selectedBillingPlan, setSelectedBillingPlan] =
		useState<BillingPlan>('carecore');
	const [selectedBillingInterval, setSelectedBillingInterval] =
		useState<BillingInterval>('monthly');
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
			setIsResolvingOrg(false);
			return;
		}

		const fetchOrganization = async () => {
			setIsResolvingOrg(true);
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			setOrganization(await getCurrentOrgBySlug(supabase, user.id, orgSlug));
			setIsResolvingOrg(false);
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

	const loadBilling = useCallback(async () => {
		if (!organization) return;

		setIsLoadingBilling(true);
		const supabase = createClient();
		const { data, error } = await supabase
			.from('organization_billing')
			.select(
				'plan, interval, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, trial_start, trial_end, cancel_at_period_end',
			)
			.eq('organization_id', organization.id)
			.maybeSingle();

		setIsLoadingBilling(false);

		if (error) {
			setBilling(DEFAULT_BILLING_SUMMARY);
			if (!isMissingRelationError(error)) {
				toast.error('Billing could not be loaded');
			}
			return;
		}

		if (!data) {
			setBilling(DEFAULT_BILLING_SUMMARY);
			return;
		}

		const row = data as BillingRow;
		setBilling({
			...row,
			cancel_at_period_end: Boolean(row.cancel_at_period_end),
			isConfigured: Boolean(
				row.stripe_customer_id ||
					row.stripe_subscription_id ||
					row.stripe_price_id,
			),
		});
		setSelectedBillingPlan(row.plan);
		setSelectedBillingInterval(row.interval);
	}, [organization]);

	useEffect(() => {
		loadBilling();
	}, [loadBilling]);

	const handleOpenBillingPortal = async () => {
		if (!organization) return;

		setIsOpeningPortal(true);
		try {
			const response = await fetch('/api/billing/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					orgSlug: organization.slug,
				}),
			});
			const payload = (await response.json()) as {
				message?: string;
				url?: string;
			};

			if (!response.ok) {
				toast.info(payload.message ?? 'Billing portal could not be opened.');
				return;
			}

			if (payload.url) {
				window.location.href = payload.url;
				return;
			}

			toast.error('Billing portal did not return a redirect URL');
		} catch {
			toast.error('Billing portal could not be opened');
		} finally {
			setIsOpeningPortal(false);
		}
	};

	const handleChangeBillingPlan = async () => {
		if (!organization) return;

		setIsStartingCheckout(true);
		try {
			const hasActiveSubscription = Boolean(
				billing.stripe_subscription_id && billing.status !== 'canceled',
			);
			const response = await fetch(
				hasActiveSubscription
					? '/api/billing/subscription'
					: '/api/billing/checkout',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						planId: selectedBillingPlan,
						interval: selectedBillingInterval,
						orgId: organization.id,
						orgSlug: organization.slug,
					}),
				},
			);
			const payload = (await response.json()) as {
				message?: string;
				url?: string;
			};

			if (!response.ok) {
				toast.info(payload.message ?? 'Checkout could not be started.');
				return;
			}

			if (payload.url) {
				window.location.href = payload.url;
				return;
			}

			toast.success(
				payload.message ??
					(hasActiveSubscription
						? 'Subscription change submitted'
						: 'Checkout started'),
			);
			await loadBilling();
		} catch {
			toast.error('Billing change could not be started');
		} finally {
			setIsStartingCheckout(false);
		}
	};

	const billingPlan = getPricingPlan(billing.plan);
	const selectedPlan = getPricingPlan(selectedBillingPlan);
	const periodEnd = billing.current_period_end ?? billing.trial_end;
	const formatBillingDate = (value: string | null | undefined) =>
		value
			? new Intl.DateTimeFormat('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
				}).format(new Date(value))
			: null;
	const formattedPeriodEnd = formatBillingDate(periodEnd);
	const formattedTrialStart = formatBillingDate(billing.trial_start);
	const formattedTrialEnd = formatBillingDate(billing.trial_end);

	if (isResolvingOrg) {
		return (
			<div className='flex min-h-[360px] items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Billing</CardTitle>
				<CardDescription>
					Manage your organization subscription and Stripe billing details.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-8'>
				<div className='flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-3'>
						<div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted'>
							<CreditCard className='h-5 w-5 text-muted-foreground' />
						</div>
						<div>
							<p className='font-medium'>
								{isLoadingBilling
									? 'Loading billing...'
									: `${billingPlan?.name ?? billing.plan} plan`}
							</p>
							<p className='text-sm text-muted-foreground'>
								Status: {billing.status.replace('_', ' ')}
								{billing.interval ? ` - ${billing.interval}` : ''}
							</p>
							{formattedPeriodEnd && (
								<p className='text-xs text-muted-foreground'>
									{billing.cancel_at_period_end ? 'Ends' : 'Renews'} on{' '}
									{formattedPeriodEnd}
								</p>
							)}
							{formattedTrialStart && formattedTrialEnd && (
								<p className='text-xs text-muted-foreground'>
									Trial: {formattedTrialStart} to {formattedTrialEnd}
								</p>
							)}
						</div>
					</div>
					<Button
						type='button'
						disabled={!billing.stripe_customer_id || isOpeningPortal}
						onClick={handleOpenBillingPortal}>
						{isOpeningPortal && (
							<Loader2 className='mr-2 h-4 w-4 animate-spin' />
						)}
						Manage billing
					</Button>
				</div>
				{billing.stripe_subscription_id && (
					<p className='text-xs text-muted-foreground'>
						Stripe subscription: {billing.stripe_subscription_id}
					</p>
				)}
				<div className='rounded-md border p-4'>
					<div className='mb-4'>
						<h3 className='text-sm font-medium'>Change plan</h3>
						<p className='text-sm text-muted-foreground'>
							Choose a package and interval. Existing subscriptions are updated
							with Stripe proration instead of creating another subscription.
						</p>
					</div>
					<div className='grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end'>
						<div className='space-y-2'>
							<Label>Plan</Label>
							<Select
								value={selectedBillingPlan}
								onValueChange={(value) =>
									setSelectedBillingPlan(value as BillingPlan)
								}>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRICING_PLANS.filter((plan) => !plan.isEnterprise).map(
										(plan) => (
											<SelectItem key={plan.id} value={plan.id}>
												{plan.name}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label>Interval</Label>
							<Select
								value={selectedBillingInterval}
								onValueChange={(value) =>
									setSelectedBillingInterval(value as BillingInterval)
								}>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='monthly'>Monthly</SelectItem>
									<SelectItem value='yearly'>Yearly</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button
							type='button'
							disabled={
								isStartingCheckout ||
								(Boolean(
									billing.stripe_subscription_id &&
										billing.status !== 'canceled',
								) &&
									selectedBillingPlan === billing.plan &&
									selectedBillingInterval === billing.interval)
							}
							onClick={handleChangeBillingPlan}>
							{isStartingCheckout && (
								<Loader2 className='mr-2 h-4 w-4 animate-spin' />
							)}
							{billing.stripe_subscription_id && billing.status !== 'canceled'
								? 'Update subscription'
								: 'Start checkout'}
						</Button>
					</div>
					{selectedPlan && (
						<p className='mt-3 text-xs text-muted-foreground'>
							{selectedPlan.description}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
