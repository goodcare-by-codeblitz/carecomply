'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
	DEFAULT_BILLING_SUMMARY,
	PRICING_PLANS,
	getPricingPlan,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
	type OrganizationBillingSummary,
} from '@/lib/billing';
import {
	getCurrentOrgBySlug,
	getOrgInitials,
	getOrgLogoSrc,
	isMissingColumnOrBucketError,
	isMissingRelationError,
	type UserOrganization,
} from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import {
	Building2,
	ChevronDown,
	ChevronRight,
	CreditCard,
	ImageUp,
	Loader2,
	Plus,
	ShieldCheck,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const LOGO_BUCKET = 'organization-assets';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

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

type BillingRow = {
	plan: BillingPlan;
	interval: BillingInterval;
	status: BillingStatus;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	stripe_price_id: string | null;
	current_period_start: string | null;
	current_period_end: string | null;
	trial_start: string | null;
	trial_end: string | null;
	cancel_at_period_end: boolean | null;
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

export default function SettingsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const updateOrganization = useOrgStore((state) => state.updateOrganization);
	const [organization, setOrganization] = useState<UserOrganization | null>(
		storeOrg ?? null,
	);
	const [name, setName] = useState(storeOrg?.name ?? '');
	const [isLoading, setIsLoading] = useState(!storeOrg);
	const [isSavingName, setIsSavingName] = useState(false);
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);
	const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const [roleSetupReady, setRoleSetupReady] = useState(true);
	const [isLoadingRoles, setIsLoadingRoles] = useState(false);
	const [customRoleName, setCustomRoleName] = useState('');
	const [customRoleDescription, setCustomRoleDescription] = useState('');
	const [isCreatingRole, setIsCreatingRole] = useState(false);
	const [expandedRoleIds, setExpandedRoleIds] = useState<
		Record<string, boolean>
	>({});
	const [updatingPermission, setUpdatingPermission] = useState<string | null>(
		null,
	);
	const [billing, setBilling] = useState<OrganizationBillingSummary>(
		DEFAULT_BILLING_SUMMARY,
	);
	const [isLoadingBilling, setIsLoadingBilling] = useState(false);
	const [isOpeningPortal, setIsOpeningPortal] = useState(false);
	const [selectedBillingPlan, setSelectedBillingPlan] =
		useState<BillingPlan>('carecore');
	const [selectedBillingInterval, setSelectedBillingInterval] =
		useState<BillingInterval>('monthly');
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);

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

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
			setName(storeOrg.name);
			setIsLoading(false);
			return;
		}

		const fetchOrganization = async () => {
			setIsLoading(true);
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			const currentOrg = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
			setOrganization(currentOrg);
			setName(currentOrg?.name ?? '');
			setIsLoading(false);
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

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

	const loadBilling = useCallback(async () => {
		if (!organization) return;

		setIsLoadingBilling(true);
		const supabase = createClient();
		const { data, error } = await supabase
			.from('organization_billing')
			.select(
				'plan, interval, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, trial_start, trial_end, cancel_at_period_end',
			)
			.eq('organization_id', organization.id)
			.maybeSingle();

		setIsLoadingBilling(false);

		if (error) {
			setBilling(DEFAULT_BILLING_SUMMARY);
			if (!isMissingRelationError(error)) {
				toast.error('Billing could not be loaded');
			}
			return;
		}

		if (!data) {
			setBilling(DEFAULT_BILLING_SUMMARY);
			return;
		}

		const row = data as BillingRow;
		setBilling({
			...row,
			cancel_at_period_end: Boolean(row.cancel_at_period_end),
			isConfigured: Boolean(
				row.stripe_customer_id ||
				row.stripe_subscription_id ||
				row.stripe_price_id,
			),
		});
		setSelectedBillingPlan(row.plan);
		setSelectedBillingInterval(row.interval);
	}, [organization]);

	useEffect(() => {
		loadBilling();
	}, [loadBilling]);

	const handleOpenBillingPortal = async () => {
		if (!organization) return;

		setIsOpeningPortal(true);
		try {
			const response = await fetch('/api/billing/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					orgSlug: organization.slug,
				}),
			});
			const payload = (await response.json()) as {
				message?: string;
				url?: string;
			};

			if (!response.ok) {
				toast.info(payload.message ?? 'Billing portal could not be opened.');
				return;
			}

			if (payload.url) {
				window.location.href = payload.url;
				return;
			}

			toast.error('Billing portal did not return a redirect URL');
		} catch {
			toast.error('Billing portal could not be opened');
		} finally {
			setIsOpeningPortal(false);
		}
	};

	const handleChangeBillingPlan = async () => {
		if (!organization) return;

		setIsStartingCheckout(true);
		try {
			const hasActiveSubscription = Boolean(
				billing.stripe_subscription_id && billing.status !== 'canceled',
			);
			const response = await fetch(
				hasActiveSubscription
					? '/api/billing/subscription'
					: '/api/billing/checkout',
				{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					planId: selectedBillingPlan,
					interval: selectedBillingInterval,
					orgId: organization.id,
					orgSlug: organization.slug,
				}),
				},
			);
			const payload = (await response.json()) as {
				message?: string;
				url?: string;
				useCheckout?: boolean;
				useSubscriptionChange?: boolean;
			};

			if (!response.ok) {
				toast.info(payload.message ?? 'Checkout could not be started.');
				return;
			}

			if (payload.url) {
				window.location.href = payload.url;
				return;
			}

			toast.success(
				payload.message ??
					(hasActiveSubscription
						? 'Subscription change submitted'
						: 'Checkout started'),
			);
			await loadBilling();
		} catch {
			toast.error('Billing change could not be started');
		} finally {
			setIsStartingCheckout(false);
		}
	};

	const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!organization) return;

		const nextName = name.trim();
		if (!nextName) {
			toast.error('Organization name is required');
			return;
		}

		setIsSavingName(true);
		const supabase = createClient();

		const { data, error } = await supabase
			.from('organizations')
			.update({ name: nextName })
			.eq('id', organization.id)
			.select('*')
			.single();

		setIsSavingName(false);

		if (error) {
			toast.error('Failed to update organization profile');
			return;
		}

		const updatedOrg = {
			...organization,
			name: data.name,
			logo_url: data.logo_url ?? organization.logo_url ?? null,
			logo_path: data.logo_path ?? organization.logo_path ?? null,
		};

		setOrganization(updatedOrg);
		updateOrganization(organization.id, updatedOrg);
		toast.success('Organization profile updated');
		router.refresh();
	};

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

	const handleLogoChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = '';

		if (!file || !organization) return;

		if (!file.type.startsWith('image/')) {
			toast.error('Choose an image file');
			return;
		}

		if (file.size > MAX_LOGO_SIZE) {
			toast.error('Logo must be 2MB or smaller');
			return;
		}

		setIsUploadingLogo(true);
		const supabase = createClient();
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
		const logoPath = `${organization.id}/logo/${Date.now()}-${safeName}`;

		const { error: uploadError } = await supabase.storage
			.from(LOGO_BUCKET)
			.upload(logoPath, file, { upsert: true });

		if (uploadError) {
			setIsUploadingLogo(false);
			toast.error(
				isMissingColumnOrBucketError(uploadError)
					? 'Organization logo storage is not set up yet'
					: 'Failed to upload logo',
			);
			return;
		}

		const {
			data: { publicUrl },
		} = supabase.storage.from(LOGO_BUCKET).getPublicUrl(logoPath);

		const { data, error: updateError } = await supabase
			.from('organizations')
			.update({ logo_path: logoPath, logo_url: publicUrl })
			.eq('id', organization.id)
			.select('*')
			.single();

		setIsUploadingLogo(false);

		if (updateError) {
			toast.error(
				isMissingColumnOrBucketError(updateError)
					? 'Logo columns are not set up on organizations yet'
					: 'Failed to save logo',
			);
			return;
		}

		const updatedOrg = {
			...organization,
			logo_url: data.logo_url ?? publicUrl,
			logo_path: data.logo_path ?? logoPath,
		};

		setOrganization(updatedOrg);
		updateOrganization(organization.id, updatedOrg);
		toast.success('Organization logo updated');
		router.refresh();
	};

	const logoSrc = getOrgLogoSrc(organization);
	const billingPlan = getPricingPlan(billing.plan);
	const selectedPlan = getPricingPlan(selectedBillingPlan);
	const periodEnd = billing.current_period_end ?? billing.trial_end;
	const formatBillingDate = (value: string | null | undefined) =>
		value
			? new Intl.DateTimeFormat('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
			}).format(new Date(value))
			: null;
	const formattedPeriodEnd = formatBillingDate(periodEnd);
	const formattedTrialStart = formatBillingDate(billing.trial_start);
	const formattedTrialEnd = formatBillingDate(billing.trial_end);

	if (isLoading) {
		return (
			<div className='p-8 flex min-h-[400px] items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	if (!organization) {
		return (
			<div className='p-8 max-w-3xl mx-auto'>
				<Card>
					<CardContent className='py-12 text-center'>
						<Building2 className='mx-auto mb-3 h-10 w-10 text-muted-foreground/60' />
						<p className='text-sm text-muted-foreground'>
							Organization profile could not be loaded.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='p-8 max-w-5xl mx-auto'>
			<div className='mb-8'>
				<h1 className='text-2xl font-semibold tracking-tight'>Settings</h1>
				<p className='text-muted-foreground mt-1'>
					Customize how your organization appears across the app.
				</p>
			</div>

			<div className='space-y-6'>
				<Card>
					<CardHeader>
						<CardTitle>Logo</CardTitle>
						<CardDescription>
							Upload a square logo once your organization assets bucket and logo
							columns are available.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-5'>
						<div className='flex items-center gap-4'>
							<div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border bg-muted'>
								{logoSrc ? (
									<img
										src={logoSrc}
										alt={`${organization.name} logo`}
										className='h-full w-full object-cover'
									/>
								) : (
									<span className='text-lg font-semibold'>
										{getOrgInitials(organization.name)}
									</span>
								)}
							</div>
							<div>
								<p className='text-sm font-medium'>{organization.name}</p>
								<p className='text-xs text-muted-foreground'>
									Used in the app navigation.
								</p>
							</div>
						</div>

						<div className='space-y-2'>
							<Label htmlFor='org-logo'>Upload logo</Label>
							<div className='flex items-center gap-3'>
								<Input
									id='org-logo'
									type='file'
									accept='image/*'
									onChange={handleLogoChange}
									disabled={isUploadingLogo}
								/>
								<Button
									type='button'
									variant='outline'
									disabled={isUploadingLogo}
									onClick={() => document.getElementById('org-logo')?.click()}>
									{isUploadingLogo ? (
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
									) : (
										<ImageUp className='mr-2 h-4 w-4' />
									)}
									Upload
								</Button>
							</div>
							<p className='text-xs text-muted-foreground'>
								Setup expected later: `organizations.logo_path`,
								`organizations.logo_url`, and the `organization-assets` storage
								bucket.
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Organization Profile</CardTitle>
						<CardDescription>
							This branding appears in the navigation and workspace pages.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSaveName} className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='org-name'>Organization name</Label>
								<Input
									id='org-name'
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder='Your organization name'
								/>
							</div>
							<div className='space-y-2'>
								<Label>Organization slug</Label>
								<Input
									value={organization.slug}
									readOnly
									className='bg-muted/50'
								/>
							</div>
							<Button type='submit' disabled={isSavingName}>
								{isSavingName ? 'Saving...' : 'Save profile'}
							</Button>
						</form>
					</CardContent>
				</Card>

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
									onChange={(event) =>
										setCustomRoleDescription(event.target.value)
									}
									placeholder='What this role is allowed to do'
									className='min-h-10'
								/>
							</div>
							<Button
								type='submit'
								disabled={isCreatingRole || !roleSetupReady}>
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
								Role and permission tables are not fully available yet. Add the
								roles, role_permissions, permissions, and policies to enable
								editing.
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

				<Card>
					<CardHeader>
						<CardTitle>Billing</CardTitle>
						<CardDescription>
							Manage your organization subscription and Stripe billing details.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-8'>
						<div className='flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
							<div className='flex items-center gap-3'>
								<div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted'>
									<CreditCard className='h-5 w-5 text-muted-foreground' />
								</div>
								<div>
									<p className='font-medium'>
										{isLoadingBilling
											? 'Loading billing...'
											: `${billingPlan?.name ?? billing.plan} plan`}
									</p>
									<p className='text-sm text-muted-foreground'>
										Status: {billing.status.replace('_', ' ')}
										{billing.interval ? ` - ${billing.interval}` : ''}
									</p>
									{formattedPeriodEnd && (
										<p className='text-xs text-muted-foreground'>
											{billing.cancel_at_period_end ? 'Ends' : 'Renews'} on{' '}
											{formattedPeriodEnd}
										</p>
									)}
									{formattedTrialStart && formattedTrialEnd && (
										<p className='text-xs text-muted-foreground'>
											Trial: {formattedTrialStart} to {formattedTrialEnd}
										</p>
									)}
								</div>
							</div>
							<div className='flex flex-wrap gap-2'>
								<Button
									type='button'
									variant='outline'
									onClick={() =>
										document
											.getElementById('settings-pricing-plans')
											?.scrollIntoView({ behavior: 'smooth' })
									}>
									View plans
								</Button>
								<Button
									type='button'
									disabled={!billing.stripe_customer_id || isOpeningPortal}
									onClick={handleOpenBillingPortal}>
									{isOpeningPortal && (
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
									)}
									Manage billing
								</Button>
							</div>
						</div>
						{billing.stripe_subscription_id && (
							<p className='text-xs text-muted-foreground'>
								Stripe subscription: {billing.stripe_subscription_id}
							</p>
						)}
						<div className='rounded-md border p-4'>
							<div className='mb-4'>
								<h3 className='text-sm font-medium'>Change plan</h3>
								<p className='text-sm text-muted-foreground'>
									Choose a package and interval. Existing subscriptions are
									updated with Stripe proration instead of creating another
									subscription.
								</p>
							</div>
							<div className='grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end'>
								<div className='space-y-2'>
									<Label>Plan</Label>
									<Select
										value={selectedBillingPlan}
										onValueChange={(value) =>
											setSelectedBillingPlan(value as BillingPlan)
										}>
										<SelectTrigger className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PRICING_PLANS.filter((plan) => !plan.isEnterprise).map(
												(plan) => (
													<SelectItem key={plan.id} value={plan.id}>
														{plan.name}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-2'>
									<Label>Interval</Label>
									<Select
										value={selectedBillingInterval}
										onValueChange={(value) =>
											setSelectedBillingInterval(value as BillingInterval)
										}>
										<SelectTrigger className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='monthly'>Monthly</SelectItem>
											<SelectItem value='yearly'>Yearly</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<Button
									type='button'
									disabled={
										isStartingCheckout ||
										(Boolean(
											billing.stripe_subscription_id &&
												billing.status !== 'canceled',
										) &&
											selectedBillingPlan === billing.plan &&
											selectedBillingInterval === billing.interval)
									}
									onClick={handleChangeBillingPlan}>
									{isStartingCheckout && (
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
									)}
									{billing.stripe_subscription_id &&
									billing.status !== 'canceled'
										? 'Update subscription'
										: 'Start checkout'}
								</Button>
							</div>
							{selectedPlan && (
								<p className='mt-3 text-xs text-muted-foreground'>
									{selectedPlan.description}
								</p>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
