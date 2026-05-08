import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	carerId: z.string().uuid(),
	action: z.enum(['mark_on_leave', 'return_from_leave', 'mark_former']),
});

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
		.select('id, organization_id, full_name, email, status, onboarding_progress')
		.eq('id', result.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer not found.' }, { status: 404 });
	}

	const permission =
		result.data.action === 'mark_former'
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

	if (carer.status === 'former') {
		return NextResponse.json(
			{ error: 'Former employees cannot be changed from this action.' },
			{ status: 400 },
		);
	}

	const now = new Date().toISOString();

	if (result.data.action === 'mark_on_leave') {
		const { data, error } = await admin
			.from('carers')
			.update({
				status: 'on_leave',
				status_changed_at: now,
				status_changed_by: user.id,
				updated_at: now,
			})
			.eq('id', carer.id)
			.select('*')
			.single();

		if (error) {
			return NextResponse.json(
				{ error: 'Carer could not be marked on leave.' },
				{ status: 500 },
			);
		}

		await createUserAuditLog({
			action: 'carer.marked_on_leave',
			entityType: 'carer',
			organizationId: carer.organization_id,
			entityId: carer.id,
			entityName: carer.full_name,
			details: {
				before: { status: carer.status },
				after: { status: 'on_leave' },
				changed_fields: ['status'],
				carer_email: carer.email,
				permission_checked: PERMISSIONS.CARERS_EDIT,
				outcome: 'carer_marked_on_leave',
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
					onboarding_progress: carer.onboarding_progress,
				},
				after: { status: 'former', former_at: now },
				changed_fields: ['status', 'former_at'],
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

	const previousStatus = carer.status;
	const status = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
		{ preserveEmploymentStatus: false },
	);

	await createUserAuditLog({
		action: 'carer.returned_from_leave',
		entityType: 'carer',
		organizationId: carer.organization_id,
		entityId: carer.id,
		entityName: carer.full_name,
		details: {
			before: { status: previousStatus },
			after: status,
			changed_fields: ['status', 'onboarding_progress'],
			carer_email: carer.email,
			permission_checked: PERMISSIONS.CARERS_EDIT,
			outcome: 'returned_from_leave_and_recalculated_compliance',
		},
		request,
	});

	return NextResponse.json({ ok: true, carer: { ...carer, ...status } });
}
