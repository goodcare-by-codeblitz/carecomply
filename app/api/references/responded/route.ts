import { NextResponse } from 'next/server';

export async function POST() {
	return NextResponse.json(
		{
			error:
				'The n8n reference webhook has been replaced. Referees should submit references through /reference/[token].',
		},
		{ status: 410 },
	);
}
