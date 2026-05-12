import {
	getCarerOnboardingContext,
	OnboardingTokenError,
} from '@/lib/onboarding';
import { createSystemAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const referenceSchema = z.object({
	fullName: z.string().trim().min(2),
	organization: z.string().trim().optional(),
	email: z.string().trim().email(),
	phone: z
		.string()
		.trim()
		.min(5)
		.refine((value) => /^[\d\s+()-]+$/.test(value), 'Invalid phone number'),
	relationship: z.string().trim().min(2),
	notes: z.string().trim().optional(),
	referenceType: z.enum(['work', 'character']),
});

const requestSchema = z.object({
	token: z.string().min(1),
	carerPhone: z
		.string()
		.trim()
		.optional()
		.refine((value) => !value || /^[\d\s+()-]+$/.test(value), {
			message: 'Invalid phone number',
		}),
	references: z.array(referenceSchema).min(1).max(10),
});

export async function POST(request: Request) {
	let payload: z.infer<typeof requestSchema>;

	try {
		payload = requestSchema.parse(await request.json());
	} catch {
		return NextResponse.json(
			{ error: 'Please provide valid reference details.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();

	try {
		const context = await getCarerOnboardingContext(admin, payload.token);
		const now = new Date().toISOString();

		// Only delete the reference types being submitted, preserving the other type
		const typesBeingUpdated = [...new Set(payload.references.map((r) => r.referenceType))];
		const { error: deleteError } = await admin
			.from('carer_references')
			.delete()
			.eq('carer_id', context.carer.id)
			.in('reference_type', typesBeingUpdated);

		if (deleteError) {
			throw deleteError;
		}

		const { data, error } = await admin
			.from('carer_references')
			.insert(
				payload.references.map((reference) => ({
					carer_id: context.carer.id,
					full_name: reference.fullName,
					organization: reference.organization || null,
					email: reference.email.toLowerCase(),
					phone: reference.phone,
					relationship: reference.relationship,
					notes: reference.notes || null,
					reference_type: reference.referenceType,
					created_at: now,
					updated_at: now,
				})),
			)
			.select('id, full_name, organization, email, phone, relationship, notes, reference_type');

		if (error) {
			throw error;
		}

		await admin
			.from('carers')
			.update({
				phone: payload.carerPhone || null,
				updated_at: now,
			})
			.eq('id', context.carer.id);

		await createSystemAuditLog({
			action: 'onboarding.references_updated',
			entityType: 'carer',
			organizationId: context.carer.organization_id,
			entityId: context.carer.id,
			entityName: context.carer.full_name,
			source: 'onboarding',
			details: {
				carer_email: context.carer.email,
				before: { phone: context.carer.phone },
				after: {
					phone: payload.carerPhone || null,
					reference_count: data?.length ?? 0,
				},
				changed_fields: ['phone', 'references'],
				reference_types_updated: typesBeingUpdated,
				reference_relationships: payload.references.map((r) => r.relationship),
				outcome: 'carer_onboarding_references_saved',
			},
		});

		return NextResponse.json({
			references: data ?? [],
			carerPhone: payload.carerPhone || null,
		});
	} catch (error) {
		if (error instanceof OnboardingTokenError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error('Failed to save references:', error);
		return NextResponse.json(
			{ error: 'Reference details could not be saved.' },
			{ status: 500 },
		);
	}
}
