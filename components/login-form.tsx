'use client';

import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initOrgStore } from '@/lib/init-org';
import { initProfile } from '@/lib/init-profile';
import { getOrgRedirectPath, type UserOrganization } from '@/lib/orgs';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const PENDING_CREATE_ORG_KEY = 'carecomply_pending_create_org';

type PendingCreateOrg = {
	email?: string;
	orgName?: string;
	orgSlug?: string;
	plan?: string;
	interval?: string;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		throw new Error('Login failed. Please try again.');
	}

	return (await response.json()) as T;
}

export function LoginForm({
	className,
	...props
}: React.ComponentPropsWithoutRef<'div'>) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [inviteRedirect, setInviteRedirect] = useState<string | null>(null);
	const router = useRouter();

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const emailParam = params.get('email');
		const nextParam = params.get('next');
		const tokenParam = params.get('token');

		if (emailParam) {
			setEmail(emailParam);
		}

		if (nextParam === 'create-org') {
			setNotice('Log in to add a new organization to your account.');
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
			if (pending.email?.toLowerCase() !== loginEmail.trim().toLowerCase()) {
				return null;
			}

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

	const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
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
			}>(response);

			if (!response.ok || !payload.organizations) {
				throw new Error(payload.error || 'Login failed. Please try again.');
			}

			// Update this route to redirect to an authenticated route. The user already has an active session.
			await initProfile();
			await initOrgStore();

			const organizations = payload.organizations;
			const pendingCreateOrgRedirect =
				organizations.length === 0 || organizations.length === 1
					? getCreateOrgRedirect(email)
					: null;

			router.push(
				inviteRedirect ??
					pendingCreateOrgRedirect ??
					getOrgRedirectPath(organizations),
			);
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : 'An error occurred');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className='text-2xl'>Login</CardTitle>
					<CardDescription>
						Enter your email below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					{notice && (
						<p className='mb-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground'>
							{notice}
						</p>
					)}
					<form onSubmit={handleLogin}>
						<div className='flex flex-col gap-6'>
							<div className='grid gap-2'>
								<Label htmlFor='email'>Email</Label>
								<Input
									id='email'
									type='email'
									placeholder='m@example.com'
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className='grid gap-2'>
								<div className='flex items-center'>
									<Label htmlFor='password'>Password</Label>
									<Link
										href='/auth/forgot-password'
										className='ml-auto inline-block text-sm underline-offset-4 hover:underline'>
										Forgot your password?
									</Link>
								</div>
								<Input
									id='password'
									type='password'
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>
							{error && <p className='text-sm text-red-500'>{error}</p>}
							<Button type='submit' className='w-full' disabled={isLoading}>
								{isLoading ? 'Logging in...' : 'Login'}
							</Button>
						</div>
						<div className='mt-4 text-center text-sm'>
							Don&apos;t have an account?{' '}
							<Link
								href='/pricing'
								className='underline underline-offset-4'>
								Sign up
							</Link>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
