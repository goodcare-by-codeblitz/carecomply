import { render, type Options } from '@react-email/render';
import { createElement, type ComponentType } from 'react';

export async function renderEmailTemplate<Props extends object>(
	Template: ComponentType<Props>,
	props: Props,
	options?: Options,
) {
	const html = await render(createElement(Template, props), options);

	if (!html.trim()) {
		const templateName = Template.displayName ?? Template.name ?? 'UnknownEmailTemplate';
		throw new Error(`${templateName} rendered empty email HTML.`);
	}

	return html;
}
