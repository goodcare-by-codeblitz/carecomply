import { createUserAuditLog } from '@/lib/audit-server';
import { getBillingEntitlements } from '@/lib/billing';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const reminderSchema = z.object({
	orgId: z.uuid(),
	name: z.string().trim().min(3),
	documentTypeId: z.uuid().nullable().optional(),
	triggerType: z.enum(['days_before_expiry', 'days_after_expiry']),
	triggerDays: z.number().int().min(0).max(365),
	recipientType: z.enum(['carer', 'management']),
	subjectTemplate: z.string().trim().min(3).max(200).optional(),
	messageTemplate: z.string().trim().min(3).max(4000).optional(),
	isActive: z.boolean(),
});

const updateReminderSchema = reminderSchema.extend({
	id: z.uuid(),
});

const deleteReminderSchema = z.object({
	orgId: z.uuid(),
	id: z.uuid(),
});

type AutomationsWarning = {
	code: string;
	message: string;
};

const FALLBACK_SYSTEM_REMINDERS = [
	{
		id: 'system-30-day',
		document_type_id: null,
		name: '30 day expiry reminder',
		trigger_type: 'days_before_expiry',
		trigger_days: 30,
		recipient_type: 'carer',
		min_plan: 'starter',
		subject_template: '{{document_type}} expires in 30 days',
		message_template:
			'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}',
		is_system: true,
		is_active: true,
		document_types: null,
	},
	{
		id: 'system-7-day',
		document_type_id: null,
		name: '7 day expiry reminder',
		trigger_type: 'days_before_expiry',
		trigger_days: 7,
		recipient_type: 'carer',
		min_plan: 'starter',
		subject_template: '{{document_type}} expires in 7 days',
		message_template:
			'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}',
		is_system: true,
		is_active: true,
		document_types: null,
	},
	{
		id: 'system-expiry-day',
		document_type_id: null,
		name: 'Expiry day reminder',
		trigger_type: 'days_before_expiry',
		trigger_days: 0,
		recipient_type: 'carer',
		min_plan: 'starter',
		subject_template: '{{document_type}} expires today',
		message_template:
			'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires today. Please upload a renewed document here: {{onboarding_link}}',
		is_system: true,
		is_active: true,
		document_types: null,
	},
] as const;

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const orgId = searchParams.get('orgId');

	if (!orgId || !z.string().uuid().safeParse(orgId).success) {
		return json(
			{ error: 'A valid organization id is required.' },
			400,
		);
	}

	const auth = await requireAutomationPermission(
		orgId,
		PERMISSIONS.AUTOMATIONS_VIEW,
	);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const warnings: AutomationsWarning[] = [];
	const { error: seedError } = await admin.rpc('ensure_default_reminders', {
		p_org_id: orgId,
	});

	if (seedError) {
		console.error('[automations] default reminders could not be ensured', seedError);
		warnings.push({
			code: 'default_reminders_seed_failed',
			message: 'Included Starter reminders could not be refreshed.',
		});
	}

	const [remindersResult, logsResult, documentTypesResult, billingResult] =
		await Promise.all([
			admin
				.from('reminders')
				.select(
					'id, organization_id, document_type_id, name, trigger_type, trigger_days, recipient_type, min_plan, subject_template, message_template, is_system, is_active, created_at, updated_at, document_types(name)',
				)
				.eq('organization_id', orgId)
				.order('is_system', { ascending: false })
				.order('created_at', { ascending: false }),
			admin
				.from('reminder_logs')
				.select(
					'id, sent_at, channel, status, recipient_type, recipient_email, error_message, provider_message_id, carers!inner(full_name, email, organization_id), documents(file_name, document_types(name))',
				)
				.eq('carers.organization_id', orgId)
				.order('sent_at', { ascending: false })
				.limit(20),
			admin
				.from('document_types')
				.select('id, name')
				.eq('organization_id', orgId)
				.order('name'),
			admin
				.from('organization_billing')
				.select('plan, status')
				.eq('organization_id', orgId)
				.maybeSingle(),
		]);

	if (logsResult.error) {
		console.error('[automations] reminder logs could not be loaded', logsResult.error);
		warnings.push({
			code: 'reminder_logs_unavailable',
			message: 'Recent reminder activity could not be loaded.',
		});
	}

	if (remindersResult.error) {
		console.error('[automations] reminders could not be loaded', remindersResult.error);
		warnings.push({
			code: 'reminders_unavailable',
			message: 'Saved automation rules could not be loaded. Showing included reminders.',
		});
	}

	if (documentTypesResult.error) {
		console.error('[automations] document types could not be loaded', documentTypesResult.error);
		warnings.push({
			code: 'document_types_unavailable',
			message: 'Document types could not be loaded.',
		});
	}

	if (billingResult.error) {
		console.error('[automations] billing could not be loaded', billingResult.error);
		warnings.push({
			code: 'billing_unavailable',
			message: 'Billing status could not be loaded.',
		});
	}

	const entitlements = getBillingEntitlements(
		billingResult.data?.plan,
		billingResult.data?.status,
	);

	return json({
		reminders: remindersResult.error
			? FALLBACK_SYSTEM_REMINDERS
			: (remindersResult.data ?? []),
		logs: logsResult.error ? [] : (logsResult.data ?? []),
		documentTypes: documentTypesResult.error ? [] : (documentTypesResult.data ?? []),
		billing: {
			plan: entitlements.plan,
			status: entitlements.status,
			isPro: entitlements.customAutomations,
		},
		warnings,
		...(process.env.NODE_ENV !== 'production'
			? {
					diagnostics: {
						reminders: formatQueryError(remindersResult.error),
						documentTypes: formatQueryError(documentTypesResult.error),
						logs: formatQueryError(logsResult.error),
						billing: formatQueryError(billingResult.error),
					},
				}
			: {}),
	});
}

