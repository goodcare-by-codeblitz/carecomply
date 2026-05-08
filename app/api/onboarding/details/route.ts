import {
	getCarerOnboardingContext,
	OnboardingTokenError,
	updateCarerOnboardingProgress,
} from '@/lib/onboarding';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const token = searchParams.get('token');
	const admin = createAdminClient();

	try {
		const context = await getCarerOnboardingContext(admin, token);
		const [documentTypesResult, documentsResult, referencesResult] =
			await Promise.all([
				admin
					.from('document_types')
					.select('id, name, description, is_required, expiry_months')
					.eq('organization_id', context.carer.organization_id)
					.order('name'),
				admin
					.from('documents')
					.select(
						'id, document_type_id, file_name, file_size, status, expiry_date, uploaded_at, rejection_reason',
					)
					.eq('carer_id', context.carer.id)
					.neq('status', 'obsolete')
					.order('uploaded_at', { ascending: false }),
				admin
					.from('carer_references')
					.select('id, full_name, email, phone, relationship, notes')
					.eq('carer_id', context.carer.id)
					.order('created_at', { ascending: true }),
			]);

		const { progress } = await updateCarerOnboardingProgress(
			admin,
			context.carer.id,
			context.carer.organization_id,
		);

		return NextResponse.json({
			invitation: context.invitation,
			organization: context.organization,
			carer: {
				...context.carer,
				onboarding_progress: progress,
			},
			documentTypes: documentTypesResult.data ?? [],
			documents: documentsResult.data ?? [],
			references: referencesResult.data ?? [],
		});
	} catch (error) {
		if (error instanceof OnboardingTokenError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error('Failed to load onboarding details:', error);
		return NextResponse.json(
			{ error: 'Onboarding details could not be loaded.' },
			{ status: 500 },
		);
	}
}
