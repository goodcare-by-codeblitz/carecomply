'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import {
	PRICING_PLANS,
	type BillingInterval,
	type BillingPlan,
} from '@/lib/billing';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type PricingPlansProps = {
	context?: 'public' | 'settings';
	currentPlan?: BillingPlan;
	orgSlug?: string;
	orgId?: string;
	className?: string;
};

function formatPrice(price: number | null) {
	if (price === null) return 'Contact us';
	return `£${price}`;
}

export function PricingPlans({
	context = 'public',
	currentPlan,
	orgSlug,
	orgId,
	className,
}: PricingPlansProps) {
	const router = useRouter();
	const [interval, setInterval] = useState<BillingInterval>('monthly');
	const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);

	const handlePlanAction = async (planId: BillingPlan, isEnterprise?: boolean) => {
		if (isEnterprise) {
			window.location.href =
				'mailto:hello@carecomply.co.uk?subject=Guardian%2B%20pricing';
			return;
		}

		if (context === 'public') {
			router.push(`/auth/sign-up?plan=${planId}&interval=${interval}`);
			return;
		}

		setLoadingPlan(planId);
		try {
			const response = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					planId,
					interval,
					orgSlug,
					orgId,
				}),
			});
			const payload = (await response.json()) as {
				message?: string;
				url?: string;
			};

			if (!response.ok) {
				toast.info(payload.message ?? 'Stripe checkout is not configured yet.');
				return;
			}

			if (payload.url) {
				window.location.href = payload.url;
				return;
			}

			toast.success('Checkout session created');
		} catch {
			toast.error('Checkout could not be started');
		} finally {
			setLoadingPlan(null);
		}
	};

	return (
		<div className={cn('space-y-8', className)}>
			<div className='flex justify-center'>
				<Tabs
					value={interval}
					onValueChange={(value) => setInterval(value as BillingInterval)}>
					<TabsList>
						<TabsTrigger value='monthly'>Monthly</TabsTrigger>
						<TabsTrigger value='yearly'>Yearly</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
				{PRICING_PLANS.map((plan) => {
					const price =
						interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
					const isCurrent = currentPlan === plan.id;
					const isLoading = loadingPlan === plan.id;
					const buttonText = plan.isEnterprise
						? 'Contact sales'
						: isCurrent
							? 'Current plan'
							: context === 'settings'
								? 'Choose plan'
								: `Start with ${plan.name}`;

					return (
						<Card
							key={plan.id}
							className={cn(
								'relative flex flex-col',
								plan.highlight && 'border-foreground shadow-sm',
							)}>
							{plan.highlight && (
								<Badge className='absolute right-4 top-4'>Popular</Badge>
							)}
							<CardHeader className='space-y-3'>
								<div>
									<CardTitle>{plan.name}</CardTitle>
									<CardDescription className='mt-1'>
										{plan.tagline}
									</CardDescription>
								</div>
								<div>
									<div className='flex items-end gap-1'>
										<span className='text-3xl font-semibold tracking-tight'>
											{formatPrice(price)}
										</span>
										{price !== null && (
											<span className='pb-1 text-sm text-muted-foreground'>
												/{interval === 'monthly' ? 'mo' : 'yr'}
											</span>
										)}
									</div>
									<p className='mt-1 text-xs text-muted-foreground'>
										{price === null ? plan.priceSuffix : 'plus applicable VAT'}
									</p>
								</div>
								<p className='text-sm text-muted-foreground'>
									{plan.description}
								</p>
							</CardHeader>
							<CardContent className='flex flex-1 flex-col gap-5'>
								<ul className='space-y-3 text-sm'>
									{plan.features.map((feature) => (
										<li key={feature} className='flex gap-2'>
											<Check className='mt-0.5 h-4 w-4 shrink-0 text-foreground' />
											<span>{feature}</span>
										</li>
									))}
								</ul>
								<Button
									type='button'
									className='mt-auto w-full'
									variant={plan.highlight ? 'default' : 'outline'}
									disabled={isCurrent || isLoading}
									onClick={() => handlePlanAction(plan.id, plan.isEnterprise)}>
									{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
									{buttonText}
								</Button>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
