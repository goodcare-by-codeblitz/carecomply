import {
	canReceiveReferenceCommunication,
	referenceCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { getReferenceFormLink, ensureReferenceToken } from '@/lib/reference-requests';
import type { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

type AdminClient = ReturnType<typeof createAdminClient>;

type ReferenceJob = {
	id: string;
	organization_id: string;
	reference_id: string;
	carer_id: string;
	job_type: 'initial_request' | 'chase' | 'manager_notification';
	attempts: number;
	max_attempts: number;
	payload: Record<string, unknown>;
};

type ReferenceForEmail = {
	id: string;
	full_name: string;
	email: string;
	organization: string | null;
	relationship: string;
	reference_type: string;
	status: string;
	reference_token: string | null;
	token_expires_at: string | null;
	chase_count: number | null;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
		  }[]
		| null;
};

type ReferenceForManagerNotification = {
	id: string;
	full_name: string;
	email: string;
	relationship: string;
	reference_type: string;
	status: string;
	response_received_at: string | null;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }[]
		| null;
};

type OrganizationRow = {
	name: string;
	slug: string;
};

type ManagementMembership = {
	user_id: string | null;
	roles: { name: string } | { name: string }[] | null;
};

type ManagementRecipient = {
	id?: string;
	email: string | null;
	full_name: string | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function processReferenceJobBatch(
	admin: AdminClient,
	batchSize = 25,
) {
	const workerId = `reference-worker-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}`;
	const { data, error } = await admin.rpc('claim_reference_jobs', {
		p_worker_id: workerId,
		p_limit: batchSize,
	});

	if (error) {
		throw new Error(error.message || 'Reference jobs could not be claimed.');
	}

	const jobs = (data ?? []) as ReferenceJob[];
	const results = {
		claimed: jobs.length,
		sent: 0,
		skipped: 0,
		failed: 0,
		retryable: 0,
	};

	for (const job of jobs) {
		const result = await processReferenceJob(admin, job);
		results[result] += 1;
	}

	return results;
}

async function processReferenceJob(
	admin: AdminClient,
	job: ReferenceJob,
): Promise<'sent' | 'skipped' | 'failed' | 'retryable'> {
	if (job.job_type === 'manager_notification') {
		return sendManagerNotification(admin, job);
	}

	return sendReferenceRequest(admin, job);
}

async function sendReferenceRequest(admin: AdminClient, job: ReferenceJob) {
	const { data, error } = await admin
		.from('carer_references')
		.select(
			'id, full_name, email, organization, relationship, reference_type, status, reference_token, token_expires_at, chase_count, carers!inner(id, full_name, email, status, organization_id)',
		)
		.eq('id', job.reference_id)
		.maybeSingle();

	if (error || !data) {
		await markSkipped(admin, job, 'Reference not found.');
		return 'skipped' as const;
	}

	const reference = data as ReferenceForEmail;
	const carer = normalizeRelation(reference.carers);
	if (!carer) {
		await markSkipped(admin, job, 'Reference is not linked to a carer.');
		return 'skipped' as const;
	}

	if (['responded', 'approved', 'rejected'].includes(reference.status)) {
		await markSkipped(admin, job, 'Reference no longer needs chasing.');
		return 'skipped' as const;
	}

	if (!canReceiveReferenceCommunication(carer.status)) {
		await markSkipped(admin, job, referenceCommunicationBlockedMessage(carer.status));
		return 'skipped' as const;
	}

	const apiKey = process.env.RESEND_API_KEY;
	const fromEmail = process.env.RESEND_FROM_EMAIL;
	if (!apiKey || !fromEmail) {
		await markRetryable(admin, job, 'Resend email is not configured.');
		return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
	}

	const { data: organization } = await admin
		.from('organizations')
		.select('name, slug')
		.eq('id', carer.organization_id)
		.maybeSingle();
	const org = (organization ?? { name: 'CareComply', slug: '' }) as OrganizationRow;
	const token = reference.reference_token ?? (await ensureReferenceToken(admin, reference.id)).token;
	const formUrl = getReferenceFormLink(token);
	const isChase = job.job_type === 'chase';
	const subject = isChase
		? `Reminder: reference request for ${carer.full_name}`
		: `Reference request for ${carer.full_name}`;
	const resend = new Resend(apiKey);
	const { data: emailData, error: emailError } = await resend.emails.send({
		from: `${org.name} <${fromEmail}>`,
		to: reference.email,
		subject,
		html: buildReferenceRequestHtml({
			orgName: org.name,
			refereeName: reference.full_name,
			carerName: carer.full_name,
			relationship: reference.relationship,
			referenceType: reference.reference_type,
			formUrl,
			isChase,
		}),
	});

	if (emailError) {
		await markRetryable(admin, job, emailError.message || 'Resend rejected email.');
		return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
	}

	const now = new Date().toISOString();
	const nextChaseCount =
		job.job_type === 'chase'
			? Math.max(Number(reference.chase_count ?? 0) + 1, getPayloadNumber(job.payload.chase_number))
			: Number(reference.chase_count ?? 0);

	await admin
		.from('carer_references')
		.update({
			status: 'requested',
			request_sent_at: now,
			request_attempted_at: now,
			request_error: null,
			last_chased_at: job.job_type === 'chase' ? now : null,
			chase_count: nextChaseCount,
			updated_at: now,
		})
		.eq('id', reference.id);

	await markSent(admin, job);
	await insertLog(admin, job, {
		eventType: job.job_type,
		recipientType: 'referee',
		recipientEmail: reference.email,
		status: 'sent',
		providerMessageId: emailData?.id ?? null,
	});

	return 'sent' as const;
}

async function sendManagerNotification(admin: AdminClient, job: ReferenceJob) {
	const { data, error } = await admin
		.from('carer_references')
		.select(
			'id, full_name, email, relationship, reference_type, status, response_received_at, carers!inner(id, full_name, email, organization_id)',
		)
		.eq('id', job.reference_id)
		.maybeSingle();

	if (error || !data) {
		await markSkipped(admin, job, 'Reference not found.');
		return 'skipped' as const;
	}

	const reference = data as ReferenceForManagerNotification;
	const carer = normalizeRelation(reference.carers);
	if (!carer || reference.status !== 'responded') {
		await markSkipped(admin, job, 'Reference response is not ready for notification.');
		return 'skipped' as const;
	}

	const apiKey = process.env.RESEND_API_KEY;
	const fromEmail = process.env.RESEND_FROM_EMAIL;
	if (!apiKey || !fromEmail) {
		await markRetryable(admin, job, 'Resend email is not configured.');
		return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
	}

	const { data: organization } = await admin
		.from('organizations')
		.select('name, slug')
		.eq('id', carer.organization_id)
		.maybeSingle();
	const org = (organization ?? { name: 'CareComply', slug: '' }) as OrganizationRow;
	const recipients = await getManagementRecipients(admin, carer.organization_id);
	const validRecipients = recipients.filter(
		(recipient): recipient is { email: string; full_name: string | null } =>
			Boolean(recipient.email),
	);

	if (validRecipients.length === 0) {
		await markSkipped(admin, job, 'No manager recipients found.');
		return 'skipped' as const;
	}

	const dashboardUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/${org.slug}/carers/${carer.id}`;
	const resend = new Resend(apiKey);
	const { data: emailData, error: emailError } = await resend.emails.send({
		from: `${org.name} <${fromEmail}>`,
		to: validRecipients.map((recipient) => recipient.email),
		subject: `${reference.full_name} responded to ${carer.full_name}'s reference request`,
		html: buildManagerNotificationHtml({
			orgName: org.name,
			refereeName: reference.full_name,
			carerName: carer.full_name,
			dashboardUrl,
		}),
	});

	if (emailError) {
		await markRetryable(admin, job, emailError.message || 'Resend rejected email.');
		return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
	}

	await markSent(admin, job);
	for (const recipient of validRecipients) {
		await insertLog(admin, job, {
			eventType: 'manager_notification',
			recipientType: 'manager',
			recipientEmail: recipient.email,
			status: 'sent',
			providerMessageId: emailData?.id ?? null,
		});
	}

	return 'sent' as const;
}

