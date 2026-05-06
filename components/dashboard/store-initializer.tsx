'use client';

import { initOrgStore } from '@/lib/init-org';
import { initProfile } from '@/lib/init-profile';
import { useEffect } from 'react';

export function DashboardStoreInitializer() {
	useEffect(() => {
		initOrgStore();
		initProfile();
	}, []);

	return null;
}
