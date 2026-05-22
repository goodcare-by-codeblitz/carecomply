import { createSystemAuditLog } from '@/lib/audit-server';
import {
	getCarerOnboardingContext,
	OnboardingTokenError,
} from '@/lib/onboarding';
import {
	personDetailsBaseSchema,
	personDetailsToRow,
} from '@/lib/person-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = personDetailsBaseSchema.extend({
	token: z.string().min(1),
}).refine(
	(data) =>
		!data.emergencyContactName ||
		Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
	{
		message: 'Emergency contact phone or email is required.',
		path: ['emergencyContactPhone'],
	},
);

export async function POST(request: Request) {
	const result = requestSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: result.error.issues[0]?.message ?? 'Please provide valid details.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();

	try {
		const context = await getCarerOnboardingContext(admin, result.data.token);
		const now = new Date().toISOString();
		const row = {
			...personDetailsToRow(result.data),
			updated_at: now,
		};

		const { data: carer, error } = await admin
			.from('carers')
			.update(row)
			.eq('id', context.carer.id)
			.select(
				'id, phone, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email',
			)
			.single();

		if (error || !carer) {
			throw error ?? new Error('Carer profile update returned no data.');
		}

		await createSystemAuditLog({
			action: 'carer.updated',
			entityType: 'carer',
			organizationId: context.carer.organization_id,
			entityId: context.carer.id,
			entityName: context.carer.full_name,
			source: 'onboarding',
			details: {
				carer_email: context.carer.email,
				before: {
					phone: context.carer.phone,
					address_line1: context.carer.address_line1,
					address_line2: context.carer.address_line2,
					city: context.carer.city,
					county: context.carer.county,
					postcode: context.carer.postcode,
					emergency_contact_name: context.carer.emergency_contact_name,
					emergency_contact_relationship:
						context.carer.emergency_contact_relationship,
					emergency_contact_phone: context.carer.emergency_contact_phone,
					emergency_contact_email: context.carer.emergency_contact_email,
				},
				after: carer,
				changed_fields: Object.keys(row).filter((key) => key !== 'updated_at'),
				outcome: 'carer_onboarding_profile_saved',
			},
		});

		return NextResponse.json({ carer });
	} catch (error) {
		if (error instanceof OnboardingTokenError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}

		console.error('Failed to save onboarding profile:', error);
		return NextResponse.json(
			{ error: 'Profile details could not be saved.' },
			{ status: 500 },
		);
	}
}