async function getManagementRecipients(admin: AdminClient, organizationId: string) {
	const { data: memberships } = await admin
		.from('organization_memberships')
		.select('user_id, roles!inner(name)')
		.eq('organization_id', organizationId)
		.is('deleted_at', null)
		.eq('status', 'active');

	const userIds = Array.from(
		new Set(
			((memberships ?? []) as ManagementMembership[])
				.filter((membership) => {
					const role = normalizeRelation(membership.roles);
					const roleName = role?.name?.toLowerCase();
					return roleName === 'admin' || roleName === 'manager';
				})
				.map((membership) => membership.user_id)
				.filter((userId): userId is string => Boolean(userId)),
		),
	);

	if (userIds.length === 0) return [];

	const { data: profiles } = await admin
		.from('profiles')
		.select('id, full_name, email')
		.in('id', userIds);

	return ((profiles ?? []) as ManagementRecipient[]).map((profile) => ({
		email: profile.email,
		full_name: profile.full_name,
	}));
}

async function markSent(admin: AdminClient, job: ReferenceJob) {
	await admin
		.from('reference_jobs')
		.update({
			status: 'sent',
			processed_at: new Date().toISOString(),
			last_error: null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.id);
}

async function markRetryable(admin: AdminClient, job: ReferenceJob, message: string) {
	const exhausted = job.attempts >= job.max_attempts;
	await admin
		.from('reference_jobs')
		.update({
			status: exhausted ? 'failed' : 'queued',
			last_error: message,
			locked_at: null,
			locked_by: null,
			processed_at: exhausted ? new Date().toISOString() : null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.id);

	await admin
		.from('carer_references')
		.update({
			request_error: message,
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.reference_id);

	if (exhausted) {
		await insertLog(admin, job, {
			eventType: job.job_type,
			recipientType: job.job_type === 'manager_notification' ? 'manager' : 'referee',
			recipientEmail: null,
			status: 'failed',
			errorMessage: message,
		});
	}
}

async function markSkipped(admin: AdminClient, job: ReferenceJob, message: string) {
	await admin
		.from('reference_jobs')
		.update({
			status: 'skipped',
			last_error: message,
			processed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.id);

	await insertLog(admin, job, {
		eventType: job.job_type,
		recipientType: job.job_type === 'manager_notification' ? 'manager' : 'referee',
		recipientEmail: null,
		status: 'skipped',
		errorMessage: message,
	});
}

async function insertLog(
	admin: AdminClient,
	job: ReferenceJob,
	values: {
		eventType: string;
		recipientType: 'referee' | 'manager';
		recipientEmail?: string | null;
		status: string;
		errorMessage?: string | null;
		providerMessageId?: string | null;
	},
) {
	await admin.from('reference_logs').insert({
		organization_id: job.organization_id,
		reference_id: job.reference_id,
		reference_job_id: job.id,
		carer_id: job.carer_id,
		channel: 'email',
		recipient_type: values.recipientType,
		recipient_email: values.recipientEmail ?? null,
		status: values.status,
		event_type: values.eventType,
		error_message: values.errorMessage ?? null,
		provider_message_id: values.providerMessageId ?? null,
	});
}

function buildReferenceRequestHtml(params: {
	orgName: string;
	refereeName: string;
	carerName: string;
	relationship: string;
	referenceType: string;
	formUrl: string;
	isChase: boolean;
}) {
	return `
		<p>Hi ${escapeHtml(params.refereeName)},</p>
		<p>${escapeHtml(params.orgName)} has asked you to provide a ${escapeHtml(params.referenceType)} reference for ${escapeHtml(params.carerName)}.</p>
		<p>Relationship: ${escapeHtml(params.relationship)}</p>
		<p><a href="${params.formUrl}">Complete reference form</a></p>
		<p>${params.isChase ? 'This is a reminder because the reference has not been received yet.' : 'Thank you for helping us complete this compliance check.'}</p>
	`;
}

function buildManagerNotificationHtml(params: {
	orgName: string;
	refereeName: string;
	carerName: string;
	dashboardUrl: string;
}) {
	return `
		<p>${escapeHtml(params.refereeName)} has submitted a reference for ${escapeHtml(params.carerName)}.</p>
		<p><a href="${params.dashboardUrl}">Review the response in CareComply</a></p>
	`;
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getPayloadNumber(value: unknown) {
	return typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10) || 0;
}
