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
				required_work_references_count: number | null;
				required_character_references_count: number | null;
		  }
		| {
				name: string;
				slug: string;
				required_work_references_count: number | null;
				required_character_references_count: number | null;
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
		required_work_references_count: number | null;
		required_character_references_count: number | null;
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
			'id, organization_id, invite_type, email, status, expires_at, carer_id, carers(id, organization_id, full_name, email, phone, onboarding_progress), organizations(name, slug, required_work_references_count, required_character_references_count)',
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
	options: { preserveEmploymentStatus?: boolean } = {},
) {
	const [{ data: carer }, { data: requiredTypes }, { data: documents }, { data: orgData }, { data: refRows }] =
		await Promise.all([
			admin.from('carers').select('status').eq('id', carerId).maybeSingle(),
			admin
				.from('document_types')
				.select('id')
				.eq('organization_id', organizationId)
				.eq('is_required', true),
			admin
				.from('documents')
				.select('document_type_id, status, expiry_date')
				.eq('carer_id', carerId),
			admin
				.from('organizations')
				.select('required_work_references_count, required_character_references_count')
				.eq('id', organizationId)
				.maybeSingle(),
			admin
				.from('carer_references')
				.select('reference_type')
				.eq('carer_id', carerId),
		]);

	const requiredIds = new Set((requiredTypes ?? []).map((type) => type.id));
	const approvedRequiredIds = new Set<string>();
	let hasSubmittedRequiredDocument = false;
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	(documents ?? []).forEach((document) => {
		if (!requiredIds.has(document.document_type_id)) return;
		if (document.status === 'obsolete') return;

		hasSubmittedRequiredDocument = true;

		const expiryDate = document.expiry_date
			? new Date(document.expiry_date)
			: null;
		if (expiryDate) {
			expiryDate.setHours(0, 0, 0, 0);
		}
		const isUnexpired = !expiryDate || expiryDate >= today;

		if (document.status === 'approved' && isUnexpired) {
			approvedRequiredIds.add(document.document_type_id);
		}
	});

	const reqWork = orgData?.required_work_references_count ?? 0;
	const reqChar = orgData?.required_character_references_count ?? 0;
	const workCount = (refRows ?? []).filter((r) => r.reference_type === 'work').length;
	const charCount = (refRows ?? []).filter((r) => r.reference_type === 'character').length;
	const workSlot = reqWork > 0 ? 1 : 0;
	const charSlot = reqChar > 0 ? 1 : 0;
	const workDone = reqWork > 0 && workCount >= reqWork ? 1 : 0;
	const charDone = reqChar > 0 && charCount >= reqChar ? 1 : 0;

	const totalSlots = requiredIds.size + workSlot + charSlot;
	const filledSlots = approvedRequiredIds.size + workDone + charDone;

	const progress = totalSlots === 0 ? 0 : Math.round((filledSlots / totalSlots) * 100);

	const allDocsDone = requiredIds.size === 0 || approvedRequiredIds.size === requiredIds.size;
	const allRefsDone = workDone === workSlot && charDone === charSlot;
	const status =
		totalSlots === 0 || (!hasSubmittedRequiredDocument && requiredIds.size > 0)
			? 'pending'
			: allDocsDone && allRefsDone
				? 'active'
				: 'incomplete';
	const shouldPreserveEmploymentStatus =
		options.preserveEmploymentStatus !== false &&
		(carer?.status === 'on_leave' || carer?.status === 'former');

	await admin
		.from('carers')
		.update({
			onboarding_progress: progress,
			...(shouldPreserveEmploymentStatus ? {} : { status }),
			updated_at: new Date().toISOString(),
		})
		.eq('id', carerId);

	return {
		progress,
		status: shouldPreserveEmploymentStatus ? carer?.status : status,
	};
}
