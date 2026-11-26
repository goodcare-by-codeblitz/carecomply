import { expect, test } from '@playwright/test';

test('test', async ({ page }) => {
	await page.goto('https://comply.goodcarepro.co.uk/');
	await page.getByRole('link', { name: 'Sign in' }).click();
	await page.getByRole('textbox', { name: 'Work email*' }).click();
	await page
		.getByRole('textbox', { name: 'Work email*' })
		.fill('simbarashemapisa66@gmail.com');
	await expect(page.getByRole('textbox', { name: 'Work email*' })).toHaveValue(
		'simbarashemapisa66@gmail.com',
	);
	await page.getByRole('textbox', { name: 'Work email*' }).press('Tab');
	await page.getByRole('link', { name: 'Forgot password?' }).press('Tab');
	await page
		.getByRole('textbox', { name: 'Password* Forgot password?' })
		.fill('azrielMapisa22');
	await page.getByRole('button', { name: 'Sign in' }).click();
});
