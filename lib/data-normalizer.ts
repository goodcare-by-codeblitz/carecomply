import { NormalizedState, Organization } from './types';

export function normalize(data: Organization[]): NormalizedState {
	const state: NormalizedState = {
		organizations: {},
		memberships: {},
		roles: {},
		permissions: {},
	};

	for (const org of data) {
		state.organizations[org.id] = {
			id: org.id,
			name: org.name,
			slug: org.slug,
			logo_url: org.logo_url ?? null,
			logo_path: org.logo_path ?? null,
			required_work_references_count: org.required_work_references_count ?? null,
			required_character_references_count: org.required_character_references_count ?? null,
		};

		for (const m of org.organization_memberships ?? []) {
			const membershipId = `${m.user_id}_${m.organization_id}`;

			const role = m.roles ?? null;

			state.memberships[membershipId] = {
				user_id: m.user_id,
				organization_id: m.organization_id,
				role_id: role?.id ?? null,
			};

			if (role) {
				// store role
				state.roles[role.id] = {
					...role,
					role_permissions: role.role_permissions ?? [],
				};

				// extract permissions
				for (const rp of role.role_permissions ?? []) {
					const p = rp.permissions;
					if (p) {
						state.permissions[p.id] = p;
					}
				}
			}
		}
	}

	return state;
}
