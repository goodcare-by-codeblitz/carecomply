import { createAdminClient } from '@/lib/supabase/admin';

export const CARER_DOCUMENTS_BUCKET = 'carer-documents';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type InvitationRow = {
	id: string;
	organization_id: string;
	invite_type: 'team_member' | 'carer';
	email: string;
	status: 'pending' | 'accepted' | 'revoked' | 'expired';
	expires_at: string | null;
	carer_id: string | null;
	carers:
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
				phone: string | null;
				onboarding_progress: number | null;
		  }
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
				phone: string | null;
				onboarding_progress: number | null;
		  }[]
		| null;
	organizations:
		| {
				name: string;
				slug: string;
		  }
		| {
				name: string;
				slug: string;
		  }[]
		| null;
};

export type CarerOnboardingContext = {
	invitation: {
		id: string;
		organization_id: string;
		email: string;
		status: 'pending' | 'accepted' | 'revoked' | 'expired';
		expires_at: string | null;
	};
	carer: {
		id: string;
		organization_id: string;
		full_name: string;
		email: string;
		phone: string | null;
		onboarding_progress: number | null;
	};
	organization: {
		name: string;
		slug: string;
	} | null;
};

export class OnboardingTokenError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isExpired(expiresAt: string | null) {
	return Boolean(expiresAt && new Date(expiresAt) < new Date());
}

export async function getCarerOnboardingContext(
	admin: SupabaseAdminClient,
	token: string | null | undefined,
): Promise<CarerOnboardingContext> {
	if (!token) {
		throw new OnboardingTokenError('Onboarding token is required.', 400);
	}

	const { data, error } = await admin
		.from('organization_invitations')
		.select(
			'id, organization_id, invite_type, email, status, expires_at, carer_id, carers(id, organization_id, full_name, email, phone, onboarding_progress), organizations(name, slug)',
		)
		.eq('token', token)
		.maybeSingle();

	if (error || !data) {
		throw new OnboardingTokenError('This onboarding link was not found.', 404);
	}

	const invitation = data as InvitationRow;

	if (invitation.invite_type !== 'carer') {
		throw new OnboardingTokenError(
			'This invitation is not a carer onboarding link.',
			400,
		);
	}

	if (invitation.status === 'revoked') {
		throw new OnboardingTokenError('This onboarding link has been revoked.', 409);
	}

	if (invitation.status === 'expired' || isExpired(invitation.expires_at)) {
		if (invitation.status !== 'expired') {
			await admin
				.from('organization_invitations')
				.update({ status: 'expired', updated_at: new Date().toISOString() })
				.eq('id', invitation.id);
		}

		throw new OnboardingTokenError('This onboarding link has expired.', 409);
	}

	const carer = normalizeRelation(invitation.carers);

	if (!invitation.carer_id || !carer) {
		throw new OnboardingTokenError(
			'This onboarding link is not linked to a carer profile.',
			404,
		);
	}

	const organization = normalizeRelation(invitation.organizations);

	return {
		invitation: {
			id: invitation.id,
			organization_id: invitation.organization_id,
			email: invitation.email,
			status: invitation.status,
			expires_at: invitation.expires_at,
		},
		carer,
		organization,
	};
}

export async function updateCarerOnboardingProgress(
	admin: SupabaseAdminClient,
	carerId: string,
	organizationId: string,
) {
	const [{ data: requiredTypes }, { data: documents }] = await Promise.all([
		admin
			.from('document_types')
			.select('id')
			.eq('organization_id', organizationId)
			.eq('is_required', true),
		admin
			.from('documents')
			.select('document_type_id, status')
			.eq('carer_id', carerId)
			.neq('status', 'rejected'),
	]);

	const requiredIds = new Set((requiredTypes ?? []).map((type) => type.id));
	const uploadedRequiredIds = new Set(
		(documents ?? [])
			.map((document) => document.document_type_id)
			.filter((id) => requiredIds.has(id)),
	);
	const progress =
		requiredIds.size === 0
			? 100
			: Math.round((uploadedRequiredIds.size / requiredIds.size) * 100);

	await admin
		.from('carers')
		.update({
			onboarding_progress: progress,
			status: progress === 100 ? 'active' : 'incomplete',
			updated_at: new Date().toISOString(),
		})
		.eq('id', carerId);

	return progress;
}
