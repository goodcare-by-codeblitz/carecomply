import { InviteClient } from './invite-client';
import { Suspense } from 'react';

export default function InvitePage() {
	return (
		<Suspense fallback={null}>
			<InviteClient />
		</Suspense>
	);
}
