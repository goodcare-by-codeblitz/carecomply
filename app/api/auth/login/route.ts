import { createAuthAuditEvent } from '@/lib/audit-server';
import { getUserOrganizationsResult } from '@/lib/orgs';
import {
	bootstrapPlatformSuperAdmin,
	getPlatformAccessForUser,
} from '@/lib/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const loginSchema = z.object({
	email: z.string().trim().email(),
	password: z.string().min(1),
});

export async function POST(request: Request) {
	const payload = loginSchema.safeParse(await request.json().catch(() => null));

	if (!payload.success) {
		return NextResponse.json(
			{ error: 'Enter a valid email and password.' },
			{ status: 400 },
		);
	}

	const email = payload.data.email.toLowerCase();
	await bootstrapPlatformSuperAdmin(email);

	await createAuthAuditEvent({
		email,
		outcome: 'attempted',
		request,
	});

	const supabase = await createClient();
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password: payload.data.password,
	});

	if (error || !data.user) {
		await createAuthAuditEvent({
			email,
			outcome: 'failure',
			failureReason: error?.message ?? 'Login failed',
			request,
		});

		return NextResponse.json(
			{ error: 'Email or password is incorrect.' },
			{ status: 401 },
		);
	}

	await createAuthAuditEvent({
		email: data.user.email ?? email,
		userId: data.user.id,
		outcome: 'success',
		request,
	});

	const organizationsResult = await getUserOrganizationsResult(supabase, data.user.id);

	if (!organizationsResult.ok) {
		return NextResponse.json(
			{ error: 'Your organizations could not be loaded. Please try again in a moment.' },
			{ status: 500 },
		);
	}

	const admin = createAdminClient();
	const platformAccess = await getPlatformAccessForUser(admin, data.user.id);

	return NextResponse.json({
		user: {
			id: data.user.id,
			email: data.user.email,
		},
		organizations: organizationsResult.organizations,
		platformAccess,
	});
}
