import { z } from 'zod';
import { personDetailsBaseSchema } from './person-profile';

// Auth schemas
export const loginSchema = z.object({
	email: z.email('Please enter a valid email address'),
	password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z
	.object({
		fullName: z.string().min(2, 'Name must be at least 2 characters'),
		email: z.email('Please enter a valid email address'),
		password: z.string().min(8, 'Password must be at least 8 characters'),
		confirmPassword: z.string(),
		organizationName: z
			.string()
			.min(2, 'Organization name must be at least 2 characters'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ['confirmPassword'],
	});

// Carer schemas
export const newCarerSchema = z.object({
	fullName: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.email('Please enter a valid email address'),
	...personDetailsBaseSchema.shape,
}).refine(
	(data) =>
		!data.emergencyContactName ||
		Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
	{
		message: 'Emergency contact phone or email is required.',
		path: ['emergencyContactPhone'],
	},
);

// Document upload schema
export const documentUploadSchema = z.object({
	documentTypeId: z.uuid('Please select a document type'),
	expiryDate: z
		.string()
		.optional()
		.refine(
			(val) => !val || !isNaN(Date.parse(val)),
			'Please enter a valid date',
		),
});

// Onboarding form schema (for carers submitting their own documents)
export const onboardingDocumentSchema = z.object({
	documentTypeId: z.uuid('Please select a document type'),
	expiryDate: z.string().optional(),
});

// Settings schemas
export const profileSettingsSchema = z.object({
	fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

export const organizationSettingsSchema = z.object({
	name: z.string().min(2, 'Organization name must be at least 2 characters'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type NewCarerInput = z.infer<typeof newCarerSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type OnboardingDocumentInput = z.infer<typeof onboardingDocumentSchema>;
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
export type OrganizationSettingsInput = z.infer<
	typeof organizationSettingsSchema
>;
