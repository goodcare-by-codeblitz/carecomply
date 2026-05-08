'use client';

import { Button } from '@/components/ui/button';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getInvitationLink, INVITATION_SETUP_MESSAGE } from '@/lib/invitations';
import { Copy, Link2, Mail, RefreshCw, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type InviteLinkCardProps = {
	inviteId?: string | null;
	inviteToken?: string | null;
	inviteExpiresAt?: string | null;
	inviteStatus?: string | null;
	carerName: string;
	carerEmail: string;
};

export function InviteLinkCard({
	inviteId,
	inviteToken,
	inviteExpiresAt,
	inviteStatus,
	carerName,
	carerEmail,
}: InviteLinkCardProps) {
	const [copied, setCopied] = useState(false);
	const [currentToken, setCurrentToken] = useState(inviteToken);
	const [currentStatus, setCurrentStatus] = useState(inviteStatus);
	const [currentExpiresAt, setCurrentExpiresAt] = useState(inviteExpiresAt);
	const [isSending, setIsSending] = useState(false);
	const [isManaging, setIsManaging] = useState(false);
	const inviteLink = useMemo(() => {
		if (!currentToken || typeof window === 'undefined') return '';
		return getInvitationLink(currentToken, window.location.origin, 'carer');
	}, [currentToken]);
	const isExpired = Boolean(
		currentExpiresAt && new Date(currentExpiresAt) < new Date(),
	);
	const canUseInvite = Boolean(
		inviteId &&
			currentToken &&
			currentStatus !== 'revoked' &&
			currentStatus !== 'accepted' &&
			currentStatus !== 'expired' &&
			!isExpired,
	);

	const copyLink = async () => {
		if (!inviteLink) return;
		await navigator.clipboard.writeText(inviteLink);
		setCopied(true);
		toast.success('Invite link copied');
		setTimeout(() => setCopied(false), 1500);
	};

	const sendInviteEmail = async () => {
		if (!currentToken) return;

		setIsSending(true);
		try {
			const response = await fetch('/api/send-invite-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: carerEmail,
					token: currentToken,
				}),
			});
			const payload = (await response.json()) as { error?: string };

			if (!response.ok) {
				toast.warning(payload.error ?? 'Invite email could not be sent');
				return;
			}

			toast.success('Invite email sent');
		} catch {
			toast.error('Invite email could not be sent');
		} finally {
			setIsSending(false);
		}
	};

	const manageInvitation = async (action: 'revoke' | 'reinvite') => {
		if (!inviteId) return;

		setIsManaging(true);
		try {
			const response = await fetch('/api/invitations/manage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					invitationId: inviteId,
					action,
				}),
			});
			const payload = (await response.json()) as {
				error?: string;
				invitation?: {
					status?: string | null;
					token?: string | null;
					expires_at?: string | null;
				};
			};

			if (!response.ok) {
				toast.error(payload.error ?? 'Invitation could not be updated');
				return;
			}

			setCurrentStatus(payload.invitation?.status ?? null);
			setCurrentToken(payload.invitation?.token ?? currentToken);
			setCurrentExpiresAt(payload.invitation?.expires_at ?? currentExpiresAt);
			toast.success(
				action === 'reinvite' ? 'Invitation regenerated' : 'Invitation revoked',
			);
		} catch {
			toast.error('Invitation could not be updated');
		} finally {
			setIsManaging(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>Invite Link</CardTitle>
				<CardDescription>
					Share onboarding access with {carerName || carerEmail}.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-3'>
				<div className='flex gap-2'>
					<Input
						readOnly
						value={
							inviteLink ||
							'Organization invitation setup required before links can be generated'
						}
						className='font-mono text-xs'
					/>
					<Button
						type='button'
						variant='outline'
						size='icon'
						disabled={!inviteLink || !canUseInvite}
						onClick={copyLink}>
						{copied ? (
							<Link2 className='h-4 w-4' />
						) : (
							<Copy className='h-4 w-4' />
						)}
					</Button>
				</div>
				{currentStatus && (
					<p className='text-xs text-muted-foreground'>
						Status: {currentStatus}
					</p>
				)}
				{currentExpiresAt && (
					<p className='text-xs text-muted-foreground'>
						Expires {new Date(currentExpiresAt).toLocaleDateString()}.
					</p>
				)}
				<div className='grid gap-2 sm:grid-cols-3'>
					<Button
						type='button'
						variant='outline'
						size='sm'
						disabled={!canUseInvite || isSending}
						onClick={sendInviteEmail}>
						<Mail className='mr-2 h-4 w-4' />
						{isSending ? 'Sending...' : 'Email'}
					</Button>
					{currentStatus === 'revoked' ? (
						<Button
							type='button'
							variant='outline'
							size='sm'
							disabled={!inviteId || isManaging}
							onClick={() => manageInvitation('reinvite')}>
							<RefreshCw className='mr-2 h-4 w-4' />
							Reinvite
						</Button>
					) : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									type='button'
									variant='outline'
									size='sm'
									disabled={!canUseInvite || isManaging}>
									<XCircle className='mr-2 h-4 w-4' />
									Revoke
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
									<AlertDialogDescription>
										The current onboarding link will stop working immediately.
										You can reinvite {carerName || carerEmail} later with a new
										link.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										variant='destructive'
										onClick={() => manageInvitation('revoke')}>
										Revoke invitation
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
				{!currentToken && (
					<p className='text-xs text-muted-foreground'>
						{INVITATION_SETUP_MESSAGE}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
