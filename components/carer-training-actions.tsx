'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export type TrainingRequirementForActions = {
	id: string;
	name: string;
	description: string | null;
	is_required: boolean;
	is_active: boolean;
	validity_months: number | null;
};

export type TrainingRecordForActions = {
	id: string;
	training_requirement_id: string;
	status: string;
	observed_at: string | null;
	observed_notes: string | null;
	expiry_date: string | null;
};

type Props = {
	carerId: string;
	requirements: TrainingRequirementForActions[];
	records: TrainingRecordForActions[];
};

function addMonths(dateValue: string, months: number | null) {
	if (!dateValue || !months) return '';
	const date = new Date(`${dateValue}T00:00:00`);
	date.setMonth(date.getMonth() + months);
	return date.toISOString().slice(0, 10);
}

function isUnexpired(value: string | null) {
	if (!value) return true;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const date = new Date(value);
	date.setHours(0, 0, 0, 0);
	return date >= today;
}

export function CarerTrainingActions({ carerId, requirements, records }: Props) {
	const initialRecords = useMemo(
		() =>
			records.reduce<Record<string, TrainingRecordForActions>>((map, record) => {
				map[record.training_requirement_id] = record;
				return map;
			}, {}),
		[records],
	);
	const [recordByRequirement, setRecordByRequirement] = useState(initialRecords);
	const [forms, setForms] = useState<Record<string, { observedAt: string; expiryDate: string; notes: string }>>(() =>
		requirements.reduce<Record<string, { observedAt: string; expiryDate: string; notes: string }>>(
			(map, requirement) => {
				const record = initialRecords[requirement.id];
				const today = new Date().toISOString().slice(0, 10);
				const observedAt = record?.observed_at ?? today;
				map[requirement.id] = {
					observedAt,
					expiryDate: record?.expiry_date ?? addMonths(observedAt, requirement.validity_months),
					notes: record?.observed_notes ?? '',
				};
				return map;
			},
			{},
		),
	);
	const [savingId, setSavingId] = useState<string | null>(null);

	const updateForm = (
		requirement: TrainingRequirementForActions,
		field: 'observedAt' | 'expiryDate' | 'notes',
		value: string,
	) => {
		setForms((current) => {
			const next = {
				...(current[requirement.id] ?? {
					observedAt: '',
					expiryDate: '',
					notes: '',
				}),
				[field]: value,
			};

			if (field === 'observedAt') {
				next.expiryDate = addMonths(value, requirement.validity_months);
			}

			return { ...current, [requirement.id]: next };
		});
	};

	const saveRecord = async (requirement: TrainingRequirementForActions) => {
		const form = forms[requirement.id];
		if (!form?.observedAt) {
			toast.error('Observed date is required');
			return;
		}

		setSavingId(requirement.id);
		try {
			const response = await fetch('/api/carers/training', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					carerId,
					trainingRequirementId: requirement.id,
					status: 'completed',
					observedAt: form.observedAt,
					expiryDate: form.expiryDate || null,
					observedNotes: form.notes || null,
				}),
			});
			const payload = (await response.json()) as {
				trainingRecord?: TrainingRecordForActions;
				error?: string;
			};

			if (!response.ok || !payload.trainingRecord) {
				throw new Error(payload.error || 'Training could not be saved');
			}

			setRecordByRequirement((current) => ({
				...current,
				[requirement.id]: payload.trainingRecord!,
			}));
			toast.success('Training recorded');
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Training could not be saved',
			);
		} finally {
			setSavingId(null);
		}
	};

	if (requirements.length === 0) {
		return (
			<div className='py-8 text-center text-[13px] text-slate-500'>
				No onsite training requirements configured.
			</div>
		);
	}

	return (
		<div className='space-y-3'>
			{requirements.map((requirement) => {
				const record = recordByRequirement[requirement.id];
				const form = forms[requirement.id] ?? {
					observedAt: '',
					expiryDate: '',
					notes: '',
				};
				const complete =
					record?.status === 'completed' && isUnexpired(record.expiry_date);
				const expired =
					record?.status === 'completed' && !isUnexpired(record.expiry_date);

				return (
					<div key={requirement.id} className='rounded-xl border border-line p-4'>
						<div className='flex flex-wrap items-center justify-between gap-3'>
							<div>
								<p className='text-[13.5px] font-medium text-ink'>
									{requirement.name}
									{requirement.is_required && (
										<span className='ml-1 text-danger'>*</span>
									)}
								</p>
								{requirement.description && (
									<p className='mt-1 text-[12.5px] text-slate-500'>
										{requirement.description}
									</p>
								)}
							</div>
							<span
								className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
									expired
										? 'bg-danger-50 text-danger'
										: complete
											? 'bg-ok-50 text-ok'
											: 'bg-surface-muted text-slate-600'
								}`}>
								{expired ? 'Expired' : complete ? 'Completed' : 'Not completed'}
							</span>
						</div>
						<div className='mt-4 grid gap-3 md:grid-cols-2'>
							<div className='space-y-1.5'>
								<Label className='text-[12.5px] text-slate-600'>
									Observed date
								</Label>
								<Input
									type='date'
									value={form.observedAt}
									onChange={(event) =>
										updateForm(requirement, 'observedAt', event.target.value)
									}
									className='text-[13.5px]'
								/>
							</div>
							<div className='space-y-1.5'>
								<Label className='text-[12.5px] text-slate-600'>
									Expiry date
								</Label>
								<Input
									type='date'
									value={form.expiryDate}
									onChange={(event) =>
										updateForm(requirement, 'expiryDate', event.target.value)
									}
									className='text-[13.5px]'
								/>
							</div>
							<div className='space-y-1.5 md:col-span-2'>
								<Label className='text-[12.5px] text-slate-600'>
									Observed notes
								</Label>
								<Textarea
									value={form.notes}
									onChange={(event) =>
										updateForm(requirement, 'notes', event.target.value)
									}
									rows={2}
									className='text-[13.5px]'
									placeholder='What was observed or signed off?'
								/>
							</div>
						</div>
						<div className='mt-3 flex justify-end'>
							<Button
								type='button'
								size='sm'
								disabled={savingId === requirement.id}
								onClick={() => saveRecord(requirement)}>
								{savingId === requirement.id && (
									<Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
								)}
								Mark completed
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
