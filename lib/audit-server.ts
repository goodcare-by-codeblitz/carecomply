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

type AuthAuditOutcome = 'attempted' | 'success' | 'failure' | 'logout';

type AuthAuditEventParams = {
	email?: string | null;
	userId?: string | null;
	outcome: AuthAuditOutcome;
	failureReason?: string | null;
	details?: Record<string, unknown>;
	request?: Request;
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

export async function createAuthAuditEvent(params: AuthAuditEventParams) {
	try {
		const admin = createAdminClient();
		const requestContext = getRequestContext(params.request);
		const email = normalizeEmail(params.email);
		const organizations = await resolveAuthAuditOrganizations({
			userId: params.userId,
			email,
		});
		const matchedOrganizationIds = organizations.map(
			(organization) => organization.id,
		);

		const { error } = await admin.from('auth_audit_events').insert({
			email,
			user_id: params.userId ?? null,
			outcome: params.outcome,
			failure_reason: params.failureReason ?? null,
			matched_organization_ids: matchedOrganizationIds,
			details: {
				...(params.details ?? {}),
				ip_address: requestContext.ipAddress,
				user_agent: requestContext.userAgent,
			},
			ip_address: requestContext.ipAddress,
			user_agent: requestContext.userAgent,
		});

		if (error) {
			console.error('Failed to create auth audit event:', error);
		}

		const action = getAuthAuditAction(params.outcome);
		await Promise.all(
			organizations.map((organization) =>
				createAuditLog({
					action,
					entityType: 'user',
					organizationId: organization.id,
					entityId: params.userId ?? null,
					entityName: email,
					userId: params.userId ?? null,
					userEmail: email,
					details: {
						...(params.details ?? {}),
						outcome: params.outcome,
						failure_reason: params.failureReason ?? null,
						matched_organization_ids: matchedOrganizationIds,
					},
					source: 'system',
					request: params.request,
				}),
			),
		);

		return { matchedOrganizationIds };
	} catch (error) {
		console.error('Failed to create auth audit event:', error);
		return { matchedOrganizationIds: [] };
	}
}

async function resolveAuthAuditOrganizations(params: {
	userId?: string | null;
	email?: string | null;
}) {
	const admin = createAdminClient();
	let userId = params.userId ?? null;

	if (!userId && params.email) {
		const { data: profile } = await admin
			.from('profiles')
			.select('id')
			.ilike('email', params.email)
			.maybeSingle();
		userId = profile?.id ?? null;
	}

	if (!userId) return [];

	const { data, error } = await admin
		.from('organization_memberships')
		.select('organizations(id, name, slug)')
		.eq('user_id', userId)
		.is('deleted_at', null)
		.in('status', ['active', 'on_leave']);

	if (error || !Array.isArray(data)) return [];

	return data
		.map((row) => {
			const organizations = (row as {
				organizations?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
			}).organizations;
			return Array.isArray(organizations) ? organizations[0] : organizations;
		})
		.filter((organization): organization is { id: string; name: string; slug: string } =>
			Boolean(organization?.id),
		);
}

function getAuthAuditAction(outcome: AuthAuditOutcome): AuditAction {
	if (outcome === 'failure') return 'user.login_failed';
	if (outcome === 'success') return 'user.login';
	if (outcome === 'logout') return 'user.logout';
	return 'user.login_attempted';
}

function normalizeEmail(email?: string | null) {
	const trimmed = email?.trim().toLowerCase();
	return trimmed || null;
}
