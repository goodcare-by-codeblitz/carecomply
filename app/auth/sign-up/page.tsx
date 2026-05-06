import { Suspense } from 'react';
import { SignUpClient } from './sign-up-client';

export default function Page() {
	return (
		<Suspense fallback={null}>
			<SignUpClient />
		</Suspense>
	);
}
