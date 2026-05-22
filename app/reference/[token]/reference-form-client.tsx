'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';

type ReferenceFormClientProps = {
	token: string;
	reference: {
		refereeName: string;
		refereeEmail: string;
		refereeOrganization: string | null;
		relationship: string;
		referenceType: string;
		status: string;
		expired: boolean;
		carerName: string;
		organizationName: string;
	};
};

export function ReferenceFormClient({ token, reference }: ReferenceFormClientProps) {
	const [relationshipConfirmed, setRelationshipConfirmed] = useState('');
	const [workedWithApplicant, setWorkedWithApplicant] = useState('');
	const [wouldRecommend, setWouldRecommend] = useState('');
	const [reliability, setReliability] = useState('');
	const [safeguardingConcerns, setSafeguardingConcerns] = useState('');
	const [refereeName, setRefereeName] = useState(reference.refereeName);
	const [refereeRole, setRefereeRole] = useState('');
	const [comments, setComments] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(reference.status === 'responded');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const disabled = submitted || reference.expired || ['approved', 'rejected'].includes(reference.status);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			const response = await fetch('/api/references/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token,
					relationshipConfirmed,
					workedWithApplicant,
					wouldRecommend,
					reliability,
					safeguardingConcerns,
					comments: comments || undefined,
					refereeName,
					refereeRole: refereeRole || undefined,
				}),
			});
			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				throw new Error(payload.error || 'Reference could not be submitted.');
			}
			setSubmitted(true);
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Reference could not be submitted.');
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className='min-h-screen bg-background p-6'>
			<div className='mx-auto max-w-2xl'>
				<div className='mb-8'>
					<h1 className='text-2xl font-semibold tracking-tight'>CareComply reference</h1>
					<p className='mt-2 text-sm text-muted-foreground'>
						{reference.organizationName} has requested a {reference.referenceType} reference for {reference.carerName}.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Reference for {reference.carerName}</CardTitle>
						<CardDescription>
							Requested from {reference.refereeName} ({reference.refereeEmail})
						</CardDescription>
					</CardHeader>
					<CardContent>
						{reference.expired && (
							<p className='rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
								This reference link has expired. Please ask the care provider to resend it.
							</p>
						)}
						{submitted && (
							<div className='rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900'>
								<div className='flex items-center gap-2 font-medium'>
									<CheckCircle className='h-4 w-4' />
									Reference submitted
								</div>
								<p className='mt-1'>Thank you. The care provider has been notified.</p>
							</div>
						)}
						{!submitted && !reference.expired && (
							<form onSubmit={submit} className='space-y-5'>
								<div className='grid gap-4 sm:grid-cols-2'>
									<div className='space-y-2'>
										<Label htmlFor='referee-name'>Your name</Label>
										<Input id='referee-name' value={refereeName} onChange={(event) => setRefereeName(event.target.value)} required disabled={disabled} />
									</div>
									<div className='space-y-2'>
										<Label htmlFor='referee-role'>Your role</Label>
										<Input id='referee-role' value={refereeRole} onChange={(event) => setRefereeRole(event.target.value)} disabled={disabled} />
									</div>
								</div>

								<SelectField label='Can you confirm this relationship?' value={relationshipConfirmed} onChange={setRelationshipConfirmed} disabled={disabled} options={[['yes', 'Yes'], ['no', 'No']]} />
								<SelectField label={`Have you worked with ${reference.carerName}?`} value={workedWithApplicant} onChange={setWorkedWithApplicant} disabled={disabled} options={[['yes', 'Yes'], ['no', 'No']]} />
								<SelectField label='Would you recommend this person for care work?' value={wouldRecommend} onChange={setWouldRecommend} disabled={disabled} options={[['yes', 'Yes'], ['with_reservations', 'With reservations'], ['no', 'No']]} />
								<SelectField label='Reliability' value={reliability} onChange={setReliability} disabled={disabled} options={[['excellent', 'Excellent'], ['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor'], ['not_applicable', 'Not applicable']]} />
								<SelectField label='Any safeguarding concerns?' value={safeguardingConcerns} onChange={setSafeguardingConcerns} disabled={disabled} options={[['no', 'No'], ['yes', 'Yes']]} />

								<div className='space-y-2'>
									<Label htmlFor='comments'>Comments</Label>
									<Textarea id='comments' value={comments} onChange={(event) => setComments(event.target.value)} rows={5} disabled={disabled} />
								</div>

								{error && <p className='text-sm text-destructive'>{error}</p>}
								<Button type='submit' disabled={disabled || isSubmitting}>
									{isSubmitting ? 'Submitting...' : 'Submit reference'}
								</Button>
							</form>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}

function SelectField({
	label,
	value,
	onChange,
	options,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: Array<[string, string]>;
	disabled: boolean;
}) {
	return (
		<div className='space-y-2'>
			<Label>{label}</Label>
			<Select value={value} onValueChange={onChange} disabled={disabled} required>
				<SelectTrigger className='w-full'>
					<SelectValue placeholder='Select an answer' />
				</SelectTrigger>
				<SelectContent>
					{options.map(([optionValue, optionLabel]) => (
						<SelectItem key={optionValue} value={optionValue}>
							{optionLabel}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
