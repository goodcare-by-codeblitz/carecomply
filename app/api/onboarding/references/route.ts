import {
	getCarerOnboardingContext,
	OnboardingTokenError,
} from '@/lib/onboarding';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const referenceSchema = z.object({
	fullName: z.string().trim().min(2),
	email: z.string().trim().email(),
	phone: z
		.string()
		.trim()
		.min(5)
		.refine((value) => /^[\d\s+()-]+$/.test(value), 'Invalid phone number'),
	relationship: z.string().trim().min(2),
	notes: z.string().trim().optional(),
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
	references: z.array(referenceSchema).min(1).max(5),
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

		const { error: deleteError } = await admin
			.from('carer_references')
			.delete()
			.eq('carer_id', context.carer.id);

		if (deleteError) {
			throw deleteError;
		}

		const { data, error } = await admin
			.from('carer_references')
			.insert(
				payload.references.map((reference) => ({
					carer_id: context.carer.id,
					full_name: reference.fullName,
					email: reference.email.toLowerCase(),
					phone: reference.phone,
					relationship: reference.relationship,
					notes: reference.notes || null,
					created_at: now,
					updated_at: now,
				})),
			)
			.select('id, full_name, email, phone, relationship, notes');

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
