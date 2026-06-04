import { createUserAuditLog } from '@/lib/audit-server';
import { requireBillingCanModify } from '@/lib/billing-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const trainingRequirementSchema = z.object({
	orgId: z.string().uuid(),
	name: z.string().trim().min(2),
	description: z.string().trim().optional(),
	isRequired: z.boolean(),
	isActive: z.boolean(),
	validityMonths: z.number().int().positive().max(240).nullable().optional(),
});

const updateTrainingRequirementSchema = trainingRequirementSchema.extend({
	id: z.string().uuid(),
});

const deleteTrainingRequirementSchema = z.object({
	orgId: z.string().uuid(),
	id: z.string().uuid(),
});

async function requireTrainingManage(orgId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			ok: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
	}

	const { data: canManage } = await supabase.rpc('has_org_permission', {
		p_org_id: orgId,
		p_permission_code: PERMISSIONS.TRAINING_MANAGE,
	});

	if (!canManage) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'You do not have permission to manage training.' },
				{ status: 403 },
			),
		};
	}

	return { ok: true as const };
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const orgId = searchParams.get('orgId');

	if (!orgId || !z.string().uuid().safeParse(orgId).success) {
		return NextResponse.json(
			{ error: 'A valid organization id is required.' },
			{ status: 400 },
		);
	}

	const auth = await requireTrainingManage(orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('training_requirements')
		.select('id, name, description, is_required, is_active, validity_months, created_at, updated_at')
		.eq('organization_id', orgId)
		.order('name');

	if (error) {
		return NextResponse.json(
			{ error: 'Training requirements could not be loaded.' },
			{ status: 500 },
		);
	}

	return NextResponse.json({ trainingRequirements: data ?? [] });
}

export async function POST(request: Request) {
	const result = trainingRequirementSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid training requirement details.' },
			{ status: 400 },
		);
	}

	const auth = await requireTrainingManage(result.data.orgId);
	if (!auth.ok) return auth.response;
	const billing = await requireBillingCanModify(result.data.orgId);
	if (!billing.ok) return billing.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('training_requirements')
		.insert({
			organization_id: result.data.orgId,
			name: result.data.name,
			description: result.data.description || null,
			is_required: result.data.isRequired,
			is_active: result.data.isActive,
			validity_months: result.data.validityMonths ?? null,
		})
		.select('id, name, description, is_required, is_active, validity_months, created_at, updated_at')
		.single();

	if (error || !data) {
		return NextResponse.json(
			{ error: 'Training requirement could not be created.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'training_requirement.created',
		entityType: 'training_requirement',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			after: data,
			permission_checked: PERMISSIONS.TRAINING_MANAGE,
			outcome: 'training_requirement_created',
		},
		request,
	});

	return NextResponse.json({ trainingRequirement: data });
}

export async function PATCH(request: Request) {
	const result = updateTrainingRequirementSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid training requirement details.' },
			{ status: 400 },
		);
	}

	const auth = await requireTrainingManage(result.data.orgId);
	if (!auth.ok) return auth.response;
	const billing = await requireBillingCanModify(result.data.orgId);
	if (!billing.ok) return billing.response;

	const admin = createAdminClient();
	const { data: before } = await admin
		.from('training_requirements')
		.select('id, name, description, is_required, is_active, validity_months')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();

	const { data, error } = await admin
		.from('training_requirements')
		.update({
			name: result.data.name,
			description: result.data.description || null,
			is_required: result.data.isRequired,
			is_active: result.data.isActive,
			validity_months: result.data.validityMonths ?? null,
		})
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.select('id, name, description, is_required, is_active, validity_months, created_at, updated_at')
		.single();

	if (error || !data) {
		return NextResponse.json(
			{ error: 'Training requirement could not be updated.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'training_requirement.updated',
		entityType: 'training_requirement',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			before,
			after: data,
			changed_fields: ['name', 'description', 'is_required', 'is_active', 'validity_months'],
			permission_checked: PERMISSIONS.TRAINING_MANAGE,
			outcome: 'training_requirement_updated',
		},
		request,
	});

	return NextResponse.json({ trainingRequirement: data });
}

export async function DELETE(request: Request) {
	const result = deleteTrainingRequirementSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid training requirement id is required.' },
			{ status: 400 },
		);
	}

	const auth = await requireTrainingManage(result.data.orgId);
	if (!auth.ok) return auth.response;
	const billing = await requireBillingCanModify(result.data.orgId);
	if (!billing.ok) return billing.response;

	const admin = createAdminClient();
	const { data: before } = await admin
		.from('training_requirements')
		.select('id, name, description, is_required, is_active, validity_months')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();
	const { count, error: countError } = await admin
		.from('carer_training_records')
		.select('id', { count: 'exact', head: true })
		.eq('training_requirement_id', result.data.id);

	if (countError) {
		return NextResponse.json(
			{ error: 'Training usage could not be checked.' },
			{ status: 500 },
		);
	}

	if ((count ?? 0) > 0) {
		return NextResponse.json(
			{
				error:
					'This requirement already has training records and cannot be deleted. Mark it inactive instead.',
			},
			{ status: 409 },
		);
	}

	const { error } = await admin
		.from('training_requirements')
		.delete()
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId);

	if (error) {
		return NextResponse.json(
			{ error: 'Training requirement could not be deleted.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'training_requirement.deleted',
		entityType: 'training_requirement',
		organizationId: result.data.orgId,
		entityId: result.data.id,
		entityName: before?.name ?? result.data.id,
		details: {
			before,
			permission_checked: PERMISSIONS.TRAINING_MANAGE,
			outcome: 'training_requirement_deleted',
		},
		request,
	});

	return NextResponse.json({ ok: true });
}
