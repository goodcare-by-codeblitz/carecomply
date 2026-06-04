'use client';

import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';

export default function BillingRequiredPage() {
	const params = useParams();
	const router = useRouter();
	const orgSlug = params.orgSlug as string;

	function goToBilling() {
		router.push(`/${orgSlug}/settings/billing`);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
			<div className="w-full max-w-md space-y-6 rounded-2xl border bg-background p-8 shadow-sm">
				<div className="flex flex-col items-center gap-4 text-center">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
						<AlertTriangle className="h-7 w-7 text-destructive" />
					</div>

					<div className="space-y-1.5">
						<h1 className="text-xl font-semibold tracking-tight">
							Subscription required
						</h1>
						<p className="text-sm text-muted-foreground">
							Your CareComply subscription has ended. Resubscribe to
							restore access to your compliance workspace.
						</p>
					</div>
				</div>

				<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
					<p className="font-medium text-foreground">Your data is safe</p>
					<p>
						All carer records, documents, references, and audit history are
						preserved and will be accessible immediately after you resubscribe.
					</p>
				</div>

				<div className="space-y-3">
					<Button onClick={goToBilling} className="w-full gap-2">
						<CreditCard className="h-4 w-4" />
						Resubscribe now
						<ArrowRight className="h-4 w-4" />
					</Button>

					<p className="text-center text-xs text-muted-foreground">
						Questions? Email{' '}
						<a
							href="mailto:support@carecomply.co.uk"
							className="underline underline-offset-2 hover:text-foreground"
						>
							support@carecomply.co.uk
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
