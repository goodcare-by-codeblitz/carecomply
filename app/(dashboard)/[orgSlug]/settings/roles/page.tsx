'use client';

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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import {
	ChevronDown,
	ChevronRight,
	Loader2,
	Plus,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Permission = {
	id: string;
	code: string;
	name: string;
	description: string | null;
	category: string;
};

type RoleWithPermissions = {
	id: string;
	name: string;
	description: string | null;
	is_system_role: boolean | null;
	permissionIds: string[];
};

function normalizeRole(row: unknown): RoleWithPermissions {
	const role = row as {
		id: string;
		name: string;
		description: string | null;
		is_system_role: boolean | null;
		role_permissions?: {
			permission_id?: string | null;
			permissions?: Permission | Permission[] | null;
		}[];
	};

	return {
		id: role.id,
		name: role.name,
		description: role.description,
		is_system_role: role.is_system_role,
		permissionIds: (role.role_permissions ?? [])
			.map((rolePermission) => {
				if (rolePermission.permission_id) return rolePermission.permission_id;
				const permission = Array.isArray(rolePermission.permissions)
					? rolePermission.permissions[0]
					: rolePermission.permissions;
				return permission?.id ?? null;
			})
			.filter((permissionId): permissionId is string => Boolean(permissionId)),
	};
}

async function readJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		throw new Error('Role settings request failed.');
	}

	return (await response.json()) as T;
}

