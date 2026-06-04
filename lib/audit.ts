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
	| 'training'
	| 'system';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditAction =
	| 'audit.export_verified'
	| 'audit.exported'
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
	| 'carer.restored'
	| 'carer.suspended'
	| 'carer.updated'
	| 'document.approved'
	| 'document.rejected'
	| 'document.replaced'
	| 'document.updated'
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
	| 'reminder.worker_configuration_missing'
	| 'settings.updated'
	| 'team.invited'
	| 'team.member_marked_former'
	| 'team.member_on_leave'
	| 'team.member_removed'
	| 'team.member_restored'
	| 'team.member_returned'
	| 'team.member_suspended'
	| 'team.member_updated'
	| 'team.role_changed'
	| 'training.completed'
	| 'training.expired'
	| 'training.updated'
	| 'training_requirement.created'
	| 'training_requirement.deleted'
	| 'training_requirement.updated'
	| 'user.login_attempted'
	| 'user.login_failed'
	| 'user.login'
	| 'user.logout';

export type EntityType =
	| 'audit_export'
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
	| 'training_record'
	| 'training_requirement'
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

type AuditDefaultContext = {
	details?: Record<string, unknown>;
	source?: AuditLogParams['source'] | string;
};

const ACTION_DEFAULTS: Partial<Record<AuditAction, AuditDefaults>> = {
	'audit.export_verified': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'audit.exported': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
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
	'reminder.worker_configuration_missing': {
		category: 'settings',
		severity: 'warning',
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
	'carer.restored': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'carer.suspended': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'safe',
	},
	'carer.created': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'caring',
	},
	'carer.updated': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'caring',
	},
	'document.approved': {
		category: 'documents',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'document.rejected': {
		category: 'documents',
		severity: 'warning',
		cqcKeyQuestion: 'responsive',
	},
	'document.uploaded': {
		category: 'documents',
		severity: 'info',
		cqcKeyQuestion: 'safe',
	},
	'document_type.created': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'document_type.deleted': {
		category: 'governance',
		severity: 'warning',
		cqcKeyQuestion: 'effective',
	},
	'document_type.updated': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'invitation.accepted': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'invitation.reinvited': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'invitation.revoked': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'onboarding.references_updated': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'reference.approved': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'reference.rejected': {
		category: 'onboarding',
		severity: 'warning',
		cqcKeyQuestion: 'effective',
	},
	'reference.requested': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'reference.responded': {
		category: 'onboarding',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'reminder.created': {
		category: 'settings',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'reminder.deleted': {
		category: 'settings',
		severity: 'warning',
		cqcKeyQuestion: 'responsive',
	},
	'reminder.toggled': {
		category: 'settings',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'reminder.updated': {
		category: 'settings',
		severity: 'info',
		cqcKeyQuestion: 'responsive',
	},
	'team.invited': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_marked_former': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_on_leave': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_removed': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_restored': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_returned': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_suspended': {
		category: 'staffing',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'team.member_updated': {
		category: 'staffing',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'team.role_changed': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'training.completed': {
		category: 'training',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'training.expired': {
		category: 'training',
		severity: 'warning',
		cqcKeyQuestion: 'effective',
	},
	'training.updated': {
		category: 'training',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'training_requirement.created': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'training_requirement.deleted': {
		category: 'governance',
		severity: 'warning',
		cqcKeyQuestion: 'effective',
	},
	'training_requirement.updated': {
		category: 'governance',
		severity: 'info',
		cqcKeyQuestion: 'effective',
	},
	'user.login_attempted': {
		category: 'system',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'user.login_failed': {
		category: 'system',
		severity: 'warning',
		cqcKeyQuestion: 'well_led',
	},
	'user.login': {
		category: 'system',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
	'user.logout': {
		category: 'system',
		severity: 'info',
		cqcKeyQuestion: 'well_led',
	},
};

export function getAuditDefaults(
	action: AuditAction,
	context: AuditDefaultContext = {},
): AuditDefaults {
	const contextDefault = getContextualAuditDefaults(action, context.details);
	if (contextDefault) return contextDefault;
	if (ACTION_DEFAULTS[action]) {
		return applySourceDefaults(action, ACTION_DEFAULTS[action], context.source);
	}
	if (action.startsWith('document.')) {
		return applySourceDefaults(
			action,
			{ category: 'documents', severity: 'info', cqcKeyQuestion: 'safe' },
			context.source,
		);
	}
	if (action.startsWith('billing.')) {
		return { category: 'billing', severity: 'info', cqcKeyQuestion: 'well_led' };
	}
	if (action.startsWith('carer.') || action.startsWith('team.')) {
		return applySourceDefaults(
			action,
			{ category: 'staffing', severity: 'info', cqcKeyQuestion: 'safe' },
			context.source,
		);
	}
	if (action.startsWith('settings.') || action.startsWith('reminder.')) {
		return { category: 'settings', severity: 'info', cqcKeyQuestion: 'well_led' };
	}
	return { category: 'system', severity: 'info', cqcKeyQuestion: 'well_led' };
}

function applySourceDefaults(
	action: AuditAction,
	defaults: AuditDefaults,
	source?: AuditDefaultContext['source'],
): AuditDefaults {
	if (
		source === 'onboarding' &&
		(action === 'carer.updated' ||
			action === 'document.uploaded' ||
			action === 'reference.requested' ||
			action === 'onboarding.references_updated')
	) {
		return { ...defaults, category: 'onboarding' };
	}

	return defaults;
}

function getContextualAuditDefaults(
	action: AuditAction,
	details?: Record<string, unknown>,
): AuditDefaults | null {
	if (
		action === 'settings.updated' &&
		details?.setting_area === 'reference_requirements'
	) {
		return {
			category: 'settings',
			severity: 'info',
			cqcKeyQuestion: 'effective',
		};
	}

	return null;
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
