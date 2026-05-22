import {
	canReceiveOperationalCommunication,
	carerCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { getInvitationLink } from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

type ReminderJob = {
	id: string;
	organization_id: string;
	reminder_id: string | null;
	carer_id: string;
	document_id: string | null;
	recipient_type: 'carer' | 'management';
	recipient_email: string | null;
	recipient_name: string | null;
	due_on: string;
	payload: Record<string, unknown>;
	status: string;
	attempts: number;
	max_attempts: number;
};

type ManagementRecipient = {
	id?: string;
	email: string | null;
	full_name: string | null;
};

type ManagementMembership = {
	user_id: string | null;
	roles: { name: string } | { name: string }[] | null;
};

type DocumentEligibility = {
	status: string | null;
	superseded_by: string | null;
	expiry_date: string | null;
};

const DEFAULT_BATCH_SIZE = 25;

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(request: Request) {
	const configuredSecret = process.env.REMINDER_WORKER_SECRET;
	const authorization = request.headers.get('authorization') ?? '';
	const providedSecret = authorization.startsWith('Bearer ')
		? authorization.slice('Bearer '.length)
		: request.headers.get('x-reminder-worker-secret');

	if (!configuredSecret || providedSecret !== configuredSecret) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = createAdminClient();
	const workerId = `next-worker-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2)}`;
	const batchSize = await readBatchSize(request);
	const { data, error } = await admin.rpc('claim_reminder_jobs', {
		p_worker_id: workerId,
		p_limit: batchSize,
	});

	if (error) {
		console.error('[reminder-worker] failed to claim jobs', error);
		return NextResponse.json(
			{ error: 'Reminder jobs could not be claimed.' },
			{ status: 500 },
		);
	}

	const jobs = (data ?? []) as ReminderJob[];
	const results = {
		claimed: jobs.length,
		sent: 0,
		skipped: 0,
		failed: 0,
		retryable: 0,
	};

	for (const job of jobs) {
		const result = await processJob(admin, job);
		results[result] += 1;
	}

	return NextResponse.json({ ok: true, ...results });
}

async function readBatchSize(request: Request) {
	try {
		const body = (await request.json()) as { batchSize?: number };
		if (!body.batchSize) return DEFAULT_BATCH_SIZE;
		return Math.max(1, Math.min(100, Math.floor(body.batchSize)));
	} catch {
		return DEFAULT_BATCH_SIZE;
	}
}

async function processJob(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
): Promise<'sent' | 'skipped' | 'failed' | 'retryable'> {
	try {
		const carerStatus = await getCarerStatus(admin, job.carer_id);
		if (!canReceiveOperationalCommunication(carerStatus)) {
			await markSkipped(
				admin,
				job,
				carerCommunicationBlockedMessage(carerStatus),
			);
			return 'skipped';
		}

		const documentEligibility = await getDocumentEligibility(admin, job.document_id);
		if (documentEligibility && documentEligibility.status !== 'approved') {
			await markSkipped(admin, job, 'Document is no longer approved.');
			return 'skipped';
		}

		if (documentEligibility?.superseded_by) {
			await markSkipped(admin, job, 'Document has been replaced.');
			return 'skipped';
		}

		if (documentEligibility && !isDocumentStillDue(job, documentEligibility)) {
			await markSkipped(admin, job, 'Document is no longer due for this reminder.');
			return 'skipped';
		}

		const apiKey = process.env.RESEND_API_KEY;
		const fromEmail = process.env.RESEND_FROM_EMAIL;

		if (!apiKey || !fromEmail) {
			await markRetryable(admin, job, 'Resend email is not configured.');
			return 'retryable';
		}

		const recipients =
			job.recipient_type === 'management'
				? await getManagementRecipients(admin, job.organization_id)
				: [
						{
							email: job.recipient_email,
							full_name: job.recipient_name,
						},
					];

		const validRecipients = recipients.filter(
			(recipient): recipient is { email: string; full_name: string | null } =>
				Boolean(recipient.email),
		);

		if (validRecipients.length === 0) {
			await markSkipped(admin, job, 'No valid recipient email was found.');
			return 'skipped';
		}

		const context = await buildTemplateContext(admin, job);
		const subject = renderTemplate(
			getPayloadString(job.payload.subject_template) ||
				'CareComply document reminder',
			context,
		);
		const body = renderTemplate(
			getPayloadString(job.payload.message_template) ||
				'Please review your CareComply document status.',
			context,
		);
		const resend = new Resend(apiKey);
		const { data, error } = await resend.emails.send({
			from: `${context.organization_name} <${fromEmail}>`,
			to: validRecipients.map((recipient) => recipient.email),
			subject,
			html: toHtml(body),
		});

		if (error) {
			await markRetryable(admin, job, error.message || 'Resend rejected email.');
			return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
		}

		await admin
			.from('reminder_jobs')
			.update({
				status: 'sent',
				processed_at: new Date().toISOString(),
				last_error: null,
				updated_at: new Date().toISOString(),
			})
			.eq('id', job.id);

		for (const recipient of validRecipients) {
			await insertLog(admin, job, {
				status: 'sent',
				recipientEmail: recipient.email,
				providerMessageId: data?.id ?? null,
			});
		}

		return 'sent';
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Reminder processing failed.';
		await markRetryable(admin, job, message);
		return job.attempts >= job.max_attempts ? 'failed' : 'retryable';
	}
}

async function getCarerStatus(
	admin: ReturnType<typeof createAdminClient>,
	carerId: string,
) {
	const { data, error } = await admin
		.from('carers')
		.select('status')
		.eq('id', carerId)
		.maybeSingle();

	if (error) {
		console.error('[reminder-worker] failed to resolve carer status', error);
		return null;
	}

	return data?.status ?? null;
}

async function getDocumentEligibility(
	admin: ReturnType<typeof createAdminClient>,
	documentId: string | null,
) {
	if (!documentId) return null;

	const { data, error } = await admin
		.from('documents')
		.select('status, superseded_by, expiry_date')
		.eq('id', documentId)
		.maybeSingle();

	if (error) {
		console.error('[reminder-worker] failed to resolve document status', error);
		return null;
	}

	return (data ?? null) as DocumentEligibility | null;
}

async function getManagementRecipients(
	admin: ReturnType<typeof createAdminClient>,
	organizationId: string,
) {
	const { data: memberships, error } = await admin
		.from('organization_memberships')
		.select('user_id, roles!inner(name)')
		.eq('organization_id', organizationId)
		.is('deleted_at', null)
		.eq('status', 'active');

	if (error) {
		console.error('[reminder-worker] failed to resolve managers', error);
		return [];
	}

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

	const { data: profiles, error: profileError } = await admin
		.from('profiles')
		.select('id, full_name, email')
		.in('id', userIds);

	if (profileError) {
		console.error('[reminder-worker] failed to resolve manager profiles', profileError);
		return [];
	}

	return ((profiles ?? []) as ManagementRecipient[]).map((profile) => ({
		email: profile.email,
		full_name: profile.full_name,
	}));
}

async function buildTemplateContext(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
) {
	const payload = job.payload;
	const organizationSlug = getPayloadString(payload.organization_slug);
	const onboardingLink = await getOnboardingLink(admin, job);
	return {
		carer_name: getPayloadString(payload.carer_name),
		document_type: getPayloadString(payload.document_type),
		expiry_date: formatDate(getPayloadString(payload.expiry_date)),
		onboarding_link:
			onboardingLink ||
			`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${organizationSlug}/documents`,
		organization_name: getPayloadString(payload.organization_name) || 'CareComply',
	};
}

async function getOnboardingLink(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
) {
	const { data } = await admin
		.from('organization_invitations')
		.select('token')
		.eq('organization_id', job.organization_id)
		.eq('invite_type', 'carer')
		.eq('carer_id', job.carer_id)
		.eq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!data?.token) return null;
	return getInvitationLink(
		data.token,
		process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
		'carer',
	);
}

