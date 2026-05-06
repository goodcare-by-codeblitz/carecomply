export const ORGANIZATION_SLUG_MIN_LENGTH = 3;
export const ORGANIZATION_SLUG_MAX_LENGTH = 50;

const ORGANIZATION_SLUG_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;

export function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, ORGANIZATION_SLUG_MAX_LENGTH)
		.replace(/-+$/g, '');
}

export function validateOrganizationSlug(slug: string) {
	if (!slug) return 'Enter a valid organization slug.';
	if (slug.length < ORGANIZATION_SLUG_MIN_LENGTH) {
		return `Slug must be at least ${ORGANIZATION_SLUG_MIN_LENGTH} characters.`;
	}
	if (slug.length > ORGANIZATION_SLUG_MAX_LENGTH) {
		return `Slug must be ${ORGANIZATION_SLUG_MAX_LENGTH} characters or fewer.`;
	}
	if (!ORGANIZATION_SLUG_PATTERN.test(slug)) {
		return 'Use lowercase letters and hyphens only.';
	}

	return null;
}

export function getSlugTakenErrorMessage(error: unknown) {
	if (!error || typeof error !== 'object') return null;

	const maybeError = error as { code?: string; message?: string; details?: string };
	const text = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();

	if (
		maybeError.code === '23505' ||
		text.includes('organizations_slug_key') ||
		text.includes('duplicate key') ||
		text.includes('slug')
	) {
		return 'That organization slug is already taken. Choose another one.';
	}

	return null;
}

export function buildSlugCandidates(baseSlug: string) {
	const base = slugify(baseSlug);
	const suffixes = ['uk', 'hq', 'care', 'team', 'app', 'group'];

	return suffixes
		.map((suffix) => slugify(`${base}-${suffix}`))
		.filter((candidate) => candidate !== base && !validateOrganizationSlug(candidate));
}