function formatQueryError(error: unknown) {
	if (!error || typeof error !== 'object') return null;
	const maybeError = error as {
		code?: string;
		message?: string;
		details?: string;
		hint?: string;
	};

	return {
		code: maybeError.code ?? null,
		message: maybeError.message ?? null,
		details: maybeError.details ?? null,
		hint: maybeError.hint ?? null,
	};
}

export async function POST(request: Request) {
	const result = reminderSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return json(
			{ error: 'Please provide valid automation details.' },
			400,
		);
	}

	const auth = await requireAutomationPermission(
		result.data.orgId,
		PERMISSIONS.AUTOMATIONS_MANAGE,
	);
	if (!auth.ok) return auth.response;

	const pro = await requirePro(result.data.orgId);
	if (!pro.ok) return pro.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('reminders')
		.insert(toReminderRow(result.data))
		.select(
			'id, organization_id, document_type_id, name, trigger_type, trigger_days, recipient_type, min_plan, subject_template, message_template, is_system, is_active, created_at, updated_at, document_types(name)',
		)
		.single();

	if (error || !data) {
		return json(
			{ error: 'Automation could not be created.' },
			500,
		);
	}

	await createUserAuditLog({
		action: 'reminder.created',
		entityType: 'reminder',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			after: data,
			permission_checked: PERMISSIONS.AUTOMATIONS_MANAGE,
			outcome: 'custom_reminder_created',
		},
		request,
	});

	return json({ reminder: data });
}

