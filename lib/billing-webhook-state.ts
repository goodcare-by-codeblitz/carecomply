export type StripeEventProcessingStatus =
	| 'pending'
	| 'processing'
	| 'processed'
	| 'failed';

export function shouldProcessStripeEvent(status: StripeEventProcessingStatus) {
	return status === 'pending' || status === 'failed';
}

export function isProcessedDuplicate(status: StripeEventProcessingStatus) {
	return status === 'processed';
}

export function addNotificationKey(keys: readonly string[], key: string) {
	if (keys.includes(key)) {
		return { added: false, keys: [...keys] };
	}

	return { added: true, keys: [...keys, key] };
}
