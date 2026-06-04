import { describe, expect, it } from 'vitest';
import { getPostLoginRedirect } from './login-redirect';
import type { UserOrganization } from './orgs';

const org = (id: string, slug: string): UserOrganization => ({
	id,
	name: slug,
	slug,
});

describe('getPostLoginRedirect', () => {
	it('sends an existing multi-org user to pending organization creation', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: null,
				pendingCreateOrgRedirect:
					'/create-org?orgName=Linden+Domiciliary&orgSlug=linden&plan=pro&interval=yearly',
				platformAccess: null,
				organizations: [org('1', 'first'), org('2', 'second')],
			}),
		).toBe(
			'/create-org?orgName=Linden+Domiciliary&orgSlug=linden&plan=pro&interval=yearly',
		);
	});

	it('sends an existing single-org user to pending organization creation', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: null,
				pendingCreateOrgRedirect: '/create-org?orgName=Linden&orgSlug=linden',
				platformAccess: null,
				organizations: [org('1', 'first')],
			}),
		).toBe('/create-org?orgName=Linden&orgSlug=linden');
	});

	it('keeps normal multi-org login on organization selection', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: null,
				pendingCreateOrgRedirect: null,
				platformAccess: null,
				organizations: [org('1', 'first'), org('2', 'second')],
			}),
		).toBe('/select-org');
	});

	it('prefers invitation redirects over pending organization creation', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: '/invite/invite-token',
				pendingCreateOrgRedirect: '/create-org?orgName=Linden',
				platformAccess: { role: null, canAccessAdmin: false },
				organizations: [org('1', 'first'), org('2', 'second')],
			}),
		).toBe('/invite/invite-token');
	});

	it('sends platform admins to admin when there is no create-org continuation', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: null,
				pendingCreateOrgRedirect: null,
				platformAccess: { role: 'platform_admin', canAccessAdmin: true },
				organizations: [],
			}),
		).toBe('/admin/reminders');
	});

	it('prefers pending organization creation over platform admin redirect', () => {
		expect(
			getPostLoginRedirect({
				inviteRedirect: null,
				pendingCreateOrgRedirect: '/create-org?orgName=Linden',
				platformAccess: { role: 'platform_admin', canAccessAdmin: true },
				organizations: [],
			}),
		).toBe('/create-org?orgName=Linden');
	});
});
