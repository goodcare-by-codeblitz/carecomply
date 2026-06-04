import { createUserAuditLog } from '@/lib/audit-server';
import { requireBillingCanModify } from '@/lib/billing-guard';
import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const upsertTrainingRecordSchema = z.object({
	carerId: z.string().uuid(),
	trainingRequirementId: z.string().uuid(),
	status: z.enum(['pending', 'completed', 'expired']).default('completed'),
	observedAt: z
		.string()
		.refine((value) => !Number.isNaN(Date.parse(value)), {
			message: 'Observed date is invalid.',
		})
		.nullable()
		.optional(),
	expiryDate: z
		.string()
		.refine((value) => !Number.isNaN(Date.parse(value)), {
			message: 'Expiry date is invalid.',
		})
		.nullable()
		.optional(),
	observedNotes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = upsertTrainingRecordSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid training completion details.' },
			{ status: 400 },
		);
	}

	if (result.data.status === 'completed' && !result.data.observedAt) {
		return NextResponse.json(
			{ error: 'Observed date is required for completed training.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: carer, error: carerError } = await admin
		.from('carers')
		.select('id, organization_id, full_name, email')
		.eq('id', result.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer was not found.' }, { status: 404 });
	}

	const { data: canRecord } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.TRAINING_RECORD,
	});

	if (!canRecord) {
		return NextResponse.json(
			{ error: 'You do not have permission to record training.' },
			{ status: 403 },
		);
	}

	const billing = await requireBillingCanModify(carer.organization_id);
	if (!billing.ok) return billing.response;

	const { data: requirement, error: requirementError } = await admin
		.from('training_requirements')
		.select('id, name, organization_id, validity_months')
		.eq('id', result.data.trainingRequirementId)
		.eq('organization_id', carer.organization_id)
		.maybeSingle();

	if (requirementError || !requirement) {
		return NextResponse.json(
			{ error: 'Training requirement was not found.' },
			{ status: 400 },
		);
	}

	const { data: before } = await admin
		.from('carer_training_records')
		.select('*')
		.eq('carer_id', carer.id)
		.eq('training_requirement_id', requirement.id)
		.maybeSingle();

	const { data: record, error: upsertError } = await admin
		.from('carer_training_records')
		.upsert(
			{
				carer_id: carer.id,
				training_requirement_id: requirement.id,
				status: result.data.status,
				observed_at: result.data.observedAt ?? null,
				observed_by: user.id,
				observed_notes: result.data.observedNotes || null,
				expiry_date: result.data.expiryDate ?? null,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'carer_id,training_requirement_id' },
		)
		.select('id, carer_id, training_requirement_id, status, observed_at, observed_by, observed_notes, expiry_date, updated_at')
		.single();

	if (upsertError || !record) {
		return NextResponse.json(
			{ error: 'Training record could not be saved.' },
			{ status: 500 },
		);
	}

	const { progress, status } = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
	);

	await createUserAuditLog({
		action: before ? 'training.updated' : 'training.completed',
		entityType: 'training_record',
		organizationId: carer.organization_id,
		entityId: record.id,
		entityName: `${requirement.name} - ${carer.full_name}`,
		details: {
			carer_id: carer.id,
			carer_name: carer.full_name,
			carer_email: carer.email,
			training_requirement_id: requirement.id,
			training_requirement_name: requirement.name,
			before,
			after: record,
			changed_fields: ['status', 'observed_at', 'observed_by', 'observed_notes', 'expiry_date'],
			permission_checked: PERMISSIONS.TRAINING_RECORD,
			onboarding_progress: progress,
			onboarding_status: status,
			outcome: before ? 'training_record_updated' : 'training_record_completed',
		},
		request,
	});

	return NextResponse.json({ trainingRecord: record, progress, status });
}
