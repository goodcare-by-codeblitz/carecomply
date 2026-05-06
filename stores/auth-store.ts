import { create } from 'zustand';
import { normalize } from '../lib/data-normalizer';
import { NormalizedState, Organization } from '../lib/types';
import { createClient } from '@/lib/supabase/client';

type OrgStore = NormalizedState & {
	isLoaded: boolean;
	setData: (data: Organization[]) => void;
	updateOrganization: (
		orgId: string,
		updates: Partial<NormalizedState['organizations'][string]>,
	) => void;
	getOrganizationsList: () => NormalizedState['organizations'][string][];
	getOrgBySlug: (
		slug: string,
	) => NormalizedState['organizations'][string] | null;
	getCurrentOrgFromSlug: (
		slug: string,
	) => NormalizedState['organizations'][string] | null;
	getMembershipForOrg: (
		orgId: string,
	) => NormalizedState['memberships'][string] | null;
	reset: () => void;
	logout: () => Promise<void>;
};

const initialState: NormalizedState = {
	organizations: {},
	memberships: {},
	roles: {},
	permissions: {},
};

export const useOrgStore = create<OrgStore>((set, get) => ({
	...initialState,
	isLoaded: false,

	setData: (data) => {
		const normalized = normalize(data);

		set({
			...normalized,
			isLoaded: true,
		});
	},

	updateOrganization: (orgId, updates) =>
		set((state) => ({
			organizations: {
				...state.organizations,
				[orgId]: {
					...state.organizations[orgId],
					...updates,
				},
			},
		})),

	getOrganizationsList: () => Object.values(get().organizations),

	getOrgBySlug: (slug) =>
		Object.values(get().organizations).find((org) => org.slug === slug) ??
		null,

	getCurrentOrgFromSlug: (slug) => get().getOrgBySlug(slug),

	getMembershipForOrg: (orgId) =>
		Object.values(get().memberships).find(
			(membership) => membership.organization_id === orgId,
		) ?? null,

	reset: () => set({ ...initialState, isLoaded: false }),

	logout: async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
	},
}));
