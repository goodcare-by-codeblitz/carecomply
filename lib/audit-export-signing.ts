import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type AuditExportManifest = {
	exportId: string;
	organizationId: string;
	organizationSlug: string;
	format: 'csv' | 'xlsx';
	generatedAt: string;
	rowCount: number;
	filters: Record<string, string>;
	rowsHash: string;
};

export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	}

	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
			.join(',')}}`;
	}

	return JSON.stringify(value);
}

export function sha256Hex(value: Buffer | string) {
	return createHash('sha256').update(value).digest('hex');
}

export function createManifestHash(manifest: AuditExportManifest) {
	return sha256Hex(canonicalJson(manifest));
}

export function signManifest(secret: string, manifestHash: string) {
	return createHmac('sha256', secret).update(manifestHash).digest('hex');
}

export function verifyManifestSignature(
	secret: string,
	manifestHash: string,
	signature: string,
) {
	const expected = signManifest(secret, manifestHash);
	const expectedBuffer = Buffer.from(expected, 'hex');
	const actualBuffer = Buffer.from(signature, 'hex');

	return (
		expectedBuffer.length === actualBuffer.length &&
		timingSafeEqual(expectedBuffer, actualBuffer)
	);
}

export function encodeManifest(manifest: AuditExportManifest) {
	return Buffer.from(canonicalJson(manifest), 'utf8').toString('base64url');
}

export function decodeManifest(value: string): AuditExportManifest {
	return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
