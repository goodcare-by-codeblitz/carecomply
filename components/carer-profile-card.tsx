'use client';

import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PersonDetailsInput } from '@/lib/person-profile';
import { MapPin, Pencil, Phone, Siren } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type CarerDetails = {
	id: string;
	phone: string | null;
	address_line1: string | null;
	address_line2: string | null;
	city: string | null;
	county: string | null;
	postcode: string | null;
	emergency_contact_name: string | null;
	emergency_contact_relationship: string | null;
	emergency_contact_phone: string | null;
	emergency_contact_email: string | null;
};

function toForm(carer: CarerDetails): PersonDetailsInput {
	return {
		phone: carer.phone ?? '',
		addressLine1: carer.address_line1 ?? '',
		addressLine2: carer.address_line2 ?? '',
		city: carer.city ?? '',
		county: carer.county ?? '',
		postcode: carer.postcode ?? '',
		emergencyContactName: carer.emergency_contact_name ?? '',
		emergencyContactRelationship: carer.emergency_contact_relationship ?? '',
		emergencyContactPhone: carer.emergency_contact_phone ?? '',
		emergencyContactEmail: carer.emergency_contact_email ?? '',
	};
}

function applyForm(carer: CarerDetails, form: PersonDetailsInput): CarerDetails {
	const clean = (value: string | null | undefined) => value?.trim() || null;
	return {
		...carer,
		phone: clean(form.phone),
		address_line1: clean(form.addressLine1),
		address_line2: clean(form.addressLine2),
		city: clean(form.city),
		county: clean(form.county),
		postcode: clean(form.postcode),
		emergency_contact_name: clean(form.emergencyContactName),
		emergency_contact_relationship: clean(form.emergencyContactRelationship),
		emergency_contact_phone: clean(form.emergencyContactPhone),
		emergency_contact_email: clean(form.emergencyContactEmail),
	};
}

function addressLines(carer: CarerDetails) {
	return [
		carer.address_line1,
		carer.address_line2,
		carer.city,
		carer.county,
		carer.postcode,
	].filter(Boolean);
}

export function CarerProfileCard({ carer }: { carer: CarerDetails }) {
	const [currentCarer, setCurrentCarer] = useState(carer);
	const [form, setForm] = useState<PersonDetailsInput>(toForm(carer));
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const lines = addressLines(currentCarer);

	const updateField = (field: keyof PersonDetailsInput, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const save = async () => {
		setIsSaving(true);
		try {
			const response = await fetch('/api/carers/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ carerId: currentCarer.id, ...form }),
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) {
				throw new Error(payload.error || 'Carer details could not be saved.');
			}
			setCurrentCarer((current) => applyForm(current, form));
			setIsOpen(false);
			toast.success('Carer details updated');
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Carer details could not be saved.',
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Card>
			<CardHeader className='flex flex-row items-start justify-between gap-4'>
				<div>
					<CardTitle className='text-base'>Profile Details</CardTitle>
					<CardDescription>Address and emergency contact details</CardDescription>
				</div>
				<Button type='button' variant='outline' size='sm' onClick={() => setIsOpen(true)}>
					<Pencil className='mr-2 h-4 w-4' />
					Edit
				</Button>
			</CardHeader>
			<CardContent className='grid gap-4 text-sm md:grid-cols-3'>
				<div className='space-y-1'>
					<p className='flex items-center gap-2 font-medium'>
						<Phone className='h-4 w-4 text-muted-foreground' />
						Phone
					</p>
					<p className='text-muted-foreground'>{currentCarer.phone || 'Not provided'}</p>
				</div>
				<div className='space-y-1'>
					<p className='flex items-center gap-2 font-medium'>
						<MapPin className='h-4 w-4 text-muted-foreground' />
						Address
					</p>
					{lines.length ? (
						<div className='text-muted-foreground'>
							{lines.map((line) => (
								<p key={line}>{line}</p>
							))}
						</div>
					) : (
						<p className='text-muted-foreground'>Not provided</p>
					)}
				</div>
				<div className='space-y-1'>
					<p className='flex items-center gap-2 font-medium'>
						<Siren className='h-4 w-4 text-muted-foreground' />
						Emergency contact
					</p>
					{currentCarer.emergency_contact_name ? (
						<div className='text-muted-foreground'>
							<p>{currentCarer.emergency_contact_name}</p>
							{currentCarer.emergency_contact_relationship && (
								<p>{currentCarer.emergency_contact_relationship}</p>
							)}
							{currentCarer.emergency_contact_phone && (
								<p>{currentCarer.emergency_contact_phone}</p>
							)}
							{currentCarer.emergency_contact_email && (
								<p>{currentCarer.emergency_contact_email}</p>
							)}
						</div>
					) : (
						<p className='text-muted-foreground'>Not provided</p>
					)}
				</div>
			</CardContent>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>Edit carer details</DialogTitle>
					</DialogHeader>
					<PersonDetailsForm form={form} onChange={updateField} />
					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => setIsOpen(false)}>
							Cancel
						</Button>
						<Button type='button' disabled={isSaving} onClick={save}>
							{isSaving ? 'Saving...' : 'Save details'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export function PersonDetailsForm({
	form,
	onChange,
}: {
	form: PersonDetailsInput;
	onChange: (field: keyof PersonDetailsInput, value: string) => void;
}) {
	return (
		<div className='grid gap-4 py-2 sm:grid-cols-2'>
			<Field label='Phone' value={form.phone ?? ''} onChange={(value) => onChange('phone', value)} type='tel' />
			<Field label='Address line 1' value={form.addressLine1 ?? ''} onChange={(value) => onChange('addressLine1', value)} />
			<Field label='Address line 2' value={form.addressLine2 ?? ''} onChange={(value) => onChange('addressLine2', value)} />
			<Field label='Town / city' value={form.city ?? ''} onChange={(value) => onChange('city', value)} />
			<Field label='County' value={form.county ?? ''} onChange={(value) => onChange('county', value)} />
			<Field label='Postcode' value={form.postcode ?? ''} onChange={(value) => onChange('postcode', value)} />
			<Field label='Emergency contact name' value={form.emergencyContactName ?? ''} onChange={(value) => onChange('emergencyContactName', value)} />
			<Field label='Emergency relationship' value={form.emergencyContactRelationship ?? ''} onChange={(value) => onChange('emergencyContactRelationship', value)} />
			<Field label='Emergency phone' value={form.emergencyContactPhone ?? ''} onChange={(value) => onChange('emergencyContactPhone', value)} type='tel' />
			<Field label='Emergency email' value={form.emergencyContactEmail ?? ''} onChange={(value) => onChange('emergencyContactEmail', value)} type='email' />
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	type = 'text',
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
}) {
	const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	return (
		<div className='space-y-2'>
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
		</div>
	);
}