export default function RolesSettingsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const [organization, setOrganization] = useState(storeOrg ?? null);
	const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const [roleSetupReady, setRoleSetupReady] = useState(true);
	const [isLoadingRoles, setIsLoadingRoles] = useState(false);
	const [customRoleName, setCustomRoleName] = useState('');
	const [customRoleDescription, setCustomRoleDescription] = useState('');
	const [isCreatingRole, setIsCreatingRole] = useState(false);
	const [expandedRoleIds, setExpandedRoleIds] = useState<Record<string, boolean>>(
		{},
	);
	const [updatingPermission, setUpdatingPermission] = useState<string | null>(
		null,
	);
	const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
			return;
		}

		const fetchOrganization = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			setOrganization(await getCurrentOrgBySlug(supabase, user.id, orgSlug));
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

	const permissionsByCategory = useMemo(() => {
		return permissions.reduce<Record<string, Permission[]>>(
			(grouped, permission) => {
				grouped[permission.category] = [
					...(grouped[permission.category] ?? []),
					permission,
				];
				return grouped;
			},
			{},
		);
	}, [permissions]);

	const loadRoleSettings = useCallback(async () => {
		if (!organization) return;

		setIsLoadingRoles(true);
		const supabase = createClient();
		const [rolesResult, permissionsResult] = await Promise.all([
			supabase
				.from('roles')
				.select(
					'id, name, description, is_system_role, role_permissions(permission_id, permissions(id, code, name, description, category))',
				)
				.eq('organization_id', organization.id)
				.order('name'),
			supabase
				.from('permissions')
				.select('id, code, name, description, category')
				.order('category')
				.order('name'),
		]);

		setIsLoadingRoles(false);

		if (rolesResult.error) {
			setRoles([]);
			setRoleSetupReady(!isMissingRelationError(rolesResult.error));
			if (!isMissingRelationError(rolesResult.error)) {
				toast.error('Roles could not be loaded');
			}
		} else {
			setRoleSetupReady(true);
			setRoles((rolesResult.data ?? []).map(normalizeRole));
		}

		if (permissionsResult.error) {
			setPermissions([]);
			if (!isMissingRelationError(permissionsResult.error)) {
				toast.error('Permissions could not be loaded');
			}
		} else {
			setPermissions((permissionsResult.data ?? []) as Permission[]);
		}
	}, [organization]);

	useEffect(() => {
		loadRoleSettings();
	}, [loadRoleSettings]);

	const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!organization) return;

		const roleName = customRoleName.trim();
		if (!roleName) {
			toast.error('Role name is required');
			return;
		}

		setIsCreatingRole(true);
		let role: RoleWithPermissions | null = null;

		try {
			const response = await fetch('/api/settings/roles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					name: roleName,
					description: customRoleDescription.trim(),
				}),
			});
			const payload = await readJsonResponse<{
				role?: RoleWithPermissions;
				error?: string;
			}>(response);

			if (!response.ok || !payload.role) {
				throw new Error(payload.error || 'Role could not be created');
			}

			role = payload.role;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Role could not be created');
			setIsCreatingRole(false);
			return;
		}

		setIsCreatingRole(false);
		if (!role) return;

		setRoles((current) => [...current, role]);
		setCustomRoleName('');
		setCustomRoleDescription('');
		toast.success('Role created');
	};

	const toggleRolePermission = async (
		role: RoleWithPermissions,
		permission: Permission,
		checked: boolean,
	) => {
		if (!organization) return;

		if (role.is_system_role) {
			toast.error('Protected system roles cannot be edited');
			return;
		}

		const updateKey = `${role.id}:${permission.id}`;
		setUpdatingPermission(updateKey);
		let failedMessage: string | null = null;

		try {
			const response = await fetch('/api/settings/roles', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					roleId: role.id,
					permissionId: permission.id,
					checked,
				}),
			});
			const payload = await readJsonResponse<{ error?: string }>(response);

			if (!response.ok) {
				throw new Error(payload.error || 'Permission could not be updated');
			}
		} catch (error) {
			failedMessage =
				error instanceof Error ? error.message : 'Permission could not be updated';
		}

		setUpdatingPermission(null);

		if (failedMessage) {
			toast.error(failedMessage);
			return;
		}

		setRoles((current) =>
			current.map((currentRole) => {
				if (currentRole.id !== role.id) return currentRole;
				const nextPermissionIds = checked
					? [...currentRole.permissionIds, permission.id]
					: currentRole.permissionIds.filter(
							(permissionId) => permissionId !== permission.id,
						);
				return { ...currentRole, permissionIds: nextPermissionIds };
			}),
		);
	};

	const deleteRole = async (role: RoleWithPermissions) => {
		if (!organization) return;

		if (role.is_system_role) {
			toast.error('Protected system roles cannot be deleted');
			return;
		}

		setDeletingRoleId(role.id);
		let failedMessage: string | null = null;

		try {
			const response = await fetch('/api/settings/roles', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					roleId: role.id,
				}),
			});
			const payload = await readJsonResponse<{ error?: string }>(response);

			if (!response.ok) {
				throw new Error(payload.error || 'Role could not be deleted');
			}
		} catch (error) {
			failedMessage =
				error instanceof Error ? error.message : 'Role could not be deleted';
		}

		setDeletingRoleId(null);

		if (failedMessage) {
			toast.error(failedMessage);
			return;
		}

		setRoles((current) => current.filter((currentRole) => currentRole.id !== role.id));
		setExpandedRoleIds((current) => {
			const next = { ...current };
			delete next[role.id];
			return next;
		});
		toast.success('Role deleted');
	};

	return (
		<div className='space-y-6'>
			{/* Create role form */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-3.5'>
					<p className='text-[14px] font-semibold text-ink'>Roles &amp; Permissions</p>
					<p className='mt-0.5 text-[12.5px] text-slate-500'>
						Create organization roles here, then assign those roles from Team.
						Protected system roles remain read-only.
					</p>
				</div>
				<div className='p-5'>
					<form
						onSubmit={handleCreateRole}
						className='grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end'>
						<div className='space-y-2'>
							<Label htmlFor='role-name' className='text-[13px] font-medium text-ink'>
								Custom role
							</Label>
							<Input
								id='role-name'
								value={customRoleName}
								onChange={(event) => setCustomRoleName(event.target.value)}
								placeholder='Compliance lead'
								className='text-[13.5px]'
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='role-description' className='text-[13px] font-medium text-ink'>
								Description
							</Label>
							<Textarea
								id='role-description'
								value={customRoleDescription}
								onChange={(event) => setCustomRoleDescription(event.target.value)}
								placeholder='What this role is allowed to do'
								className='text-[13.5px]'
							/>
						</div>
						<Button type='submit' disabled={isCreatingRole || !roleSetupReady}>
							{isCreatingRole ? (
								<Loader2 className='mr-2 h-4 w-4 animate-spin' />
							) : (
								<Plus className='mr-2 h-4 w-4' />
							)}
							Create role
						</Button>
					</form>

					{!roleSetupReady && (
						<div className='mt-4 rounded-xl border border-dashed border-line p-4 text-[13px] text-slate-500'>
							Role and permission tables are not fully available yet.
						</div>
					)}
				</div>
			</div>

			{/* Roles list */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-2.5'>
					<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
						Configured Roles
					</span>
				</div>
				<div className='p-5'>
					{isLoadingRoles ? (
						<div className='flex justify-center py-8'>
							<Loader2 className='h-6 w-6 animate-spin text-slate-400' />
						</div>
					) : (
						<div className='space-y-3'>
							{roles.map((role) => {
								const isExpanded = Boolean(expandedRoleIds[role.id]);

								return (
									<div key={role.id} className='rounded-xl border border-line'>
										<div className='flex items-center justify-between gap-4 p-4'>
											<button
												type='button'
												className='flex min-w-0 flex-1 items-center justify-between gap-4 text-left'
												onClick={() =>
													setExpandedRoleIds((current) => ({
														...current,
														[role.id]: !current[role.id],
													}))
												}>
												<div className='min-w-0'>
													<div className='flex flex-wrap items-center gap-2'>
														{isExpanded ? (
															<ChevronDown className='h-4 w-4 text-slate-400' />
														) : (
															<ChevronRight className='h-4 w-4 text-slate-400' />
														)}
														<p className='text-[13.5px] font-medium text-ink'>{role.name}</p>
														{role.is_system_role && (
															<span className='inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-muted text-slate-600'>
																Protected
															</span>
														)}
													</div>
													<p className='mt-1 line-clamp-1 text-[12.5px] text-slate-400'>
														{role.description || 'No description yet.'}
													</p>
												</div>
												<div className='flex shrink-0 items-center gap-2 text-[12px] text-slate-400'>
													<span>{role.permissionIds.length} permissions</span>
													<ShieldCheck className='h-4 w-4' />
												</div>
											</button>

											{!role.is_system_role && (
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															type='button'
															variant='outline'
															size='sm'
															className='h-7 text-[12.5px]'
															disabled={deletingRoleId === role.id}>
															{deletingRoleId === role.id ? (
																<Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
															) : (
																<Trash2 className='mr-1.5 h-3.5 w-3.5' />
															)}
															Delete
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Delete this role?</AlertDialogTitle>
															<AlertDialogDescription>
																This removes the custom role and its permissions. If any team
																members still use this role, reassign them before deleting it.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																variant='destructive'
																onClick={() => deleteRole(role)}>
																Delete role
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											)}
										</div>

										{isExpanded && (
											<div className='grid gap-4 border-t border-line p-4 md:grid-cols-2'>
												{Object.entries(permissionsByCategory).map(
													([category, categoryPermissions]) => (
														<div key={category} className='space-y-2'>
															<p className='text-[11px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
																{category}
															</p>
															{categoryPermissions.map((permission) => {
																const updateKey = `${role.id}:${permission.id}`;
																const checked = role.permissionIds.includes(
																	permission.id,
																);

																return (
																	<label
																		key={permission.id}
																		className='flex items-start gap-3 rounded-xl border border-line p-3 text-[13px] cursor-pointer hover:bg-surface-page transition-colors'>
																		<Checkbox
																			checked={checked}
																			disabled={
																				Boolean(role.is_system_role) ||
																				updatingPermission === updateKey
																			}
																			onCheckedChange={(value) =>
																				toggleRolePermission(
																					role,
																					permission,
																					value === true,
																				)
																			}
																		/>
																		<span>
																			<span className='block text-[13px] font-medium text-ink'>
																				{permission.name}
																			</span>
																			<span className='block text-[11.5px] text-slate-400'>
																				{permission.code}
																			</span>
																		</span>
																	</label>
																);
															})}
														</div>
													),
												)}
											</div>
										)}
									</div>
								);
							})}

							{roles.length === 0 && (
								<div className='rounded-xl border border-dashed border-line p-8 text-center'>
									<p className='text-[13px] text-slate-400'>No organization roles found yet.</p>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
