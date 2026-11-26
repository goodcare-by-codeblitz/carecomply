/* -------------------------------------------------------------------------- */
/*  Header + hero                                                             */
/* -------------------------------------------------------------------------- */

import { expect, test } from '@playwright/test';

const HERO_HEADING = 'Compliance that runs itself, while you run the agency.';

test.describe('Header and hero', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://comply.goodcarepro.co.uk/');
	});

	test('hero heading and intro copy are visible', async ({ page }) => {
		const h1 = page.getByRole('heading', { level: 1 });
		await expect(h1).toBeVisible();
		await expect(h1).toHaveText(HERO_HEADING);
		await expect(
			page.getByText(/operations platform UK domiciliary care agencies use/),
		).toBeVisible();
		await expect(page.getByText(/Reference chasing now runs/)).toBeVisible();
	});

	test('hero CTAs point to sign-up and demo', async ({ page }) => {
		await expect(
			page.getByRole('link', { name: 'Start 14-day free trial' }),
		).toHaveAttribute('href', /\/auth\/sign-up$/);
		await expect(
			page.getByRole('link', { name: 'Book a 25-minute demo' }),
		).toHaveAttribute('href', /\/demo$/);
	});

	test('desktop header nav links have the correct targets', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'Nav collapses on mobile');
		const header = page.locator('header').first();

		const links: Array<[string, RegExp]> = [
			['Product', /\/features$/],
			['Pricing', /\/pricing$/],
			['About', /\/about$/],
			['Contact', /\/contact$/],
			['Sign in', /\/auth\/login$/],
			['Book a demo', /\/demo$/],
			['Start free trial', /\/auth\/sign-up$/],
		];

		for (const [name, href] of links) {
			await expect(
				header.getByRole('link', { name, exact: true }),
				`header link "${name}"`,
			).toHaveAttribute('href', href);
		}
	});

	test('clicking Pricing in the header navigates to /pricing', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'Nav collapses on mobile');
		await page
			.locator('header')
			.first()
			.getByRole('link', { name: 'Pricing', exact: true })
			.click();
		await expect(page).toHaveURL(/\/pricing$/);
	});

	test('clicking the hero trial CTA navigates to sign-up', async ({ page }) => {
		await page.getByRole('link', { name: 'Start 14-day free trial' }).click();
		await expect(page).toHaveURL(/\/auth\/sign-up/);
	});

	test('clicking the hero demo CTA navigates to /demo', async ({ page }) => {
		await page.getByRole('link', { name: 'Book a 25-minute demo' }).click();
		await expect(page).toHaveURL(/\/demo$/);
	});
});

/* -------------------------------------------------------------------------- */
/*  Content sections                                                          */
/* -------------------------------------------------------------------------- */

test.describe('Content sections', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://comply.goodcarepro.co.uk/');
	});

	const sectionHeadings: Array<[string, RegExp]> = [
		['problem / replace', /The spreadsheet stops scaling at 20 carers/],
		['operations layer', /Built around the work compliance teams actually do/],
		['carer lifecycle', /From invite to audit-ready, on autopilot/],
		['ROI', /See what you.d save against your current setup/],
		['customers', /Used by registered managers, not just IT/],
		['security', /Treats carer data like the clinical record/],
		['pricing', /Priced for UK agencies/],
		['faq', /The questions managers ask before they sign/],
		['final CTA', /Run a CQC-ready agency without the spreadsheet tax/],
	];

	for (const [label, name] of sectionHeadings) {
		test(`renders the "${label}" section heading`, async ({ page }) => {
			const heading = page.getByRole('heading', { level: 2, name });
			await heading.scrollIntoViewIfNeeded();
			await expect(heading).toBeVisible();
		});
	}

	test('before/after comparison lists both columns', async ({ page }) => {
		await expect(page.getByText('Today, without CareComply')).toBeVisible();
		await expect(
			page.getByText('With CareComply', { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText(/Carer files scattered across Drive, WhatsApp/),
		).toBeVisible();
		await expect(
			page.getByText(/Tamper-evident CQC export by key question/),
		).toBeVisible();
	});

	test('CQC coverage shows all five key questions', async ({ page }) => {
		const cqc = page
			.locator('section')
			.filter({ hasText: 'CQC evidence coverage' })
			.last();
		await cqc.scrollIntoViewIfNeeded();
		for (const q of ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']) {
			await expect(cqc.getByText(q, { exact: true }).first()).toBeVisible();
		}
	});

	test('testimonials show three named customers', async ({ page }) => {
		for (const name of ['Chiamaka Egwu', 'David Pritchard', 'Saima Iqbal']) {
			await expect(page.getByText(name)).toBeVisible();
		}
	});

	test('security section links to the trust report', async ({ page }) => {
		await expect(
			page.getByRole('link', { name: 'Read the trust report' }),
		).toHaveAttribute('href', /\/security$/);
	});
});
