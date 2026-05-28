'use client';

import { Button } from '@/components/ui/button';
import { PersonDetailsForm } from '@/components/carer-profile-card';
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	createInvitationToken,
	getInvitationLink,
	getInviteExpiry,
	INVITATION_SETUP_MESSAGE,
	isInvitationSetupMissing,
	type InvitationStatus,
	type OrganizationInvitation,
} from '@/lib/invitations';
import { logAction } from '@/lib/audit';
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import {
	Copy,
	Clock,
	Loader2,
	MailPlus,
	Pencil,
	RefreshCw,
	Shield,
	ShieldAlert,
	Trash2,
	UserMinus,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { PersonDetailsInput, TeamMemberDetailsInput } from '@/lib/person-profile';

type Role = {
	id: string;
	name: string;
	description: string | null;
	is_system_role: boolean | null;
};

type Member = {
	id: string;
	user_id: string;
	role_id: string | null;
	status: TeamMemberStatus;
	previous_status: string | null;
	former_at: string | null;
	phone: string | null;
	job_title: string | null;
	department: string | null;
	address_line1: string | null;
	address_line2: string | null;
	city: string | null;
	county: string | null;
	postcode: string | null;
	emergency_contact_name: string | null;
	emergency_contact_relationship: string | null;
	emergency_contact_phone: string | null;
	emergency_contact_email: string | null;
	profile: {
		full_name: string | null;
		email: string | null;
		avatar_url: string | null;
	} | null;
	role: Role | null;
};

type TeamMemberStatus = 'active' | 'on_leave' | 'suspended' | 'former';

type TeamStatusAction =
	| 'mark_on_leave'
	| 'return_from_leave'
	| 'mark_suspended'
	| 'return_from_suspension'
	| 'mark_former'
	| 'restore_former';

type MembershipActionResponse = {
	error?: string;
	membership?: {
		id: string;
		user_id: string;
		role_id: string | null;
		deleted_at?: string | null;
		status?: TeamMemberStatus | null;
		previous_status?: string | null;
		former_at?: string | null;
		phone?: string | null;
		job_title?: string | null;
		department?: string | null;
		address_line1?: string | null;
		address_line2?: string | null;
		city?: string | null;
		county?: string | null;
		postcode?: string | null;
		emergency_contact_name?: string | null;
		emergency_contact_relationship?: string | null;
		emergency_contact_phone?: string | null;
		emergency_contact_email?: string | null;
	};
	role?: Role;
};

type ManageInvitationResponse = {
	error?: string;
	invitation?: OrganizationInvitation;
};

type CurrentOrg = {
	id: string;
	name: string;
	slug: string;
};

function normalizeMember(row: unknown): Member {
	const membership = row as {
		id: string;
		user_id: string;
		role_id?: string | null;
		status?: TeamMemberStatus | null;
		previous_status?: string | null;
		former_at?: string | null;
		phone?: string | null;
		job_title?: string | null;
		department?: string | null;
		address_line1?: string | null;
		address_line2?: string | null;
		city?: string | null;
		county?: string | null;
		postcode?: string | null;
		emergency_contact_name?: string | null;
		emergency_contact_relationship?: string | null;
		emergency_contact_phone?: string | null;
		emergency_contact_email?: string | null;
		profiles?: Member['profile'] | Member['profile'][];
		roles?: Role | Role[] | null;
	};

	return {
		id: membership.id,
		user_id: membership.user_id,
		role_id: membership.role_id ?? null,
		status: membership.status ?? 'active',
		previous_status: membership.previous_status ?? null,
		former_at: membership.former_at ?? null,
		phone: membership.phone ?? null,
		job_title: membership.job_title ?? null,
		department: membership.department ?? null,
		address_line1: membership.address_line1 ?? null,
		address_line2: membership.address_line2 ?? null,
		city: membership.city ?? null,
		county: membership.county ?? null,
		postcode: membership.postcode ?? null,
		emergency_contact_name: membership.emergency_contact_name ?? null,
		emergency_contact_relationship:
			membership.emergency_contact_relationship ?? null,
		emergency_contact_phone: membership.emergency_contact_phone ?? null,
		emergency_contact_email: membership.emergency_contact_email ?? null,
		profile: Array.isArray(membership.profiles)
			? (membership.profiles[0] ?? null)
			: (membership.profiles ?? null),
		role: Array.isArray(membership.roles)
			? (membership.roles[0] ?? null)
			: (membership.roles ?? null),
	};
}

function memberStatusCls(status: TeamMemberStatus) {
	if (status === 'active') return 'bg-ok-50 text-ok';
	if (status === 'on_leave') return 'bg-brand-50 text-brand-700';
	if (status === 'suspended') return 'bg-danger-50 text-danger';
	return 'bg-surface-muted text-slate-600';
}

function inviteStatusCls(status: InvitationStatus) {
	if (status === 'pending') return 'bg-warn-50 text-warn';
	if (status === 'accepted') return 'bg-ok-50 text-ok';
	return 'bg-surface-muted text-slate-600';
}

function formatMemberStatus(status: TeamMemberStatus) {
	return status.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function teamDetailsToForm(member: Member): TeamMemberDetailsInput {
	return {
		phone: member.phone ?? '',
		jobTitle: member.job_title ?? '',
		department: member.department ?? '',
		addressLine1: member.address_line1 ?? '',
		addressLine2: member.address_line2 ?? '',
		city: member.city ?? '',
		county: member.county ?? '',
		postcode: member.postcode ?? '',
		emergencyContactName: member.emergency_contact_name ?? '',
		emergencyContactRelationship:
			member.emergency_contact_relationship ?? '',
		emergencyContactPhone: member.emergency_contact_phone ?? '',
		emergencyContactEmail: member.emergency_contact_email ?? '',
	};
}

async function sendInviteEmail({
	email,
	token,
	roleName,
}: {
	email: string;
	token: string | null;
	roleName?: string | null;
}) {
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
				roleName,
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
}

export default function TeamPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [organization, setOrganization] = useState<CurrentOrg | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [roles, setRoles] = useState<Role[]>([]);
	const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
	const [invitationsReady, setInvitationsReady] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteRoleId, setInviteRoleId] = useState('');
	const [isInviting, setIsInviting] = useState(false);
	const [editingMember, setEditingMember] = useState<Member | null>(null);
	const [memberDetailsForm, setMemberDetailsForm] =
		useState<TeamMemberDetailsInput>({
			phone: '',
			jobTitle: '',
			department: '',
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
	const [isSavingMemberDetails, setIsSavingMemberDetails] = useState(false);

	const selectedInviteRole = useMemo(
		() => roles.find((role) => role.id === inviteRoleId) ?? roles[0] ?? null,
		[inviteRoleId, roles],
	);

	const loadTeam = useCallback(async () => {
		setIsLoading(true);
		const supabase = createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			router.push('/auth/login');
			return;
		}

		setCurrentUserId(user.id);
		const currentOrg = await getCurrentOrgBySlug(supabase, user.id, orgSlug);

		if (!currentOrg) {
			setOrganization(null);
			setMembers([]);
			setRoles([]);
			setInvitations([]);
			setIsLoading(false);
			return;
		}

		setOrganization(currentOrg);

		const [membersResult, rolesResult, invitationsResult] = await Promise.all([
			supabase
				.from('organization_memberships')
				.select(
					'id, user_id, role_id, status, previous_status, former_at, phone, job_title, department, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email, roles(id, name, description, is_system_role)',
				)
				.eq('organization_id', currentOrg.id)
				.is('deleted_at', null),
			supabase
				.from('roles')
				.select('id, name, description, is_system_role')
				.eq('organization_id', currentOrg.id)
				.order('name'),
			supabase
				.from('organization_invitations')
				.select('*')
				.eq('organization_id', currentOrg.id)
				.eq('invite_type', 'team_member')
				.in('status', ['pending', 'revoked', 'expired'])
				.order('created_at', { ascending: false }),
		]);

		if (membersResult.error) {
			toast.error('Team members could not be loaded');
			setMembers([]);
		} else {
			const memberships = membersResult.data ?? [];
			const userIds = memberships.map((member) => member.user_id);
			let profilesById = new Map<string, Member['profile']>();

			if (userIds.length) {
				const { data: profiles, error: profilesError } = await supabase
					.from('profiles')
					.select('id, full_name, email, avatar_url')
					.in('id', userIds)
					.is('deleted_at', null);

				if (profilesError) {
					toast.warning('Member profiles could not be fully loaded');
				} else {
					profilesById = new Map(
						(profiles ?? []).map((profile) => [profile.id, profile]),
					);
				}
			}

			setMembers(
				(memberships ?? []).map((member) => ({
					...normalizeMember(member),
					profile: profilesById.get(member.user_id) ?? null,
				})),
			);
		}

		if (rolesResult.error) {
			setRoles([]);
			if (!isMissingRelationError(rolesResult.error)) {
				toast.error('Roles could not be loaded');
			}
		} else {
			const nextRoles = (rolesResult.data ?? []) as Role[];
			setRoles(nextRoles);
			setInviteRoleId((current) => current || nextRoles[0]?.id || '');
		}

		if (invitationsResult.error) {
			setInvitations([]);
			setInvitationsReady(!isInvitationSetupMissing(invitationsResult.error));
		} else {
			setInvitationsReady(true);
			setInvitations(
				(invitationsResult.data ?? []) as OrganizationInvitation[],
			);
		}

		setIsLoading(false);
	}, [orgSlug, router]);

	useEffect(() => {
		loadTeam();
	}, [loadTeam]);

	const updateMemberRole = async (membershipId: string, roleId: string) => {
		const response = await fetch('/api/team/memberships', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_role',
				membershipId,
				roleId,
			}),
		});
		const payload = (await response.json()) as MembershipActionResponse;

		if (!response.ok) {
			toast.error(payload.error ?? 'Role could not be updated');
			return;
		}

		setMembers((current) =>
			current.map((member) =>
				member.id === membershipId
					? {
							...member,
							role_id: roleId,
							role:
								payload.role ??
								roles.find((role) => role.id === roleId) ??
								member.role,
						}
					: member,
			),
		);
		toast.success('Role updated');
	};

	const removeMember = async (membershipId: string) => {
		const response = await fetch('/api/team/memberships', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'remove',
				membershipId,
			}),
		});
		const payload = (await response.json()) as MembershipActionResponse;

		if (!response.ok) {
			toast.error(payload.error ?? 'Member could not be removed');
			return;
		}

		if (payload.membership) {
			setMembers((current) =>
				current.map((member) =>
					member.id === membershipId
						? {
								...member,
								status: payload.membership?.status ?? 'former',
								previous_status:
									payload.membership?.previous_status ?? null,
								former_at: payload.membership?.former_at ?? null,
							}
						: member,
				),
			);
		}
		toast.success('Member moved to former');
	};

	const updateMemberStatus = async (
		membershipId: string,
		action: TeamStatusAction,
	) => {
		const response = await fetch('/api/team/memberships', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action,
				membershipId,
			}),
		});
		const payload = (await response.json()) as MembershipActionResponse;

		if (!response.ok || !payload.membership) {
			toast.error(payload.error ?? 'Member status could not be updated');
			return;
		}

		setMembers((current) =>
			current.map((member) =>
				member.id === membershipId
					? {
							...member,
							status: payload.membership?.status ?? member.status,
							previous_status:
								payload.membership?.previous_status ?? null,
							former_at: payload.membership?.former_at ?? null,
						}
					: member,
			),
		);
		toast.success('Member status updated');
	};

	const openMemberDetails = (member: Member) => {
		setEditingMember(member);
		setMemberDetailsForm(teamDetailsToForm(member));
	};

	const updateMemberDetailsField = (
		field: keyof TeamMemberDetailsInput,
		value: string,
	) => {
		setMemberDetailsForm((current) => ({ ...current, [field]: value }));
	};

	const saveMemberDetails = async () => {
		if (!editingMember) return;

		setIsSavingMemberDetails(true);
		const response = await fetch('/api/team/memberships', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_details',
				membershipId: editingMember.id,
				details: memberDetailsForm,
			}),
		});
		const payload = (await response.json()) as MembershipActionResponse;
		setIsSavingMemberDetails(false);

		if (!response.ok || !payload.membership) {
			toast.error(payload.error ?? 'Member details could not be updated');
			return;
		}

		setMembers((current) =>
			current.map((member) =>
				member.id === editingMember.id
					? {
							...member,
							phone: payload.membership?.phone ?? null,
							job_title: payload.membership?.job_title ?? null,
							department: payload.membership?.department ?? null,
							address_line1: payload.membership?.address_line1 ?? null,
							address_line2: payload.membership?.address_line2 ?? null,
							city: payload.membership?.city ?? null,
							county: payload.membership?.county ?? null,
							postcode: payload.membership?.postcode ?? null,
							emergency_contact_name:
								payload.membership?.emergency_contact_name ?? null,
							emergency_contact_relationship:
								payload.membership?.emergency_contact_relationship ?? null,
							emergency_contact_phone:
								payload.membership?.emergency_contact_phone ?? null,
							emergency_contact_email:
								payload.membership?.emergency_contact_email ?? null,
						}
					: member,
			),
		);
		setEditingMember(null);
		toast.success('Member details updated');
	};

	const createTeamInvite = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!organization || !currentUserId || !selectedInviteRole) return;

		if (!invitationsReady) {
			toast.error(INVITATION_SETUP_MESSAGE);
			return;
		}

		setIsInviting(true);
		const supabase = createClient();
		const token = createInvitationToken();
		const { data, error } = await supabase
			.from('organization_invitations')
			.insert({
				organization_id: organization.id,
				invite_type: 'team_member',
				email: inviteEmail.trim().toLowerCase(),
				token,
				status: 'pending',
				role_id: selectedInviteRole.id,
				invited_by: currentUserId,
				expires_at: getInviteExpiry(),
			})
			.select('*')
			.single();

		setIsInviting(false);

		if (error) {
			toast.error(
				isInvitationSetupMissing(error)
					? INVITATION_SETUP_MESSAGE
					: 'Team invitation could not be created',
			);
			return;
		}

		setInvitations((current) => [data as OrganizationInvitation, ...current]);
		setInviteEmail('');
		setIsInviteOpen(false);
		await logAction({
			orgId: organization.id,
			action: 'team.invited',
			entityType: 'invitation',
			entityId: data.id,
			entityName: data.email,
			details: {
				email: data.email,
				role_id: selectedInviteRole.id,
				role_name: selectedInviteRole.name,
				invite_type: 'team_member',
				expires_at: data.expires_at,
				outcome: 'team_invitation_created',
			},
		});
		const emailResult = await sendInviteEmail({
			email: data.email,
			token: data.token,
			roleName: selectedInviteRole.name,
		});

		if (emailResult.ok) {
			toast.success('Team invitation sent');
		} else {
			toast.warning(
				`Team invitation created, but email was not sent. ${emailResult.message}`,
			);
		}
	};

	const resendInvite = async (invitationId: string) => {
		const existingInvitation = invitations.find(
			(invite) => invite.id === invitationId,
		);
		const response = await fetch('/api/invitations/manage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				invitationId,
				action: 'reinvite',
			}),
		});
		const payload = (await response.json()) as ManageInvitationResponse;

		if (!response.ok || !payload.invitation) {
			toast.error('Invitation could not be resent');
			return;
		}

		setInvitations((current) =>
			current.map((invite) =>
				invite.id === invitationId
					? (payload.invitation as OrganizationInvitation)
					: invite,
			),
		);
		const emailResult = await sendInviteEmail({
			email: payload.invitation.email,
			token: payload.invitation.token,
			roleName:
				roles.find((role) => role.id === payload.invitation?.role_id)?.name ??
				roles.find((role) => role.id === existingInvitation?.role_id)?.name,
		});

		if (emailResult.ok) {
			toast.success('Invitation resent');
		} else {
			toast.warning(
				`Invitation token regenerated, but email was not sent. ${emailResult.message}`,
			);
		}
	};

	const revokeInvite = async (invitationId: string) => {
		const response = await fetch('/api/invitations/manage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				invitationId,
				action: 'revoke',
			}),
		});
		const payload = (await response.json()) as ManageInvitationResponse;

		if (!response.ok || !payload.invitation) {
			toast.error(payload.error ?? 'Invitation could not be revoked');
			return;
		}

		setInvitations((current) =>
			current.map((invite) =>
				invite.id === invitationId
					? (payload.invitation as OrganizationInvitation)
					: invite,
			),
		);
		toast.success('Invitation revoked');
	};

	const copyInviteLink = async (token: string | null) => {
		if (!token) {
			toast.error('This invitation does not have a token');
			return;
		}

		await navigator.clipboard.writeText(
			getInvitationLink(token, window.location.origin),
		);
		toast.success('Invitation link copied');
	};

	if (isLoading) {
		return (
			<div className='flex min-h-[420px] items-center justify-center p-8'>
				<Loader2 className='h-8 w-8 animate-spin text-slate-400' />
			</div>
		);
	}

	if (!organization) {
		return (
			<div className='p-8'>
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='py-12 text-center text-[13.5px] text-slate-500'>
						This organization could not be loaded.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-6xl items-center justify-between gap-4'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Team</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Manage people, role assignment, and team invitations for{' '}
							{organization.name}.
						</p>
					</div>
					<Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
						<DialogTrigger asChild>
							<Button disabled={!roles.length}>
								<MailPlus className='h-3.5 w-3.5' />
								Invite member
							</Button>
						</DialogTrigger>
						<DialogContent className='sm:max-w-md'>
							<DialogHeader>
								<div className='mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50'>
									<MailPlus className='h-4 w-4 text-brand-700' />
								</div>
								<DialogTitle className='text-[16px]'>Invite team member</DialogTitle>
								<DialogDescription className='text-[13px]'>
									They&apos;ll receive an email with a link to join your organisation.
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={createTeamInvite} className='space-y-4 pt-1'>
								<div className='space-y-1.5'>
									<Label htmlFor='invite-email' className='text-[13px] font-medium text-ink'>Work email</Label>
									<Input
										id='invite-email'
										type='email'
										required
										value={inviteEmail}
										onChange={(event) => setInviteEmail(event.target.value)}
										placeholder='colleague@example.com'
										className='text-[13.5px]'
									/>
								</div>
								<div className='space-y-1.5'>
									<Label className='text-[13px] font-medium text-ink'>Role</Label>
									<Select value={inviteRoleId} onValueChange={setInviteRoleId}>
										<SelectTrigger className='w-full text-[13.5px]'>
											<SelectValue placeholder='Choose role' />
										</SelectTrigger>
										<SelectContent>
											{roles.map((role) => (
												<SelectItem key={role.id} value={role.id}>
													{role.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{selectedInviteRole?.description && (
										<p className='text-[12px] text-slate-500'>{selectedInviteRole.description}</p>
									)}
								</div>
								{!invitationsReady && (
									<div className='rounded-xl border border-dashed border-line bg-surface-muted/50 p-3 text-[12.5px] text-slate-500'>
										{INVITATION_SETUP_MESSAGE}
									</div>
								)}
								<DialogFooter className='pt-1'>
									<Button
										type='button'
										variant='outline'
										onClick={() => setIsInviteOpen(false)}>
										Cancel
									</Button>
									<Button
										type='submit'
										disabled={isInviting || !invitationsReady}>
										{isInviting ? (
											<Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
										) : (
											<MailPlus className='h-3.5 w-3.5' />
										)}
										{isInviting ? 'Sending...' : 'Send invite'}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<div className='mx-auto max-w-6xl space-y-6 px-6 py-6 lg:px-8'>
				{/* Members panel */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='flex items-center gap-4 border-b border-line bg-surface-page px-5 py-2.5'>
						<span className='flex-1 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							Members
							<span className='ml-1.5 font-normal normal-case'>({members.length})</span>
						</span>
						<span className='hidden text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400 sm:block'>
							Status
						</span>
						<span className='hidden text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400 lg:block'>
							Role
						</span>
						<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							Actions
						</span>
					</div>

					<div className='divide-y divide-line'>
						{members.map((member) => {
							const label =
								member.profile?.full_name ||
								member.profile?.email ||
								'Team member';
							const initials = label
								.split(' ')
								.map((n) => n[0])
								.join('')
								.slice(0, 2)
								.toUpperCase();
							const isCurrentUser = member.user_id === currentUserId;

							return (
								<div
									key={member.id}
									className='flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-page'>
									{/* Avatar */}
									<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50'>
										<span className='text-[11px] font-bold text-brand-700'>{initials}</span>
									</div>
									{/* Info */}
									<div className='min-w-0 flex-1'>
										<p className='text-[13.5px] font-medium text-ink'>{label}</p>
										<p className='truncate text-[12px] text-slate-400'>
											{member.profile?.email ?? member.user_id}
											{(member.job_title || member.department) && (
												<>
													{' '}
													&middot;{' '}
													{[member.job_title, member.department]
														.filter(Boolean)
														.join(', ')}
												</>
											)}
										</p>
									</div>
									{/* Status badge */}
									<span
										className={`hidden shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex ${memberStatusCls(member.status)}`}>
										{formatMemberStatus(member.status)}
									</span>
									{/* Role select */}
									<div className='hidden lg:block'>
										<Select
											value={member.role_id ?? ''}
											onValueChange={(roleId) =>
												updateMemberRole(member.id, roleId)
											}
											disabled={!roles.length}>
											<SelectTrigger className='h-8 w-[200px] text-[13px]'>
												<SelectValue placeholder='No role assigned' />
											</SelectTrigger>
											<SelectContent>
												{roles.map((role) => (
													<SelectItem key={role.id} value={role.id}>
														{role.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									{/* Actions */}
									<div className='flex flex-wrap items-center gap-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											className='h-7 text-[12.5px]'
											onClick={() => openMemberDetails(member)}>
											<Pencil className='mr-1.5 h-3.5 w-3.5' />
											Details
										</Button>
										{member.status === 'former' ? (
											<Button
												type='button'
												variant='outline'
												size='sm'
												className='h-7 text-[12.5px]'
												onClick={() =>
													updateMemberStatus(member.id, 'restore_former')
												}>
												<RefreshCw className='mr-1.5 h-3.5 w-3.5' />
												Restore
											</Button>
										) : (
											<>
												{member.status === 'on_leave' ? (
													<Button
														type='button'
														variant='outline'
														size='sm'
														className='h-7 text-[12.5px]'
														onClick={() =>
															updateMemberStatus(
																member.id,
																'return_from_leave',
															)
														}>
														<RefreshCw className='mr-1.5 h-3.5 w-3.5' />
														Return
													</Button>
												) : member.status !== 'suspended' ? (
													<Button
														type='button'
														variant='outline'
														size='sm'
														className='h-7 text-[12.5px]'
														onClick={() =>
															updateMemberStatus(member.id, 'mark_on_leave')
														}>
														<Clock className='mr-1.5 h-3.5 w-3.5' />
														Leave
													</Button>
												) : null}
												{member.status === 'suspended' ? (
													<Button
														type='button'
														variant='outline'
														size='sm'
														className='h-7 text-[12.5px]'
														onClick={() =>
															updateMemberStatus(
																member.id,
																'return_from_suspension',
															)
														}>
														<RefreshCw className='mr-1.5 h-3.5 w-3.5' />
														Unsuspend
													</Button>
												) : (
													<Button
														type='button'
														variant='outline'
														size='sm'
														className='h-7 text-[12.5px]'
														disabled={isCurrentUser}
														onClick={() =>
															updateMemberStatus(
																member.id,
																'mark_suspended',
															)
														}>
														<ShieldAlert className='mr-1.5 h-3.5 w-3.5' />
														Suspend
													</Button>
												)}
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															type='button'
															variant='ghost'
															size='sm'
															className='h-7 text-[12.5px]'
															disabled={isCurrentUser}
															aria-label='Move member to former'>
															<UserMinus className='mr-1.5 h-3.5 w-3.5' />
															Former
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Move this team member to former?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This removes dashboard access for {label}, but
																keeps their profile and activity history.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																variant='destructive'
																onClick={() => removeMember(member.id)}>
																Move to former
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</>
										)}
									</div>
								</div>
							);
						})}
						{members.length === 0 && (
							<div className='py-12 text-center'>
								<p className='text-[13.5px] text-slate-500'>No team members found.</p>
							</div>
						)}
					</div>
				</div>

				{/* Edit member details dialog */}
				<Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}>
					<DialogContent className='sm:max-w-2xl'>
						<DialogHeader>
							<div className='mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50'>
								<Pencil className='h-4 w-4 text-brand-700' />
							</div>
							<DialogTitle className='text-[16px]'>
								{editingMember?.profile?.full_name
									? `Edit ${editingMember.profile.full_name}`
									: 'Edit team member details'}
							</DialogTitle>
							<DialogDescription className='text-[13px]'>
								Operational contact, role context, address, and emergency contact.
							</DialogDescription>
						</DialogHeader>
						<div className='space-y-4 pt-1'>
							<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
								<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>
									Role context
								</p>
								<div className='grid gap-3 sm:grid-cols-2'>
									<div className='space-y-1.5'>
										<Label htmlFor='member-job-title' className='text-[12.5px] text-slate-600'>Job title</Label>
										<Input
											id='member-job-title'
											value={memberDetailsForm.jobTitle ?? ''}
											onChange={(event) =>
												updateMemberDetailsField('jobTitle', event.target.value)
											}
											className='text-[13.5px]'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='member-department' className='text-[12.5px] text-slate-600'>Department</Label>
										<Input
											id='member-department'
											value={memberDetailsForm.department ?? ''}
											onChange={(event) =>
												updateMemberDetailsField('department', event.target.value)
											}
											className='text-[13.5px]'
										/>
									</div>
								</div>
							</div>
							<PersonDetailsForm
								form={memberDetailsForm as PersonDetailsInput}
								onChange={(field, value) => updateMemberDetailsField(field, value)}
							/>
						</div>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setEditingMember(null)}>
								Cancel
							</Button>
							<Button
								type='button'
								disabled={isSavingMemberDetails}
								onClick={saveMemberDetails}>
								{isSavingMemberDetails ? (
									<Loader2 className='h-3.5 w-3.5 animate-spin' />
								) : null}
								{isSavingMemberDetails ? 'Saving...' : 'Save details'}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Invitations panel */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='border-b border-line bg-surface-page px-5 py-2.5'>
						<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							Team Invitations
						</span>
					</div>
					<div className='p-5'>
						{!invitationsReady ? (
							<div className='rounded-xl border border-dashed border-line p-5 text-[13px] text-slate-500'>
								{INVITATION_SETUP_MESSAGE}
							</div>
						) : (
							<div className='space-y-3'>
								{invitations.map((invite) => (
									<div
										key={invite.id}
										className='flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between'>
										<div>
											<div className='flex flex-wrap items-center gap-2'>
												<p className='text-[13.5px] font-medium text-ink'>{invite.email}</p>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${inviteStatusCls(invite.status)}`}>
													{invite.status}
												</span>
											</div>
											<p className='mt-1 text-[12px] text-slate-400'>
												Expires{' '}
												{invite.expires_at
													? new Date(invite.expires_at).toLocaleDateString()
													: 'when configured'}
											</p>
										</div>
										<div className='flex items-center gap-2'>
											<Button
												type='button'
												variant='outline'
												size='sm'
												className='h-7 text-[12.5px]'
												disabled={!invite.token}
												onClick={() => copyInviteLink(invite.token)}
												aria-label='Copy invitation link'>
												<Copy className='mr-1.5 h-3.5 w-3.5' />
												Copy
											</Button>
											<Button
												type='button'
												variant='outline'
												size='sm'
												className='h-7 text-[12.5px]'
												onClick={() => resendInvite(invite.id)}
												aria-label={
													invite.status === 'revoked'
														? 'Reinvite team member'
														: 'Resend invitation'
												}>
												<RefreshCw className='mr-1.5 h-3.5 w-3.5' />
												{invite.status === 'revoked' ? 'Reinvite' : 'Resend'}
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														type='button'
														variant='ghost'
														size='sm'
														className='h-7 text-[12.5px]'
														disabled={invite.status === 'revoked'}
														aria-label='Revoke invitation'>
														<Trash2 className='mr-1.5 h-3.5 w-3.5' />
														Revoke
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Revoke this invitation?
														</AlertDialogTitle>
														<AlertDialogDescription>
															The current invitation link for {invite.email} will stop
															working immediately. You can reinvite them later with a
															new link.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															variant='destructive'
															onClick={() => revokeInvite(invite.id)}>
															Revoke invitation
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</div>
								))}
								{invitations.length === 0 && (
									<div className='rounded-xl border border-dashed border-line p-8 text-center'>
										<Shield className='mx-auto mb-3 h-7 w-7 text-slate-300' />
										<p className='text-[13px] text-slate-400'>
											No team invitations yet.
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
