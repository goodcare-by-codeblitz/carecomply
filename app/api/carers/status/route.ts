import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	carerId: z.string().uuid(),
	action: z.enum([
		'mark_on_leave',
		'return_from_leave',
		'mark_suspended',
		'return_from_suspension',
		'mark_former',
		'restore_former',
	]),
});

const EMPLOYMENT_HOLD_STATUSES = new Set(['on_leave', 'suspended', 'former']);

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = requestSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid carer status request is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: carer, error: carerError } = await admin
		.from('carers')
		.select('id, organization_id, full_name, email, status, previous_status, onboarding_progress')
		.eq('id', result.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer not found.' }, { status: 404 });
	}

	const permission =
		result.data.action === 'mark_former' || result.data.action === 'restore_former'
			? PERMISSIONS.CARERS_DELETE
			: PERMISSIONS.CARERS_EDIT;
	const { data: hasPermission } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: permission,
	});

	if (!hasPermission) {
		return NextResponse.json(
			{ error: 'You do not have permission to update this carer.' },
			{ status: 403 },
		);
	}

	if (carer.status === 'former' && result.data.action !== 'restore_former') {
		return NextResponse.json(
			{ error: 'Former employees must be restored before other status changes.' },
			{ status: 400 },
		);
	}

	const now = new Date().toISOString();

	if (result.data.action === 'mark_on_leave' || result.data.action === 'mark_suspended') {
		const nextStatus =
			result.data.action === 'mark_on_leave' ? 'on_leave' : 'suspended';
		const action =
			result.data.action === 'mark_on_leave'
				? 'carer.marked_on_leave'
				: 'carer.suspended';
		const outcome =
			result.data.action === 'mark_on_leave'
				? 'carer_marked_on_leave'
				: 'carer_suspended';
		const { data, error } = await admin
			.from('carers')
			.update({
				status: nextStatus,
				previous_status: EMPLOYMENT_HOLD_STATUSES.has(carer.status ?? '')
					? (carer.previous_status ?? 'active')
					: carer.status,
				status_changed_at: now,
				status_changed_by: user.id,
				updated_at: now,
			})
			.eq('id', carer.id)
			.select('*')
			.single();

		if (error) {
			return NextResponse.json(
				{
					error:
						result.data.action === 'mark_on_leave'
							? 'Carer could not be marked on leave.'
							: 'Carer could not be suspended.',
				},
				{ status: 500 },
			);
		}

		await createUserAuditLog({
			action,
			entityType: 'carer',
			organizationId: carer.organization_id,
			entityId: carer.id,
			entityName: carer.full_name,
			details: {
				before: { status: carer.status, previous_status: carer.previous_status },
				after: { status: nextStatus, previous_status: data.previous_status },
				changed_fields: ['status', 'previous_status'],
				carer_email: carer.email,
				permission_checked: PERMISSIONS.CARERS_EDIT,
				outcome,
			},
			request,
		});

		return NextResponse.json({ ok: true, carer: data });
	}

	if (result.data.action === 'mark_former') {
		const [{ count: pendingDocuments }, { count: approvedDocuments }, { count: rejectedDocuments }] =
			await Promise.all([
				admin
					.from('documents')
					.select('id', { count: 'exact', head: true })
					.eq('carer_id', carer.id)
					.eq('status', 'pending'),
				admin
					.from('documents')
					.select('id', { count: 'exact', head: true })
					.eq('carer_id', carer.id)
					.eq('status', 'approved'),
				admin
					.from('documents')
					.select('id', { count: 'exact', head: true })
					.eq('carer_id', carer.id)
					.eq('status', 'rejected'),
			]);
		const { data, error } = await admin
			.from('carers')
			.update({
				status: 'former',
				previous_status: EMPLOYMENT_HOLD_STATUSES.has(carer.status ?? '')
					? (carer.previous_status ?? 'active')
					: carer.status,
				status_changed_at: now,
				status_changed_by: user.id,
				former_at: now,
				updated_at: now,
			})
			.eq('id', carer.id)
			.select('*')
			.single();

		if (error) {
			return NextResponse.json(
				{ error: 'Carer could not be moved to former employees.' },
				{ status: 500 },
			);
		}

		await admin
			.from('organization_invitations')
			.update({
				status: 'revoked',
				revoked_at: now,
				revoked_by: user.id,
				updated_at: now,
			})
			.eq('carer_id', carer.id)
			.eq('invite_type', 'carer')
			.eq('status', 'pending');

		await createUserAuditLog({
			action: 'carer.marked_former',
			entityType: 'carer',
			organizationId: carer.organization_id,
			entityId: carer.id,
			entityName: carer.full_name,
			details: {
				before: {
					status: carer.status,
					previous_status: carer.previous_status,
					onboarding_progress: carer.onboarding_progress,
				},
				after: {
					status: 'former',
					previous_status: data.previous_status,
					former_at: now,
				},
				changed_fields: ['status', 'previous_status', 'former_at'],
				carer_email: carer.email,
				document_counts: {
					pending: pendingDocuments ?? 0,
					approved: approvedDocuments ?? 0,
					rejected: rejectedDocuments ?? 0,
				},
				pending_onboarding_invites_revoked: true,
				permission_checked: PERMISSIONS.CARERS_DELETE,
				outcome: 'moved_to_former_employees',
			},
			request,
		});

		return NextResponse.json({ ok: true, carer: data });
	}

	if (
		result.data.action === 'return_from_leave' ||
		result.data.action === 'return_from_suspension' ||
		result.data.action === 'restore_former'
	) {
		const expectedStatus =
			result.data.action === 'return_from_leave'
				? 'on_leave'
				: result.data.action === 'return_from_suspension'
					? 'suspended'
					: 'former';

		if (carer.status !== expectedStatus) {
			return NextResponse.json(
				{ error: `Carer is not currently ${expectedStatus.replace('_', ' ')}.` },
				{ status: 400 },
			);
		}
	}

	const previousStatus = carer.status;
	const status = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
		{ preserveEmploymentStatus: false },
	);

	const restoreUpdate: Record<string, string | null> = {
		previous_status: null,
		status_changed_at: now,
		status_changed_by: user.id,
		updated_at: now,
	};

	if (result.data.action === 'restore_former') {
		restoreUpdate.former_at = null;
	}

	const { data: updatedCarer, error: restoreError } = await admin
		.from('carers')
		.update(restoreUpdate)
		.eq('id', carer.id)
		.select('*')
		.single();

	if (restoreError) {
		return NextResponse.json(
			{ error: 'Carer status could not be restored.' },
			{ status: 500 },
		);
	}

	const auditAction =
		result.data.action === 'restore_former'
			? 'carer.restored'
			: result.data.action === 'return_from_suspension'
				? 'carer.restored'
				: 'carer.returned_from_leave';
	const outcome =
		result.data.action === 'restore_former'
			? 'former_carer_restored'
			: result.data.action === 'return_from_suspension'
				? 'carer_returned_from_suspension'
				: 'returned_from_leave_and_recalculated_compliance';

	await createUserAuditLog({
		action: auditAction,
		entityType: 'carer',
		organizationId: carer.organization_id,
		entityId: carer.id,
		entityName: carer.full_name,
		details: {
			before: { status: previousStatus, previous_status: carer.previous_status },
			after: {
				...status,
				previous_status: null,
				former_at: updatedCarer.former_at ?? null,
			},
			changed_fields: ['status', 'previous_status', 'onboarding_progress'],
			carer_email: carer.email,
			permission_checked: permission,
			outcome,
		},
		request,
	});

	return NextResponse.json({ ok: true, carer: { ...updatedCarer, ...status } });
}
