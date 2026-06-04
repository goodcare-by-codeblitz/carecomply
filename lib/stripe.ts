import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe() {
	const secretKey = process.env.STRIPE_SECRET_KEY;

	if (!secretKey) {
		throw new Error('STRIPE_SECRET_KEY is not configured.');
	}

	stripe ??= new Stripe(secretKey, { apiVersion: '2025-03-31.basil' });
	return stripe;
}
