'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Copy, Check, Mail, UserPlus } from 'lucide-react';
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
		addressLine1: '',
		addressLine2: '',
		city: '',
		county: '',
		postcode: '',
		emergencyContactName: '',
		emergencyContactRelationship: '',
		emergencyContactPhone: '',
		emergencyContactEmail: '',
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
				body: JSON.stringify({ email, token }),
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) {
				return { ok: false, message: payload.error ?? 'Invite email could not be sent.' };
			}
			return { ok: true, message: null };
		} catch {
			return { ok: false, message: 'Invite email could not be sent.' };
		}
	};

	const validateField = (field: keyof NewCarerInput, value: string) => {
		const result = newCarerSchema.safeParse({ ...formData, [field]: value });
		if (!result.success) {
			const issue = result.error.issues.find((err) => err.path[0] === field);
			if (!issue) {
				setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
				return;
			}
			setErrors((prev) => ({ ...prev, [field]: issue.message }));
		} else {
			setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
		}
	};

	const handleChange = (field: keyof NewCarerInput, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) validateField(field, value);
	};

	const handleBlur = (field: keyof NewCarerInput) => {
		validateField(field, formData[field] || '');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = newCarerSchema.safeParse(formData);
		if (!result.success) {
			const fieldErrors: Partial<Record<keyof NewCarerInput, string>> = {};
			result.error.issues.forEach((err) => {
				if (err.path[0]) fieldErrors[err.path[0] as keyof NewCarerInput] = err.message;
			});
			setErrors(fieldErrors);
			return;
		}
		setIsLoading(true);
		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');
			const organization = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
			if (!organization?.id) throw new Error('No organization found');

			const { data: carer, error } = await supabase
				.from('carers')
				.insert({
					organization_id: organization.id,
					full_name: formData.fullName,
					email: formData.email,
					phone: formData.phone || null,
					address_line1: formData.addressLine1 || null,
					address_line2: formData.addressLine2 || null,
					city: formData.city || null,
					county: formData.county || null,
					postcode: formData.postcode || null,
					emergency_contact_name: formData.emergencyContactName || null,
					emergency_contact_relationship: formData.emergencyContactRelationship || null,
					emergency_contact_phone: formData.emergencyContactPhone || null,
					emergency_contact_email: formData.emergencyContactEmail || null,
					status: 'pending',
					onboarding_progress: 0,
				})
				.select('id')
				.single();
			if (error) throw error;

			const inviteToken = createInvitationToken();
			const inviteExpiresAt = getInviteExpiry(30);
			let inviteData = { id: carer.id, inviteToken: null as string | null, inviteExpiresAt: null as string | null };

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
				inviteData = { id: carer.id, inviteToken: invitation.token, inviteExpiresAt: invitation.expires_at };
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
					address: { line1: formData.addressLine1 || null, line2: formData.addressLine2 || null, city: formData.city || null, county: formData.county || null, postcode: formData.postcode || null },
					emergency_contact: { name: formData.emergencyContactName || null, relationship: formData.emergencyContactRelationship || null, phone: formData.emergencyContactPhone || null, email: formData.emergencyContactEmail || null },
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
					details: { carer_id: carer.id, carer_name: formData.fullName, invite_type: 'carer', expires_at: invitation.expires_at, outcome: 'carer_onboarding_invitation_created' },
				});
			}

			setCreatedCarer(inviteData);
			if (inviteData.inviteToken) {
				const emailResult = await sendCarerInviteEmail(formData.email.trim().toLowerCase(), inviteData.inviteToken);
				if (emailResult.ok) {
					toast.success('Carer added and invite email sent');
				} else {
					toast.warning(`Carer added, but invite email was not sent. ${emailResult.message}`);
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
		return getInvitationLink(createdCarer.inviteToken, window.location.origin, 'carer');
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
		const emailResult = await sendCarerInviteEmail(formData.email.trim().toLowerCase(), createdCarer.inviteToken);
		setIsSendingInviteEmail(false);
		if (emailResult.ok) { toast.success('Invite email sent'); }
		else { toast.warning(emailResult.message); }
	};

	// ── Shared page shell ─────────────────────────────────────────
	const pageHeader = (
		<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
			<div className='mx-auto max-w-2xl'>
				<Link
					href={`/${orgSlug}/carers`}
					className='inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-ink mb-3 transition-colors'>
					<ArrowLeft className='h-3.5 w-3.5' />
					Back to carers
				</Link>
				<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Add New Carer</h1>
				<p className='mt-0.5 text-[13px] text-slate-500'>
					Enter the carer&apos;s details. They will receive an onboarding link to upload their compliance documents.
				</p>
			</div>
		</div>
	);

	// ── Success state ─────────────────────────────────────────────
	if (createdCarer) {
		return (
			<div className='min-h-full'>
				{pageHeader}
				<div className='mx-auto max-w-2xl px-6 py-6 lg:px-8'>
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='border-b border-line bg-surface-page px-5 py-4 text-center'>
							<div className='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ok-50'>
								<Check className='h-5 w-5 text-ok' />
							</div>
							<h2 className='text-[15px] font-semibold text-ink'>Carer Added Successfully</h2>
							<p className='mt-1 text-[13px] text-slate-500'>
								Share the onboarding link below with{' '}
								<span className='font-medium text-ink'>{formData.fullName}</span>{' '}
								so they can upload their required documents.
							</p>
						</div>
						<div className='space-y-5 p-5'>
							<div className='space-y-1.5'>
								<Label className='text-[13px] font-medium text-ink'>Onboarding Link</Label>
								<div className='flex gap-2'>
									<Input
										readOnly
										value={getInviteLink() || 'Invitation setup required before links can be generated'}
										className='h-9 bg-surface-muted/50 font-mono text-[12.5px]'
									/>
									<Button
										variant='outline'
										size='icon'
										className='h-9 w-9 shrink-0'
										onClick={copyLink}
										disabled={!createdCarer.inviteToken}>
										{copied ? <Check className='h-4 w-4 text-ok' /> : <Copy className='h-4 w-4' />}
									</Button>
								</div>
								<p className='text-[12px] text-slate-500'>
									{createdCarer.inviteToken
										? 'Expires in 30 days. The carer uses it to upload their compliance documents.'
										: 'Add organization_invitations later to enable onboarding links.'}
								</p>
							</div>
							<div className='border-t border-line pt-5'>
								<Button
									variant='outline'
									className='w-full'
									disabled={!createdCarer.inviteToken || isSendingInviteEmail}
									onClick={resendCarerInviteEmail}>
									<Mail className='h-4 w-4' />
									{isSendingInviteEmail ? 'Sending...' : 'Send invite email'}
								</Button>
							</div>
							<div className='flex gap-3'>
								<Button variant='outline' asChild className='flex-1'>
									<Link href={`/${orgSlug}/carers`}>View All Carers</Link>
								</Button>
								<Button
									className='flex-1'
									onClick={() => {
										setCreatedCarer(null);
										setFormData({ fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '', county: '', postcode: '', emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '', emergencyContactEmail: '' });
									}}>
									Add Another Carer
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ── Form ──────────────────────────────────────────────────────
	return (
		<div className='min-h-full'>
			{pageHeader}
			<div className='mx-auto max-w-2xl px-6 py-6 lg:px-8'>
				<form onSubmit={handleSubmit}>
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						{/* Card header */}
						<div className='flex items-center gap-3 border-b border-line bg-surface-page px-5 py-3.5'>
							<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
								<UserPlus className='h-4 w-4 text-brand-700' />
							</div>
							<div>
								<p className='text-[13.5px] font-semibold text-ink'>Carer details</p>
								<p className='text-[12px] text-slate-500'>Required fields are marked with *</p>
							</div>
						</div>

						<div className='space-y-5 p-5'>
							{/* Basic info */}
							<div className='space-y-3'>
								<div className='space-y-1.5'>
									<Label htmlFor='fullName' className='text-[13px] font-medium text-ink'>
										Full name <span className='text-slate-400'>*</span>
									</Label>
									<Input
										id='fullName'
										value={formData.fullName}
										onChange={(e) => handleChange('fullName', e.target.value)}
										onBlur={() => handleBlur('fullName')}
										placeholder='Jane Smith'
										className={`text-[13.5px] ${errors.fullName ? 'border-destructive' : ''}`}
									/>
									{errors.fullName && <p className='text-[12px] text-destructive'>{errors.fullName}</p>}
								</div>

								<div className='grid gap-3 sm:grid-cols-2'>
									<div className='space-y-1.5'>
										<Label htmlFor='email' className='text-[13px] font-medium text-ink'>
											Work email <span className='text-slate-400'>*</span>
										</Label>
										<Input
											id='email'
											type='email'
											value={formData.email}
											onChange={(e) => handleChange('email', e.target.value)}
											onBlur={() => handleBlur('email')}
											placeholder='jane@example.com'
											className={`text-[13.5px] ${errors.email ? 'border-destructive' : ''}`}
										/>
										{errors.email && <p className='text-[12px] text-destructive'>{errors.email}</p>}
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='phone' className='text-[13px] font-medium text-ink'>
											Phone <span className='text-[12px] text-slate-400 font-normal'>(optional)</span>
										</Label>
										<Input
											id='phone'
											type='tel'
											value={formData.phone}
											onChange={(e) => handleChange('phone', e.target.value)}
											onBlur={() => handleBlur('phone')}
											placeholder='+44 7700 900000'
											className={`text-[13.5px] ${errors.phone ? 'border-destructive' : ''}`}
										/>
										{errors.phone && <p className='text-[12px] text-destructive'>{errors.phone}</p>}
									</div>
								</div>
							</div>

							{/* Address */}
							<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
								<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Address</p>
								<div className='grid gap-3 sm:grid-cols-2'>
									<div className='space-y-1.5 sm:col-span-2'>
										<Label htmlFor='addressLine1' className='text-[12.5px] text-slate-600'>Address line 1</Label>
										<Input
											id='addressLine1'
											value={formData.addressLine1}
											onChange={(e) => handleChange('addressLine1', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5 sm:col-span-2'>
										<Label htmlFor='addressLine2' className='text-[12.5px] text-slate-600'>Address line 2</Label>
										<Input
											id='addressLine2'
											value={formData.addressLine2}
											onChange={(e) => handleChange('addressLine2', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='city' className='text-[12.5px] text-slate-600'>Town / city</Label>
										<Input
											id='city'
											value={formData.city}
											onChange={(e) => handleChange('city', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='county' className='text-[12.5px] text-slate-600'>County</Label>
										<Input
											id='county'
											value={formData.county}
											onChange={(e) => handleChange('county', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='postcode' className='text-[12.5px] text-slate-600'>Postcode</Label>
										<Input
											id='postcode'
											value={formData.postcode}
											onChange={(e) => handleChange('postcode', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
								</div>
							</div>

							{/* Emergency contact */}
							<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
								<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Emergency contact</p>
								<div className='grid gap-3 sm:grid-cols-2'>
									<div className='space-y-1.5'>
										<Label htmlFor='emergencyContactName' className='text-[12.5px] text-slate-600'>Full name</Label>
										<Input
											id='emergencyContactName'
											value={formData.emergencyContactName}
											onChange={(e) => handleChange('emergencyContactName', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='emergencyContactRelationship' className='text-[12.5px] text-slate-600'>Relationship</Label>
										<Input
											id='emergencyContactRelationship'
											value={formData.emergencyContactRelationship}
											onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='emergencyContactPhone' className='text-[12.5px] text-slate-600'>Phone</Label>
										<Input
											id='emergencyContactPhone'
											type='tel'
											value={formData.emergencyContactPhone}
											onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
											className={`text-[13.5px] ${errors.emergencyContactPhone ? 'border-destructive' : ''}`}
										/>
										{errors.emergencyContactPhone && <p className='text-[12px] text-destructive'>{errors.emergencyContactPhone}</p>}
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='emergencyContactEmail' className='text-[12.5px] text-slate-600'>Email</Label>
										<Input
											id='emergencyContactEmail'
											type='email'
											value={formData.emergencyContactEmail}
											onChange={(e) => handleChange('emergencyContactEmail', e.target.value)}
											className='text-[13.5px]'
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Footer actions */}
						<div className='flex items-center justify-end gap-3 border-t border-line bg-surface-page px-5 py-4'>
							<Button type='button' variant='outline' asChild>
								<Link href={`/${orgSlug}/carers`}>Cancel</Link>
							</Button>
							<Button type='submit' disabled={isLoading}>
								{isLoading ? 'Adding...' : 'Add Carer & Generate Link'}
							</Button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
