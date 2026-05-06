import {
	isMissingColumnOrBucketError,
	isMissingRelationError,
} from '@/lib/orgs';

export const INVITATION_SETUP_MESSAGE =
	'Invitation setup required. Add the organization_invitations table to enable invite links.';

export type InvitationType = 'team_member' | 'carer';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type OrganizationInvitation = {
	id: string;
	organization_id: string;
	invite_type: InvitationType;
	email: string;
	token: string | null;
	status: InvitationStatus;
	role_id: string | null;
	carer_id: string | null;
	invited_by: string | null;
	accepted_by: string | null;
	expires_at: string | null;
	revoked_at: string | null;
	created_at: string;
	updated_at: string | null;
};

export function createInvitationToken() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getInviteExpiry(days = 7) {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + days);
	return expiresAt.toISOString();
}

export function isInvitationSetupMissing(error: unknown) {
	return isMissingRelationError(error) || isMissingColumnOrBucketError(error);
}

export function getInvitationLink(
	token: string,
	origin: string,
	inviteType: InvitationType = 'team_member',
) {
	const path = inviteType === 'carer' ? 'onboarding' : 'invite';
	return `${origin}/${path}/${token}`;
}
