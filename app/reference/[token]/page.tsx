import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ReferenceFormClient } from './reference-form-client';

type ReferencePageProps = {
	params: Promise<{ token: string }>;
};

type ReferenceForForm = {
	id: string;
	full_name: string;
	email: string;
	organization: string | null;
	relationship: string;
	reference_type: string;
	status: string;
	token_expires_at: string | null;
	carers:
		| {
				full_name: string;
				organizations: { name: string } | { name: string }[] | null;
		  }
		| {
				full_name: string;
				organizations: { name: string } | { name: string }[] | null;
		  }[]
		| null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function ReferenceContent({ params }: ReferencePageProps) {
	await connection();
	const { token } = await params;
	const admin = createAdminClient();
	const { data } = await admin
		.from('carer_references')
		.select('id, full_name, email, organization, relationship, reference_type, status, token_expires_at, carers!inner(full_name, organizations(name))')
		.eq('reference_token', token)
		.maybeSingle();

	if (!data) notFound();

	const reference = data as ReferenceForForm;
	const carer = normalizeRelation(reference.carers);
	const organization = normalizeRelation(carer?.organizations);
	if (!carer) notFound();

	const expired = reference.token_expires_at
		? new Date(reference.token_expires_at) < new Date()
		: false;

	return (
		<ReferenceFormClient
			token={token}
			reference={{
				refereeName: reference.full_name,
				refereeEmail: reference.email,
				refereeOrganization: reference.organization,
				relationship: reference.relationship,
				referenceType: reference.reference_type,
				status: reference.status,
				expired,
				carerName: carer.full_name,
				organizationName: organization?.name ?? 'CareComply',
			}}
		/>
	);
}

export default function ReferencePage({ params }: ReferencePageProps) {
	return (
		<Suspense fallback={<main className='min-h-screen bg-background' />}>
			<ReferenceContent params={params} />
		</Suspense>
	);
}
