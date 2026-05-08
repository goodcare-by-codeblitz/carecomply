import {
	getAuditDefaults,
	type AuditAction,
	type AuditCategory,
	type AuditSeverity,
	type CqcKeyQuestion,
	type EntityType,
} from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type AuditRequestContext = {
	ipAddress?: string | null;
	userAgent?: string | null;
};

type CreateAuditLogParams = {
	action: AuditAction;
	entityType: EntityType;
	organizationId: string;
	entityId?: string | null;
	entityName?: string | null;
	details?: Record<string, unknown>;
	category?: AuditCategory;
	severity?: AuditSeverity;
	source?: string;
	cqcKeyQuestion?: CqcKeyQuestion;
	userId?: string | null;
	userEmail?: string | null;
	request?: Request;
};

export function getRequestContext(request?: Request): AuditRequestContext {
	if (!request) return {};

	return {
		ipAddress:
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			request.headers.get('x-real-ip') ||
			null,
		userAgent: request.headers.get('user-agent'),
	};
}

export async function createAuditLog(params: CreateAuditLogParams) {
	const defaults = getAuditDefaults(params.action);
	const requestContext = getRequestContext(params.request);
	const admin = createAdminClient();

	const { data, error } = await admin
		.from('audit_logs')
		.insert({
			organization_id: params.organizationId,
			user_id: params.userId ?? null,
			user_email: params.userEmail ?? null,
			action: params.action,
			entity_type: params.entityType,
			entity_id: params.entityId ?? null,
			entity_name: params.entityName ?? null,
			category: params.category ?? defaults.category,
			severity: params.severity ?? defaults.severity,
			source: params.source ?? 'api',
			cqc_key_question: params.cqcKeyQuestion ?? defaults.cqcKeyQuestion,
			details: {
				...(params.details ?? {}),
				ip_address: requestContext.ipAddress,
				user_agent: requestContext.userAgent,
			},
			ip_address: requestContext.ipAddress,
			user_agent: requestContext.userAgent,
		})
		.select()
		.single();

	if (error) {
		console.error('Failed to create audit log:', error);
		return null;
	}

	return data;
}

export async function createUserAuditLog(
	params: Omit<CreateAuditLogParams, 'userEmail' | 'userId'>,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return null;

	return createAuditLog({
		...params,
		userId: user.id,
		userEmail: user.email ?? null,
	});
}

export async function createSystemAuditLog(
	params: Omit<CreateAuditLogParams, 'userEmail' | 'userId'>,
) {
	return createAuditLog({
		...params,
		source: params.source ?? 'system',
		userId: null,
		userEmail: null,
	});
}
