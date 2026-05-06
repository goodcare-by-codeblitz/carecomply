'use client';

import { useEffect, useState } from 'react';
import { validateOrganizationSlug } from '@/lib/slug';

type SlugAvailabilityStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export type SlugAvailability = {
	status: SlugAvailabilityStatus;
	message: string | null;
	suggestions: string[];
	available: boolean;
};

const INITIAL_STATE: SlugAvailability = {
	status: 'idle',
	message: null,
	suggestions: [],
	available: false,
};

export function useSlugAvailability(slug: string) {
	const [state, setState] = useState<SlugAvailability>(INITIAL_STATE);

	useEffect(() => {
		if (!slug) {
			setState(INITIAL_STATE);
			return;
		}

		const validationMessage = validateOrganizationSlug(slug);
		if (validationMessage) {
			setState({
				status: 'invalid',
				message: validationMessage,
				suggestions: [],
				available: false,
			});
			return;
		}

		const controller = new AbortController();
		const timeout = window.setTimeout(async () => {
			setState((current) => ({
				...current,
				status: 'checking',
				message: 'Checking availability...',
				available: false,
			}));

			try {
				const response = await fetch(
					`/api/organizations/slug-availability?slug=${encodeURIComponent(slug)}`,
					{ signal: controller.signal },
				);
				const data = (await response.json()) as {
					available?: boolean;
					suggestions?: string[];
				};

				if (!response.ok) {
					throw new Error('Unable to check slug availability.');
				}

				setState({
					status: data.available ? 'available' : 'taken',
					message: data.available
						? 'This slug is available.'
						: 'That slug is already taken.',
					suggestions: data.suggestions ?? [],
					available: Boolean(data.available),
				});
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;

				setState({
					status: 'error',
					message: 'Unable to check availability right now.',
					suggestions: [],
					available: false,
				});
			}
		}, 350);

		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [slug]);

	return state;
}
