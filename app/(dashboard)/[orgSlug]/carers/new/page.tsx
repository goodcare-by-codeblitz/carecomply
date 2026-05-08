'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { ArrowLeft, Copy, Check, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { newCarerSchema, type NewCarerInput } from '@/lib/validations';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import {
	createInvitationToken,
	getInvitationLink,
	getInviteExpiry,
	INVITATION_SETUP_MESSAGE,
	isInvitationSetupMissing,
} from '@/lib/invitations';
import { logAction } from '@/lib/audit';

export default function NewCarerPage() {
	const [formData, setFormData] = useState<NewCarerInput>({
		fullName: '',
		email: '',
		phone: '',
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof NewCarerInput, string>>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const [createdCarer, setCreatedCarer] = useState<{
		id: string;
		inviteToken?: string | null;
		inviteExpiresAt?: string | null;
	} | null>(null);
	const [copied, setCopied] = useState(false);
	const [isSendingInviteEmail, setIsSendingInviteEmail] = useState(false);
	const { orgSlug } = useParams<{ orgSlug: string }>();

	const sendCarerInviteEmail = async (email: string, token: string | null) => {
		if (!token) {
			return { ok: false, message: 'This invitation does not have a token.' };
		}

		try {
			const response = await fetch('/api/send-invite-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					token,
				}),
			});
			const payload = (await response.json()) as { error?: string };

			if (!response.ok) {
				return {
					ok: false,
					message: payload.error ?? 'Invite email could not be sent.',
				};
			}

			return { ok: true, message: null };
		} catch {
			return { ok: false, message: 'Invite email could not be sent.' };
		}
	};

	const validateField = (field: keyof NewCarerInput, value: string) => {
		const result = newCarerSchema.shape[field].safeParse(value);
		if (!result.success) {
			setErrors((prev) => ({
				...prev,
				[field]: result.error.issues[0].message,
			}));
		} else {
			setErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[field];
				return newErrors;
			});
		}
	};

	const handleChange = (field: keyof NewCarerInput, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) {
			validateField(field, value);
		}
	};

	const handleBlur = (field: keyof NewCarerInput) => {
		validateField(field, formData[field] || '');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validate all fields
		const result = newCarerSchema.safeParse(formData);
		if (!result.success) {
			const fieldErrors: Partial<Record<keyof NewCarerInput, string>> = {};
			result.error.issues.forEach((err) => {
				if (err.path[0]) {
					fieldErrors[err.path[0] as keyof NewCarerInput] = err.message;
				}
			});
			setErrors(fieldErrors);
			return;
		}

		setIsLoading(true);

		try {
			const supabase = createClient();

			// Get current user's organization
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const organization = await getCurrentOrgBySlug(supabase, user.id, orgSlug);

			if (!organization?.id) {
				throw new Error('No organization found');
			}

			const { data: carer, error } = await supabase
				.from('carers')
				.insert({
					organization_id: organization.id,
					full_name: formData.fullName,
					email: formData.email,
					phone: formData.phone || null,
					status: 'pending',
					onboarding_progress: 0,
				})
				.select('id')
				.single();

			if (error) throw error;

			const inviteToken = createInvitationToken();
			const inviteExpiresAt = getInviteExpiry(30);
			let inviteData = {
				id: carer.id,
				inviteToken: null as string | null,
				inviteExpiresAt: null as string | null,
			};

			const { data: invitation, error: inviteError } = await supabase
				.from('organization_invitations')
				.insert({
					organization_id: organization.id,
					invite_type: 'carer',
					email: formData.email.trim().toLowerCase(),
					token: inviteToken,
					status: 'pending',
					carer_id: carer.id,
					invited_by: user.id,
					expires_at: inviteExpiresAt,
				})
				.select('id, token, expires_at')
				.single();

			if (inviteError) {
				if (isInvitationSetupMissing(inviteError)) {
					toast.info(INVITATION_SETUP_MESSAGE);
				} else {
					console.error('Failed to create carer invitation:', inviteError);
					toast.warning('Carer added, but invitation could not be created');
				}
			}

			if (invitation) {
				inviteData = {
					id: carer.id,
					inviteToken: invitation.token,
					inviteExpiresAt: invitation.expires_at,
				};
			}

			await logAction({
				orgId: organization.id,
				action: 'carer.created',
				entityType: 'carer',
				entityId: carer.id,
				entityName: formData.fullName,
				details: {
					email: formData.email.trim().toLowerCase(),
					phone: formData.phone || null,
					status: 'pending',
					onboarding_progress: 0,
					outcome: 'carer_profile_created',
				},
			});

			if (invitation) {
				await logAction({
					orgId: organization.id,
					action: 'carer.invited',
					entityType: 'invitation',
					entityId: invitation.id,
					entityName: formData.email.trim().toLowerCase(),
					details: {
						carer_id: carer.id,
						carer_name: formData.fullName,
						invite_type: 'carer',
						expires_at: invitation.expires_at,
						outcome: 'carer_onboarding_invitation_created',
					},
				});
			}

			setCreatedCarer(inviteData);
			if (inviteData.inviteToken) {
				const emailResult = await sendCarerInviteEmail(
					formData.email.trim().toLowerCase(),
					inviteData.inviteToken,
				);

				if (emailResult.ok) {
					toast.success('Carer added and invite email sent');
				} else {
					toast.warning(
						`Carer added, but invite email was not sent. ${emailResult.message}`,
					);
				}
			} else {
				toast.success('Carer added successfully');
			}
		} catch (err) {
			console.error(err);
			toast.error('Failed to add carer');
		} finally {
			setIsLoading(false);
		}
	};

	const getInviteLink = () => {
		if (!createdCarer?.inviteToken) return '';
		return getInvitationLink(
			createdCarer.inviteToken,
			window.location.origin,
			'carer',
		);
	};

	const copyLink = async () => {
		if (!createdCarer?.inviteToken) return;
		await navigator.clipboard.writeText(getInviteLink());
		setCopied(true);
		toast.success('Link copied to clipboard');
		setTimeout(() => setCopied(false), 2000);
	};

	const resendCarerInviteEmail = async () => {
		if (!createdCarer?.inviteToken) return;

		setIsSendingInviteEmail(true);
		const emailResult = await sendCarerInviteEmail(
			formData.email.trim().toLowerCase(),
			createdCarer.inviteToken,
		);
		setIsSendingInviteEmail(false);

		if (emailResult.ok) {
			toast.success('Invite email sent');
		} else {
			toast.warning(emailResult.message);
		}
	};

	// Success state - show invite link
	if (createdCarer) {
		return (
			<div className='p-8 max-w-2xl mx-auto'>
				<Link
					href={`/${orgSlug}/carers`}
					className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors'>
					<ArrowLeft className='w-4 h-4' />
					Back to carers
				</Link>

				<Card>
					<CardHeader className='text-center pb-2'>
						<div className='w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4'>
							<Check className='w-6 h-6 text-green-600' />
						</div>
						<CardTitle>Carer Added Successfully</CardTitle>
						<CardDescription className='text-base mt-2'>
							Share the onboarding link below with{' '}
							<span className='font-medium text-foreground'>
								{formData.fullName}
							</span>{' '}
							so they can upload their required documents.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-6'>
						{/* Invite link */}
						<div className='space-y-2'>
							<Label>Onboarding Link</Label>
							<div className='flex gap-2'>
								<Input
									readOnly
									value={
										getInviteLink() ||
										'Invitation setup required before links can be generated'
									}
									className='h-11 bg-muted/50 font-mono text-sm'
								/>
								<Button
									variant='outline'
									size='icon'
									className='h-11 w-11 shrink-0'
									onClick={copyLink}
									disabled={!createdCarer.inviteToken}>
									{copied ? (
										<Check className='w-4 h-4 text-green-600' />
									) : (
										<Copy className='w-4 h-4' />
									)}
								</Button>
							</div>
							<p className='text-xs text-muted-foreground'>
								{createdCarer.inviteToken
									? 'This link expires in 30 days. The carer can use it to upload their compliance documents.'
									: 'Add organization_invitations later to enable onboarding links.'}
							</p>
						</div>

						{/* Email option */}
						<div className='border-t pt-6'>
							<Button
								variant='outline'
								className='w-full h-11'
								disabled={!createdCarer.inviteToken || isSendingInviteEmail}
								onClick={resendCarerInviteEmail}>
								<Mail className='w-4 h-4 mr-2' />
								{isSendingInviteEmail ? 'Sending...' : 'Send invite email'}
							</Button>
						</div>

						{/* Actions */}
						<div className='flex gap-3 pt-2'>
							<Button variant='outline' asChild className='flex-1'>
								<Link href={`/${orgSlug}/carers`}>View All Carers</Link>
							</Button>
							<Button
								className='flex-1'
								onClick={() => {
									setCreatedCarer(null);
									setFormData({ fullName: '', email: '', phone: '' });
								}}>
								Add Another Carer
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='p-8 max-w-2xl mx-auto'>
			{/* Back link */}
			<Link
				href={`/${orgSlug}/carers`}
				className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors'>
				<ArrowLeft className='w-4 h-4' />
				Back to carers
			</Link>

			<Card>
				<CardHeader>
					<CardTitle>Add New Carer</CardTitle>
					<CardDescription>
						Enter the carer&apos;s details. They will receive a link to upload
						their compliance documents.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className='space-y-6'>
						<div className='space-y-2'>
							<Label htmlFor='fullName'>Full Name</Label>
							<Input
								id='fullName'
								value={formData.fullName}
								onChange={(e) => handleChange('fullName', e.target.value)}
								onBlur={() => handleBlur('fullName')}
								placeholder='Jane Smith'
								className={`h-11 ${errors.fullName ? 'border-destructive' : ''}`}
							/>
							{errors.fullName && (
								<p className='text-xs text-destructive'>{errors.fullName}</p>
							)}
						</div>

						<div className='space-y-2'>
							<Label htmlFor='email'>Email Address</Label>
							<Input
								id='email'
								type='email'
								value={formData.email}
								onChange={(e) => handleChange('email', e.target.value)}
								onBlur={() => handleBlur('email')}
								placeholder='jane@example.com'
								className={`h-11 ${errors.email ? 'border-destructive' : ''}`}
							/>
							{errors.email && (
								<p className='text-xs text-destructive'>{errors.email}</p>
							)}
						</div>

						<div className='space-y-2'>
							<Label htmlFor='phone'>Phone Number (Optional)</Label>
							<Input
								id='phone'
								type='tel'
								value={formData.phone}
								onChange={(e) => handleChange('phone', e.target.value)}
								onBlur={() => handleBlur('phone')}
								placeholder='+44 7700 900000'
								className={`h-11 ${errors.phone ? 'border-destructive' : ''}`}
							/>
							{errors.phone && (
								<p className='text-xs text-destructive'>{errors.phone}</p>
							)}
						</div>

						<div className='flex gap-3 pt-4'>
							<Button
								type='button'
								variant='outline'
								asChild
								className='flex-1'>
								<Link href={`/${orgSlug}/carers`}>Cancel</Link>
							</Button>
							<Button type='submit' className='flex-1' disabled={isLoading}>
								{isLoading ? 'Adding...' : 'Add Carer & Generate Link'}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
