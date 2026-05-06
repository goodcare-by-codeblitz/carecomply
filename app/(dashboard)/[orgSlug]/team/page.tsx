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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	createInvitationToken,
	getInvitationLink,
	getInviteExpiry,
	INVITATION_SETUP_MESSAGE,
	isInvitationSetupMissing,
	type InvitationStatus,
	type OrganizationInvitation,
} from '@/lib/invitations';
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
	Copy,
	Loader2,
	MailPlus,
	RefreshCw,
	Shield,
	Trash2,
	UserMinus,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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
	profile: {
		full_name: string | null;
		email: string | null;
		avatar_url: string | null;
	} | null;
	role: Role | null;
};

type MembershipActionResponse = {
	error?: string;
	membership?: {
		id: string;
		user_id: string;
		role_id: string | null;
		deleted_at?: string | null;
	};
	role?: Role;
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
		profiles?: Member['profile'] | Member['profile'][];
		roles?: Role | Role[] | null;
	};

	return {
		id: membership.id,
		user_id: membership.user_id,
		role_id: membership.role_id ?? null,
		profile: Array.isArray(membership.profiles)
			? (membership.profiles[0] ?? null)
			: (membership.profiles ?? null),
		role: Array.isArray(membership.roles)
			? (membership.roles[0] ?? null)
			: (membership.roles ?? null),
	};
}

function statusVariant(status: InvitationStatus) {
	if (status === 'pending') return 'default';
	if (status === 'accepted') return 'secondary';
	return 'outline';
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
					'id, user_id, role_id, roles(id, name, description, is_system_role)',
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

		setMembers((current) =>
			current.filter((member) => member.id !== membershipId),
		);
		toast.success('Member removed');
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
		const token = createInvitationToken();
		const existingInvitation = invitations.find(
			(invite) => invite.id === invitationId,
		);
		const supabase = createClient();
		const { data, error } = await supabase
			.from('organization_invitations')
			.update({
				token,
				status: 'pending',
				expires_at: getInviteExpiry(),
				revoked_at: null,
			})
			.eq('id', invitationId)
			.select('*')
			.single();

		if (error) {
			toast.error('Invitation could not be resent');
			return;
		}

		setInvitations((current) =>
			current.map((invite) =>
				invite.id === invitationId ? (data as OrganizationInvitation) : invite,
			),
		);
		const emailResult = await sendInviteEmail({
			email: data.email,
			token: data.token,
			roleName:
				roles.find((role) => role.id === data.role_id)?.name ??
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
		const supabase = createClient();
		const { data, error } = await supabase
			.from('organization_invitations')
			.update({
				status: 'revoked',
				revoked_at: new Date().toISOString(),
				revoked_by: currentUserId,
			})
			.eq('id', invitationId)
			.select('*')
			.single();

		if (error) {
			toast.error('Invitation could not be revoked');
			return;
		}

		setInvitations((current) =>
			current.map((invite) =>
				invite.id === invitationId ? (data as OrganizationInvitation) : invite,
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
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	if (!organization) {
		return (
			<div className='p-8'>
				<Card>
					<CardContent className='py-12 text-center text-sm text-muted-foreground'>
						This organization could not be loaded.
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='mx-auto max-w-6xl space-y-6 p-8'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Team</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						Manage people, role assignment, and team invitations for{' '}
						{organization.name}.
					</p>
				</div>
				<Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
					<DialogTrigger asChild>
						<Button disabled={!roles.length}>
							<MailPlus className='mr-2 h-4 w-4' />
							Invite member
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Invite team member</DialogTitle>
							<DialogDescription>
								Team invites are stored in organization_invitations once that
								table is available.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={createTeamInvite} className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='invite-email'>Email</Label>
								<Input
									id='invite-email'
									type='email'
									required
									value={inviteEmail}
									onChange={(event) => setInviteEmail(event.target.value)}
									placeholder='colleague@example.com'
								/>
							</div>
							<div className='space-y-2'>
								<Label>Role</Label>
								<Select value={inviteRoleId} onValueChange={setInviteRoleId}>
									<SelectTrigger className='w-full'>
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
							</div>
							{!invitationsReady && (
								<p className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
									{INVITATION_SETUP_MESSAGE}
								</p>
							)}
							<DialogFooter>
								<Button
									type='submit'
									disabled={isInviting || !invitationsReady}>
									{isInviting ? 'Creating...' : 'Create invite'}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Members</CardTitle>
					<CardDescription>
						Assign roles here. Create and configure role definitions in
						Settings.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Person</TableHead>
								<TableHead>Role</TableHead>
								<TableHead className='w-[90px] text-right'>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((member) => {
								const label =
									member.profile?.full_name ||
									member.profile?.email ||
									'Team member';
								const isCurrentUser = member.user_id === currentUserId;

								return (
									<TableRow key={member.id}>
										<TableCell>
											<div className='font-medium'>{label}</div>
											<div className='text-xs text-muted-foreground'>
												{member.profile?.email ?? member.user_id}
											</div>
										</TableCell>
										<TableCell>
											<Select
												value={member.role_id ?? ''}
												onValueChange={(roleId) =>
													updateMemberRole(member.id, roleId)
												}
												disabled={!roles.length}>
												<SelectTrigger className='w-[220px]'>
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
										</TableCell>
										<TableCell className='text-right'>
											<Button
												type='button'
												variant='ghost'
												size='icon'
												disabled={isCurrentUser}
												onClick={() => removeMember(member.id)}
												aria-label='Remove member'>
												<UserMinus className='h-4 w-4' />
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
							{members.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={3}
										className='py-10 text-center text-sm text-muted-foreground'>
										No team members found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Team Invitations</CardTitle>
					<CardDescription>
						Pending, revoked, and expired team invitations.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!invitationsReady ? (
						<div className='rounded-md border border-dashed p-5 text-sm text-muted-foreground'>
							{INVITATION_SETUP_MESSAGE}
						</div>
					) : (
						<div className='space-y-3'>
							{invitations.map((invite) => (
								<div
									key={invite.id}
									className='flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
									<div>
										<div className='flex flex-wrap items-center gap-2'>
											<p className='font-medium'>{invite.email}</p>
											<Badge variant={statusVariant(invite.status)}>
												{invite.status}
											</Badge>
										</div>
										<p className='mt-1 text-xs text-muted-foreground'>
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
											size='icon'
											disabled={!invite.token}
											onClick={() => copyInviteLink(invite.token)}
											aria-label='Copy invitation link'>
											<Copy className='h-4 w-4' />
										</Button>
										<Button
											type='button'
											variant='outline'
											size='icon'
											onClick={() => resendInvite(invite.id)}
											aria-label='Resend invitation'>
											<RefreshCw className='h-4 w-4' />
										</Button>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											className={cn(
												invite.status === 'revoked' && 'opacity-50',
											)}
											disabled={invite.status === 'revoked'}
											onClick={() => revokeInvite(invite.id)}
											aria-label='Revoke invitation'>
											<Trash2 className='h-4 w-4' />
										</Button>
									</div>
								</div>
							))}
							{invitations.length === 0 && (
								<div className='rounded-md border border-dashed p-8 text-center'>
									<Shield className='mx-auto mb-3 h-8 w-8 text-muted-foreground/70' />
									<p className='text-sm text-muted-foreground'>
										No team invitations yet.
									</p>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
