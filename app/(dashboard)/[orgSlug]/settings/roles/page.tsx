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
		const supabase = createClient();
		const { data, error } = await supabase
			.from('roles')
			.insert({
				organization_id: organization.id,
				name: roleName,
				description: customRoleDescription.trim() || null,
				scope: 'ORGANIZATION',
				is_system_role: false,
			})
			.select('id, name, description, is_system_role')
			.single();

		setIsCreatingRole(false);

		if (error) {
			toast.error(
				isMissingRelationError(error)
					? 'Role setup is not available yet'
					: 'Role could not be created',
			);
			return;
		}

		setRoles((current) => [
			...current,
			{
				...(data as Omit<RoleWithPermissions, 'permissionIds'>),
				permissionIds: [],
			},
		]);
		setCustomRoleName('');
		setCustomRoleDescription('');
		toast.success('Role created');
	};

	const toggleRolePermission = async (
		role: RoleWithPermissions,
		permission: Permission,
		checked: boolean,
	) => {
		if (role.is_system_role) {
			toast.error('Protected system roles cannot be edited');
			return;
		}

		const updateKey = `${role.id}:${permission.id}`;
		setUpdatingPermission(updateKey);
		const supabase = createClient();
		const result = checked
			? await supabase
					.from('role_permissions')
					.insert({ role_id: role.id, permission_id: permission.id })
			: await supabase
					.from('role_permissions')
					.delete()
					.eq('role_id', role.id)
					.eq('permission_id', permission.id);

		setUpdatingPermission(null);

		if (result.error) {
			toast.error('Permission could not be updated');
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

	return (
		<Card>
			<CardHeader>
				<CardTitle>Roles & Permissions</CardTitle>
				<CardDescription>
					Create organization roles here, then assign those roles from Team.
					Protected system roles remain read-only.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-6'>
				<form
					onSubmit={handleCreateRole}
					className='grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end'>
					<div className='space-y-2'>
						<Label htmlFor='role-name'>Custom role</Label>
						<Input
							id='role-name'
							value={customRoleName}
							onChange={(event) => setCustomRoleName(event.target.value)}
							placeholder='Compliance lead'
						/>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='role-description'>Description</Label>
						<Textarea
							id='role-description'
							value={customRoleDescription}
							onChange={(event) => setCustomRoleDescription(event.target.value)}
							placeholder='What this role is allowed to do'
							className='min-h-10'
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
					<div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
						Role and permission tables are not fully available yet.
					</div>
				)}

				{isLoadingRoles ? (
					<div className='flex justify-center py-8'>
						<Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
					</div>
				) : (
					<div className='space-y-4'>
						{roles.map((role) => {
							const isExpanded = Boolean(expandedRoleIds[role.id]);

							return (
								<div key={role.id} className='rounded-md border'>
									<button
										type='button'
										className='flex w-full items-center justify-between gap-4 p-4 text-left'
										onClick={() =>
											setExpandedRoleIds((current) => ({
												...current,
												[role.id]: !current[role.id],
											}))
										}>
										<div className='min-w-0'>
											<div className='flex flex-wrap items-center gap-2'>
												{isExpanded ? (
													<ChevronDown className='h-4 w-4 text-muted-foreground' />
												) : (
													<ChevronRight className='h-4 w-4 text-muted-foreground' />
												)}
												<h3 className='font-medium'>{role.name}</h3>
												{role.is_system_role && (
													<Badge variant='secondary'>Protected</Badge>
												)}
											</div>
											<p className='mt-1 line-clamp-1 text-sm text-muted-foreground'>
												{role.description || 'No description yet.'}
											</p>
										</div>
										<div className='flex shrink-0 items-center gap-2 text-xs text-muted-foreground'>
											<span>{role.permissionIds.length} permissions</span>
											<ShieldCheck className='h-5 w-5' />
										</div>
									</button>

									{isExpanded && (
										<div className='grid gap-4 border-t p-4 md:grid-cols-2'>
											{Object.entries(permissionsByCategory).map(
												([category, categoryPermissions]) => (
													<div key={category} className='space-y-3'>
														<p className='text-xs font-semibold uppercase text-muted-foreground'>
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
																	className='flex items-start gap-3 rounded-md border p-3 text-sm'>
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
																		<span className='block font-medium'>
																			{permission.name}
																		</span>
																		<span className='block text-xs text-muted-foreground'>
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
							<div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
								No organization roles found yet.
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
