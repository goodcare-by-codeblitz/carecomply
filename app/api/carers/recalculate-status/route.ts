import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	carerId: z.string().uuid(),
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
			{ error: 'A valid carer id is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: carer, error: carerError } = await admin
		.from('carers')
		.select('id, organization_id')
		.eq('id', result.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer not found.' }, { status: 404 });
	}

	const { data: canReview } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.DOCUMENTS_REVIEW,
	});

	if (!canReview) {
		return NextResponse.json(
			{ error: 'You do not have permission to review documents.' },
			{ status: 403 },
		);
	}

	const status = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
	);

	return NextResponse.json(status);
}
