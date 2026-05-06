import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type InvitationDetailsRow = {
	id: string;
	invite_type: 'team_member' | 'carer';
	email: string;
	status: 'pending' | 'accepted' | 'revoked' | 'expired';
	expires_at: string | null;
	organizations: { name: string; slug: string } | { name: string; slug: string }[] | null;
	roles: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const token = searchParams.get('token');

	if (!token) {
		return NextResponse.json(
			{ error: 'Invitation token is required.' },
			{ status: 400 },
		);
	}

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from('organization_invitations')
		.select(
			'id, invite_type, email, status, expires_at, organizations(name, slug), roles(name)',
		)
		.eq('token', token)
		.maybeSingle();

	if (error || !data) {
		return NextResponse.json(
			{ error: 'Invitation was not found.' },
			{ status: 404 },
		);
	}

	const invite = data as InvitationDetailsRow;
	const organization = normalizeRelation(invite.organizations);
	const role = normalizeRelation(invite.roles);

	return NextResponse.json({
		id: invite.id,
		invite_type: invite.invite_type,
		email: invite.email,
		status: invite.status,
		expires_at: invite.expires_at,
		organization: organization
			? { name: organization.name, slug: organization.slug }
			: null,
		role: role ? { name: role.name } : null,
	});
}