async function markRetryable(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
	errorMessage: string,
) {
	const exhausted = job.attempts >= job.max_attempts;
	await admin
		.from('reminder_jobs')
		.update({
			status: exhausted ? 'failed' : 'queued',
			last_error: errorMessage,
			next_attempt_at: new Date(
				Date.now() + retryDelayMs(job.attempts),
			).toISOString(),
			locked_at: null,
			locked_by: null,
			processed_at: exhausted ? new Date().toISOString() : null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.id);

	if (exhausted) {
		await insertLog(admin, job, {
			status: 'failed',
			recipientEmail: job.recipient_email,
			errorMessage,
		});
	}
}

async function markSkipped(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
	errorMessage: string,
) {
	await admin
		.from('reminder_jobs')
		.update({
			status: 'skipped',
			last_error: errorMessage,
			processed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq('id', job.id);

	await insertLog(admin, job, {
		status: 'skipped',
		recipientEmail: job.recipient_email,
		errorMessage,
	});
}

async function insertLog(
	admin: ReturnType<typeof createAdminClient>,
	job: ReminderJob,
	values: {
		status: string;
		recipientEmail?: string | null;
		errorMessage?: string | null;
		providerMessageId?: string | null;
	},
) {
	await admin.from('reminder_logs').insert({
		reminder_id: job.reminder_id,
		reminder_job_id: job.id,
		carer_id: job.carer_id,
		document_id: job.document_id,
		channel: 'email',
		recipient_type: job.recipient_type,
		recipient_email: values.recipientEmail ?? null,
		status: values.status,
		error_message: values.errorMessage ?? null,
		provider_message_id: values.providerMessageId ?? null,
	});
}

function retryDelayMs(attempts: number) {
	const minutes = Math.min(60, Math.max(5, attempts * attempts * 5));
	return minutes * 60 * 1000;
}

function isDocumentStillDue(job: ReminderJob, document: DocumentEligibility) {
	if (!document.expiry_date) return false;

	const triggerType = getPayloadString(job.payload.trigger_type);
	const triggerDaysRaw = job.payload.trigger_days;
	const triggerDays =
		typeof triggerDaysRaw === 'number'
			? triggerDaysRaw
			: Number.parseInt(String(triggerDaysRaw ?? '0'), 10) || 0;
	const expectedDue = new Date(`${document.expiry_date}T00:00:00.000Z`);

	if (triggerType === 'days_before_expiry') {
		expectedDue.setUTCDate(expectedDue.getUTCDate() - triggerDays);
	} else if (triggerType === 'days_after_expiry') {
		expectedDue.setUTCDate(expectedDue.getUTCDate() + triggerDays);
	} else {
		return true;
	}

	return expectedDue.toISOString().slice(0, 10) === job.due_on;
}

function renderTemplate(
	template: string,
	context: Record<string, string>,
) {
	return Object.entries(context).reduce(
		(output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
		template,
	);
}

function toHtml(body: string) {
	return body
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
		.join('');
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function formatDate(value: string) {
	if (!value) return '';
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

function getPayloadString(value: unknown) {
	return typeof value === 'string' ? value : '';
}
