export const CARER_HOLD_STATUSES = new Set(['on_leave', 'suspended', 'former']);

export function canReceiveOnboardingInvite(status: string | null | undefined) {
	return status === 'pending' || status === 'incomplete' || status === 'active';
}

export function canReceiveOperationalCommunication(
	status: string | null | undefined,
) {
	return status === 'active';
}

export function canReceiveReferenceCommunication(
	status: string | null | undefined,
) {
	return status === 'pending' || status === 'incomplete' || status === 'active';
}

export function carerCommunicationBlockedMessage(
	status: string | null | undefined,
) {
	const normalized = status?.replaceAll('_', ' ') || 'unknown';
	return `Carer communications are only sent to active carers. Current status: ${normalized}.`;
}

export function referenceCommunicationBlockedMessage(
	status: string | null | undefined,
) {
	const normalized = status?.replaceAll('_', ' ') || 'unknown';
	return `Reference communications can only be sent while a carer is onboarding or active. Current status: ${normalized}.`;
}
