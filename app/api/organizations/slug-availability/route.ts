import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
	buildSlugCandidates,
	slugify,
	validateOrganizationSlug,
} from '@/lib/slug';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const rawSlug = searchParams.get('slug') ?? '';
	const slug = slugify(rawSlug);
	const hasNumbers = /\d/.test(rawSlug);
	const validationMessage = validateOrganizationSlug(slug);

	if (hasNumbers || validationMessage) {
		return NextResponse.json(
			{
				available: false,
				slug,
				suggestions: [],
				error: hasNumbers
					? 'Use lowercase letters and hyphens only.'
					: validationMessage,
			},
			{ status: 400 },
		);
	}

	try {
		const supabase = createAdminClient();
		const candidates = buildSlugCandidates(slug);
		const slugsToCheck = [slug, ...candidates];
		const { data, error } = await supabase
			.from('organizations')
			.select('slug')
			.in('slug', slugsToCheck);

		if (error) throw error;

		const takenSlugs = new Set((data ?? []).map((row) => row.slug as string));

		return NextResponse.json({
			available: !takenSlugs.has(slug),
			slug,
			suggestions: candidates
				.filter((candidate) => !takenSlugs.has(candidate))
				.slice(0, 3),
		});
	} catch (error) {
		console.error('[slug-availability] Failed to check slug', {
			slug,
			error,
		});

		return NextResponse.json(
			{
				available: false,
				slug,
				suggestions: [],
				error: 'Unable to check slug availability.',
			},
			{ status: 500 },
		);
	}
}