export async function PATCH(request: Request) {
	const result = updateReminderSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return json(
			{ error: 'Please provide valid automation details.' },
			400,
		);
	}

	const auth = await requireAutomationPermission(
		result.data.orgId,
		PERMISSIONS.AUTOMATIONS_MANAGE,
	);
	if (!auth.ok) return auth.response;

	const pro = await requirePro(result.data.orgId);
	if (!pro.ok) return pro.response;

	const admin = createAdminClient();
	const { data: existing } = await admin
		.from('reminders')
		.select('*')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();

	if (!existing) {
		return json({ error: 'Automation not found.' }, 404);
	}

	if (existing.is_system) {
		return json(
			{ error: 'Included Starter reminders cannot be edited.' },
			403,
		);
	}

	const { data, error } = await admin
		.from('reminders')
		.update(toReminderRow(result.data))
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.select(
			'id, organization_id, document_type_id, name, trigger_type, trigger_days, recipient_type, min_plan, subject_template, message_template, is_system, is_active, created_at, updated_at, document_types(name)',
		)
		.single();

	if (error || !data) {
		return json(
			{ error: 'Automation could not be updated.' },
			500,
		);
	}

	await createUserAuditLog({
		action: 'reminder.updated',
		entityType: 'reminder',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			before: existing,
			after: data,
			permission_checked: PERMISSIONS.AUTOMATIONS_MANAGE,
			outcome: 'custom_reminder_updated',
		},
		request,
	});

	return json({ reminder: data });
}

export async function DELETE(request: Request) {
	const result = deleteReminderSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return json(
			{ error: 'A valid automation id is required.' },
			400,
		);
	}

	const auth = await requireAutomationPermission(
		result.data.orgId,
		PERMISSIONS.AUTOMATIONS_MANAGE,
	);
	if (!auth.ok) return auth.response;

	const pro = await requirePro(result.data.orgId);
	if (!pro.ok) return pro.response;

	const admin = createAdminClient();
	const { data: existing } = await admin
		.from('reminders')
		.select('*')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();

	if (!existing) {
		return json({ error: 'Automation not found.' }, 404);
	}

	if (existing.is_system) {
		return json(
			{ error: 'Included Starter reminders cannot be deleted.' },
			403,
		);
	}

	const { error } = await admin
		.from('reminders')
		.delete()
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId);

	if (error) {
		return json(
			{ error: 'Automation could not be deleted.' },
			500,
		);
	}

	await createUserAuditLog({
		action: 'reminder.deleted',
		entityType: 'reminder',
		organizationId: result.data.orgId,
		entityId: result.data.id,
		entityName: existing.name,
		details: {
			before: existing,
			permission_checked: PERMISSIONS.AUTOMATIONS_MANAGE,
			outcome: 'custom_reminder_deleted',
		},
		request,
	});

	return json({ ok: true });
}

async function requireAutomationPermission(
	orgId: string,
	permission: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			ok: false as const,
			response: json({ error: 'Unauthorized' }, 401),
		};
	}

	const { data: allowed } = await supabase.rpc('has_org_permission', {
		p_org_id: orgId,
		p_permission_code: permission,
	});

	if (!allowed) {
		return {
			ok: false as const,
			response: json(
				{ error: 'You do not have permission to manage automations.' },
				403,
			),
		};
	}

	return { ok: true as const };
}

async function requirePro(orgId: string) {
	const admin = createAdminClient();
	const { data } = await admin
		.from('organization_billing')
		.select('plan, status')
		.eq('organization_id', orgId)
		.maybeSingle();

	if (getBillingEntitlements(data?.plan, data?.status).customAutomations) {
		return { ok: true as const };
	}

	return {
		ok: false as const,
		response: json(
			{ error: 'Custom automations are available on Pro.' },
			403,
		),
	};
}

function toReminderRow(data: z.infer<typeof reminderSchema>) {
	return {
		organization_id: data.orgId,
		document_type_id: data.documentTypeId ?? null,
		name: data.name,
		trigger_type: data.triggerType,
		trigger_days: data.triggerDays,
		recipient_type: data.recipientType,
		min_plan: 'pro',
		subject_template: data.subjectTemplate || null,
		message_template: data.messageTemplate || null,
		is_system: false,
		is_active: data.isActive,
	};
}

function json(body: unknown, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}
