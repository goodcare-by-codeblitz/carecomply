export type CqcKeyQuestion =
	| 'safe'
	| 'effective'
	| 'caring'
	| 'responsive'
	| 'well_led';

export type AuditCategory =
	| 'billing'
	| 'documents'
	| 'governance'
	| 'onboarding'
	| 'settings'
	| 'staffing'
	| 'system';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditAction =
	| 'billing.checkout_completed'
	| 'billing.checkout_started'
	| 'billing.invoice_payment_failed'
	| 'billing.portal_opened'
	| 'billing.subscription_change_requested'
	| 'billing.subscription_updated'
	| 'carer.created'
	| 'carer.invited'
	| 'carer.marked_former'
	| 'carer.marked_on_leave'
	| 'carer.returned_from_leave'
	| 'carer.updated'
	| 'document.approved'
	| 'document.rejected'
	| 'document.uploaded'
	| 'document.viewed'
	| 'document_type.created'
	| 'document_type.deleted'
	| 'document_type.updated'
	| 'email.sent'
	| 'invitation.accepted'
	| 'invitation.reinvited'
	| 'invitation.revoked'
	| 'onboarding.references_updated'
	| 'reference.approved'
	| 'reference.rejected'
	| 'reference.requested'
	| 'reference.responded'
	| 'reminder.created'
	| 'reminder.deleted'
	| 'reminder.toggled'
	| 'reminder.updated'
	| 'settings.updated'
	| 'team.invited'
	| 'team.member_removed'
	| 'team.role_changed'
	| 'user.login'
	| 'user.logout';

export type EntityType =
	| 'billing'
	| 'carer'
	| 'document'
	| 'document_type'
	| 'email'
	| 'invitation'
	| 'organization'
	| 'reference'
	| 'reminder'
	| 'team_member'
	| 'user';

export type AuditLogParams = {
	action: AuditAction;
	entityType: EntityType;
	orgId?: string;
	orgSlug?: string;
	entityId?: string | null;
	entityName?: string | null;
	details?: Record<string, unknown>;
	category?: AuditCategory;
	severity?: AuditSeverity;
	source?: 'dashboard' | 'onboarding' | 'api' | 'stripe_webhook' | 'system';
	cqcKeyQuestion?: CqcKeyQuestion;
};

type AuditDefaults = {
	category: AuditCategory;
	severity: AuditSeverity;
	cqcKeyQuestion: CqcKeyQuestion;
};

const ACTION_DEFAULTS: Partial<Record<AuditAction, AuditDefaults>> = {
	'billing.checkout_completed': {
		category: 'billing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'billing.checkout_started': {
		category: 'billing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'billing.invoice_payment_failed': {
		category: 'billing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'billing.portal_opened': {
		category: 'billing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'billing.subscription_change_requested': {
		category: 'billing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'billing.subscription_updated': {
		category: 'billing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'carer.marked_former': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'safe',
	},
	'carer.marked_on_leave': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'carer.returned_from_leave': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'document.approved': {
		category: 'documents',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'document.rejected': {
		category: 'documents',
		severity: 'warning',
		cqcKeyQuestion: 'safe',
	},
	'document.uploaded': {
		category: 'documents',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'document_type.created': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'document_type.deleted': {
		category: 'governance',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'document_type.updated': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'invitation.accepted': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'invitation.reinvited': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'invitation.revoked': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'onboarding.references_updated': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'reference.approved': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'reference.rejected': {
		category: 'onboarding',
		severity: 'warning',
		cqcKeyQuestion: 'safe',
	},
	'reference.requested': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'reference.responded': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'team.invited': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_removed': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'team.role_changed': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
};

export function getAuditDefaults(action: AuditAction): AuditDefaults {
	if (ACTION_DEFAULTS[action]) return ACTION_DEFAULTS[action];
	if (action.startsWith('document.')) {
		return { category: 'documents', severity: 'info', cqcKeyQuestion: 'safe' };
	}
	if (action.startsWith('billing.')) {
		return { category: 'billing', severity: 'info', cqcKeyQuestion: 'well_led' };
	}
	if (action.startsWith('carer.') || action.startsWith('team.')) {
		return { category: 'staffing', severity: 'info', cqcKeyQuestion: 'safe' };
	}
	if (action.startsWith('settings.') || action.startsWith('reminder.')) {
		return { category: 'settings', severity: 'info', cqcKeyQuestion: 'well_led' };
	}
	return { category: 'system', severity: 'info', cqcKeyQuestion: 'well_led' };
}

export async function logAction(params: AuditLogParams) {
	try {
		await fetch('/api/audit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});
	} catch (error) {
		console.error('Failed to log action:', error);
	}
}
