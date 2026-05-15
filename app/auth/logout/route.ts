import { createAuthAuditEvent } from '@/lib/audit-server';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		await createAuthAuditEvent({
			email: user.email ?? null,
			userId: user.id,
			outcome: 'logout',
			request,
		});
	}

	await supabase.auth.signOut();

	const response = NextResponse.json({ ok: true });
	response.cookies.delete('current_org_slug');

	return response;
}

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		await createAuthAuditEvent({
			email: user.email ?? null,
			userId: user.id,
			outcome: 'logout',
			request,
		});
	}

	await supabase.auth.signOut();

	const response = NextResponse.redirect(new URL('/auth/login', request.url));
	response.cookies.delete('current_org_slug');

	return response;
}
