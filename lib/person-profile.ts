import { z } from 'zod';

export const phoneSchema = z
	.string()
	.trim()
	.optional()
	.refine((value) => !value || /^[\d\s+()-]+$/.test(value), {
		message: 'Invalid phone number',
	});

export const optionalEmailSchema = z
	.string()
	.trim()
	.optional()
	.refine((value) => !value || z.string().email().safeParse(value).success, {
		message: 'Invalid email address',
	});

export const personDetailsBaseSchema = z.object({
	phone: phoneSchema,
	addressLine1: z.string().trim().optional(),
	addressLine2: z.string().trim().optional(),
	city: z.string().trim().optional(),
	county: z.string().trim().optional(),
	postcode: z.string().trim().optional(),
	emergencyContactName: z.string().trim().optional(),
	emergencyContactRelationship: z.string().trim().optional(),
	emergencyContactPhone: phoneSchema,
	emergencyContactEmail: optionalEmailSchema,
});

export const personDetailsSchema = personDetailsBaseSchema
	.refine(
		(data) =>
			!data.emergencyContactName ||
			Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
		{
			message: 'Emergency contact phone or email is required.',
			path: ['emergencyContactPhone'],
		},
	);

export const teamMemberDetailsBaseSchema = personDetailsBaseSchema.extend({
	jobTitle: z.string().trim().optional(),
	department: z.string().trim().optional(),
});

export const teamMemberDetailsSchema = teamMemberDetailsBaseSchema.refine(
	(data) =>
		!data.emergencyContactName ||
		Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
	{
		message: 'Emergency contact phone or email is required.',
		path: ['emergencyContactPhone'],
	},
);

export type PersonDetailsInput = z.infer<typeof personDetailsSchema>;
export type TeamMemberDetailsInput = z.infer<typeof teamMemberDetailsSchema>;

export function emptyToNull(value: string | null | undefined) {
	const trimmed = value?.trim() ?? '';
	return trimmed ? trimmed : null;
}

export function personDetailsToRow(data: PersonDetailsInput) {
	return {
		phone: emptyToNull(data.phone),
		address_line1: emptyToNull(data.addressLine1),
		address_line2: emptyToNull(data.addressLine2),
		city: emptyToNull(data.city),
		county: emptyToNull(data.county),
		postcode: emptyToNull(data.postcode),
		emergency_contact_name: emptyToNull(data.emergencyContactName),
		emergency_contact_relationship: emptyToNull(
			data.emergencyContactRelationship,
		),
		emergency_contact_phone: emptyToNull(data.emergencyContactPhone),
		emergency_contact_email: emptyToNull(data.emergencyContactEmail),
	};
}

export function teamDetailsToRow(data: TeamMemberDetailsInput) {
	return {
		...personDetailsToRow(data),
		job_title: emptyToNull(data.jobTitle),
		department: emptyToNull(data.department),
	};
}
