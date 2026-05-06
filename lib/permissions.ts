export const PERMISSIONS = {
	CARERS_VIEW: 'carers.view',
	CARERS_CREATE: 'carers.create',
	CARERS_EDIT: 'carers.edit',
	CARERS_DELETE: 'carers.delete',

	DOCUMENTS_VIEW: 'documents.view',
	DOCUMENTS_UPLOAD: 'documents.upload',
	DOCUMENTS_DELETE: 'documents.delete',
	DOCUMENTS_REVIEW: 'documents.review',

	TEAM_VIEW: 'team.view',
	TEAM_INVITE: 'team.invite',
	TEAM_MANAGE: 'team.manage',

	SETTINGS_VIEW: 'settings.view',
	SETTINGS_MANAGE: 'settings.manage',

	BILLING_VIEW: 'billing.view',
	BILLING_MANAGE: 'billing.manage',

	AUTOMATIONS_VIEW: 'automations.view',
	AUTOMATIONS_MANAGE: 'automations.manage',

	AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
