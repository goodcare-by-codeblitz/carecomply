import { processReferenceJobBatch } from '@/lib/reference-worker';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const DEFAULT_BATCH_SIZE = 25;

export async function POST(request: Request) {
	const configuredSecret = process.env.REFERENCE_WORKER_SECRET;
	const authorization = request.headers.get('authorization') ?? '';
	const providedSecret = authorization.startsWith('Bearer ')
		? authorization.slice('Bearer '.length)
		: request.headers.get('x-reference-worker-secret');

	if (!configuredSecret || providedSecret !== configuredSecret) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = createAdminClient();
	const batchSize = await readBatchSize(request);

	try {
		const results = await processReferenceJobBatch(admin, batchSize);
		return NextResponse.json({ ok: true, ...results });
	} catch (error) {
		console.error('[reference-worker] failed to process jobs', error);
		return NextResponse.json(
			{ error: 'Reference jobs could not be processed.' },
			{ status: 500 },
		);
	}
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
