'use client';

import { Button } from '@/components/ui/button';
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
	type BillingPriceEstimate,
	type OrganizationBillingSummary,
} from '@/lib/billing';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import { CreditCard, Loader2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type BillingRow = {
	billing?: OrganizationBillingSummary;
	priceEstimate?: BillingPriceEstimate;
	error?: string;
};

export default function BillingSettingsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const searchParams = useSearchParams();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const [organization, setOrganization] = useState(storeOrg ?? null);
	const [isResolvingOrg, setIsResolvingOrg] = useState(!storeOrg);
	const [billing, setBilling] = useState<OrganizationBillingSummary>(
		DEFAULT_BILLING_SUMMARY,
	);
	const [priceEstimate, setPriceEstimate] =
		useState<BillingPriceEstimate | null>(null);
	const [isLoadingBilling, setIsLoadingBilling] = useState(false);
	const [isOpeningPortal, setIsOpeningPortal] = useState(false);
	const [selectedBillingPlan, setSelectedBillingPlan] =
		useState<BillingPlan>('starter');
	const [selectedBillingInterval, setSelectedBillingInterval] =
		useState<BillingInterval>('monthly');
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);
	const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);

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
		const response = await fetch(
			`/api/billing/summary?orgId=${encodeURIComponent(organization.id)}`,
		);
		const data = (await response.json().catch(() => ({}))) as BillingRow;

		setIsLoadingBilling(false);

		if (!response.ok) {
			setBilling(DEFAULT_BILLING_SUMMARY);
			setPriceEstimate(null);
			toast.error(data.error ?? 'Billing could not be loaded');
			return;
		}

		const row = data.billing ?? DEFAULT_BILLING_SUMMARY;
		setBilling(row);
		setPriceEstimate(data.priceEstimate ?? null);
		setSelectedBillingPlan(row.plan);
		setSelectedBillingInterval(row.interval);
	}, [organization]);

	useEffect(() => {
		loadBilling();
	}, [loadBilling]);

	useEffect(() => {
		const billingParam = searchParams.get('billing');
		const sessionId = searchParams.get('session_id');

		if (billingParam === 'cancelled') {
			router.replace(`/${orgSlug}/settings/billing`);
			toast.info('Checkout was cancelled.');
			return;
		}

		if (billingParam === 'success') {
			if (organization && sessionId) {
				setIsConfirmingCheckout(true);
				fetch('/api/billing/checkout/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						orgId: organization.id,
						orgSlug: organization.slug,
						sessionId,
					}),
				})
					.then(async (response) => {
						const payload = (await response.json().catch(() => ({}))) as {
							message?: string;
						};

						if (!response.ok) {
							toast.info(
								payload.message ??
									'Checkout completed. Billing will update shortly.',
							);
							return;
						}

						toast.success(payload.message ?? 'Billing updated');
						await loadBilling();
					})
					.catch(() => {
						toast.info('Checkout completed. Billing will update shortly.');
					})
					.finally(() => {
						setIsConfirmingCheckout(false);
					});
			} else {
				setIsConfirmingCheckout(true);
			}
			router.replace(`/${orgSlug}/settings/billing`);
		}
	}, [loadBilling, organization, searchParams, orgSlug, router]);

	useEffect(() => {
		if (!isConfirmingCheckout) return;
		if (billing.isConfigured && (billing.status === 'active' || billing.status === 'trialing')) {
			setIsConfirmingCheckout(false);
			toast.success('Subscription confirmed. Pro features are now available.');
		}
	}, [isConfirmingCheckout, billing.isConfigured, billing.status]);

	useEffect(() => {
		if (!isConfirmingCheckout) return;

		const intervalId = setInterval(() => {
			void loadBilling();
		}, 2000);

		const deadlineId = setTimeout(() => {
			setIsConfirmingCheckout(false);
			toast.info('Billing confirmation is taking longer than expected. It will update shortly.');
		}, 30_000);

		return () => {
			clearInterval(intervalId);
			clearTimeout(deadlineId);
		};
	}, [isConfirmingCheckout, loadBilling]);

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
	const formatCurrency = (value: number) =>
		new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			maximumFractionDigits: 0,
		}).format(value);

	if (isResolvingOrg) {
		return (
			<div className='flex min-h-[360px] items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-slate-400' />
			</div>
		);
	}

	return (
		<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
			<div className='border-b border-line bg-surface-page px-5 py-3.5'>
				<h2 className='text-[14px] font-semibold text-ink'>Billing</h2>
				<p className='mt-0.5 text-[12.5px] text-slate-500'>
					Manage your organization subscription and Stripe billing details.
				</p>
			</div>
			<div className='p-5 space-y-8'>
				{isConfirmingCheckout && (
					<div className='flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-4 py-3 text-[13.5px] font-medium text-ink'>
						<Loader2 className='h-4 w-4 animate-spin shrink-0 text-slate-400' />
						<span>Confirming your payment with Stripe. This usually takes a few seconds...</span>
					</div>
				)}
				<div className='flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-3'>
						<div className='flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted'>
							<CreditCard className='h-5 w-5 text-slate-500' />
						</div>
						<div>
							<p className='text-[13.5px] font-medium text-ink'>
								{isLoadingBilling
									? 'Loading billing...'
									: `${billingPlan?.name ?? billing.plan} plan`}
							</p>
							<p className='text-[12.5px] text-slate-500'>
								Status: {billing.status.replace('_', ' ')}
								{billing.interval ? ` - ${billing.interval}` : ''}
							</p>
							{formattedPeriodEnd && (
								<p className='text-[12px] text-slate-400'>
									{billing.cancel_at_period_end ? 'Ends' : 'Renews'} on{' '}
									{formattedPeriodEnd}
								</p>
							)}
							{formattedTrialStart && formattedTrialEnd && (
								<p className='text-[12px] text-slate-400'>
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
					<p className='text-[12px] text-slate-400'>
						Stripe subscription: {billing.stripe_subscription_id}
					</p>
				)}
				{priceEstimate && (
					<div className='rounded-xl border border-line p-4'>
						<div className='mb-4'>
							<h3 className='text-[13.5px] font-medium text-ink'>Active carer pricing</h3>
							<p className='text-[12.5px] text-slate-500'>
								Estimated app total. Stripe currently bills the base package price only.
							</p>
						</div>
						<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
							<div className='rounded-xl bg-surface-muted/50 p-3'>
								<p className='text-[12px] text-slate-400'>Active carers</p>
								<p className='text-xl font-semibold'>
									{priceEstimate.activeCarers}
								</p>
								<p className='text-[12px] text-slate-400'>
									{priceEstimate.includedActiveCarers} included
								</p>
							</div>
							<div className='rounded-xl bg-surface-muted/50 p-3'>
								<p className='text-[12px] text-slate-400'>Extra carers</p>
								<p className='text-xl font-semibold'>
									{priceEstimate.extraActiveCarers}
								</p>
								<p className='text-[12px] text-slate-400'>
									{formatCurrency(priceEstimate.extraActiveCarerPrice)} per extra active carer
								</p>
							</div>
							<div className='rounded-xl bg-surface-muted/50 p-3'>
								<p className='text-[12px] text-slate-400'>Monthly estimate</p>
								<p className='text-xl font-semibold'>
									{formatCurrency(priceEstimate.totalMonthlyAmount)}
								</p>
								<p className='text-[12px] text-slate-400'>
									{formatCurrency(priceEstimate.baseMonthlyPrice)} base
									{priceEstimate.monthlyOverageAmount > 0
										? ` + ${formatCurrency(priceEstimate.monthlyOverageAmount)} overage`
										: ''}
								</p>
							</div>
							<div className='rounded-xl bg-surface-muted/50 p-3'>
								<p className='text-[12px] text-slate-400'>Yearly estimate</p>
								<p className='text-xl font-semibold'>
									{formatCurrency(priceEstimate.totalYearlyAmount)}
								</p>
								<p className='text-[12px] text-slate-400'>
									{formatCurrency(priceEstimate.baseYearlyPrice)} base
									{priceEstimate.yearlyOverageAmount > 0
										? ` + ${formatCurrency(priceEstimate.yearlyOverageAmount)} overage`
										: ''}
								</p>
							</div>
						</div>
					</div>
				)}
				<div className='rounded-xl border border-line p-4'>
					<div className='mb-4'>
						<h3 className='text-[13.5px] font-medium text-ink'>Change plan</h3>
						<p className='text-[12.5px] text-slate-500'>
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
						<p className='mt-3 text-[12px] text-slate-400'>
							{selectedPlan.description}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
