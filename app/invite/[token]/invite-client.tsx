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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type InviteClientProps = {
	token?: string;
};

type InvitationView = OrganizationInvitation & {
	organization?: { name: string; slug: string } | null;
	role?: { name: string } | null;
};

function isExpired(invitation: OrganizationInvitation) {
	return Boolean(
		invitation.expires_at && new Date(invitation.expires_at) < new Date(),
	);
}

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
			const inviteToken =
				token ?? window.location.pathname.split('/').filter(Boolean).pop();

			if (!inviteToken) {
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			const supabase = createClient();
			const [
				{
					data: { user },
				},
				response,
			] = await Promise.all([
				supabase.auth.getUser(),
				fetch(
					`/api/invitations/details?token=${encodeURIComponent(inviteToken)}`,
				),
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
		if (invitation.status === 'expired' || isExpired(invitation)) {
			return 'expired';
		}
		return 'pending';
	}, [invitation]);

	const inviteToken = token ?? (typeof window !== 'undefined'
		? window.location.pathname.split('/').filter(Boolean).pop()
		: null);
	const organization = invitation?.organization;
	const role = invitation?.role;
	const currentUserMatchesInvite =
		currentUserEmail?.trim().toLowerCase() ===
		invitation?.email.trim().toLowerCase();
	const loginHref = invitation
		? `/auth/login?${new URLSearchParams({
				email: invitation.email,
				next: 'invite',
				token: inviteToken ?? '',
			}).toString()}`
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
			if (password.length < 8) {
				setError('Password must be at least 8 characters.');
				return;
			}

			if (password !== confirmPassword) {
				setError('Passwords do not match.');
				return;
			}
		}

		setIsAccepting(true);
		try {
			const response = await fetch('/api/invitations/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: inviteToken,
					password: currentUserEmail ? undefined : password,
				}),
			});
			const payload = (await response.json()) as {
				error?: string;
				code?: string;
				orgSlug?: string | null;
				email?: string;
				createdUser?: boolean;
			};

			if (!response.ok) {
				if (payload.code === 'existing_account') {
					setExistingAccount(true);
				}
				setError(payload.error ?? 'Invitation could not be accepted.');
				return;
			}

			if (payload.createdUser) {
				const supabase = createClient();
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email: payload.email ?? invitation.email,
					password,
				});

				if (signInError) {
					setError('Account created. Please log in with your new password.');
					return;
				}
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
			<div className='flex min-h-screen items-center justify-center p-6'>
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-muted/30 p-6'>
			<Card className='w-full max-w-lg'>
				<CardHeader className='text-center'>
					<div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background'>
						<MailCheck className='h-6 w-6 text-muted-foreground' />
					</div>
					<CardTitle>Invitation</CardTitle>
					<CardDescription>
						{organization?.name
							? `Join ${organization.name} on CareComply.`
							: 'Review your CareComply invitation.'}
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-4 text-center'>
					{setupMissing ? (
						<p className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
							{INVITATION_SETUP_MESSAGE}
						</p>
					) : invitation ? (
						<>
							<div className='space-y-2'>
								<Badge variant={inviteState === 'pending' ? 'default' : 'outline'}>
									{inviteState}
								</Badge>
								<p className='text-sm text-muted-foreground'>
									{invitation.email}
								</p>
								{role?.name && (
									<p className='text-sm text-muted-foreground'>
										Role: {role.name}
									</p>
								)}
							</div>
							{inviteState === 'pending' &&
							invitation.invite_type === 'team_member' ? (
								<div className='space-y-4 text-left'>
									{currentUserEmail && !currentUserMatchesInvite ? (
										<p className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
											You are logged in as {currentUserEmail}. Log out and use{' '}
											{invitation.email} to accept this invitation.
										</p>
									) : currentUserEmail ? (
										<p className='rounded-md border p-3 text-sm text-muted-foreground'>
											You are logged in as {currentUserEmail}. Accepting will add
											this account to the organization.
										</p>
									) : (
										<>
											<div className='space-y-2'>
												<Label htmlFor='password'>Create password</Label>
												<Input
													id='password'
													type='password'
													value={password}
													onChange={(event) => setPassword(event.target.value)}
													placeholder='At least 8 characters'
												/>
											</div>
											<div className='space-y-2'>
												<Label htmlFor='confirm-password'>
													Confirm password
												</Label>
												<Input
													id='confirm-password'
													type='password'
													value={confirmPassword}
													onChange={(event) =>
														setConfirmPassword(event.target.value)
													}
													placeholder='Repeat password'
												/>
											</div>
										</>
									)}
									{error && <p className='text-sm text-destructive'>{error}</p>}
									<div className='flex flex-col gap-2'>
										<Button
											type='button'
											onClick={acceptInvitation}
											disabled={
												isAccepting ||
												Boolean(currentUserEmail && !currentUserMatchesInvite)
											}>
											{isAccepting ? 'Accepting...' : 'Accept invitation'}
										</Button>
										{(!currentUserEmail || existingAccount) && (
											<Button variant='outline' asChild>
												<Link href={loginHref}>
													I already have an account
												</Link>
											</Button>
										)}
									</div>
								</div>
							) : inviteState === 'pending' ? (
								<div className='space-y-3'>
									<p className='text-sm text-muted-foreground'>
										This invitation is for carer onboarding.
									</p>
									{inviteToken && (
										<Button asChild>
											<Link href={`/onboarding/${inviteToken}`}>
												Continue to onboarding
											</Link>
										</Button>
									)}
								</div>
							) : (
								<p className='text-sm text-muted-foreground'>
									This invitation cannot be accepted because it is {inviteState}.
								</p>
							)}
						</>
					) : (
						<p className='text-sm text-muted-foreground'>
							This invitation link could not be found.
						</p>
					)}
					<Button variant='outline' asChild>
						<Link href='/auth/login'>Go to login</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
