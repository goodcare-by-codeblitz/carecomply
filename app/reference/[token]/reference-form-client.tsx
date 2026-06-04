'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type FormData = {
	// S1: Referee Verification
	refereeName: string;
	refereeJobTitle: string;
	refereeOrganization: string;
	refereeWorkEmail: string;
	refereeWorkPhone: string;
	relationshipToApplicant: string;
	howLongKnown: string;
	datesWorkedTogether: string;
	// S2: Employment Verification
	confirmedEmployment: string;
	jobTitleHeld: string;
	employmentStartDate: string;
	currentlyEmployed: string;
	employmentEndDate: string;
	reasonForLeaving: string;
	employmentType: string;
	// S3: Performance Ratings
	ratings: Record<string, string>;
	// S4: Care Competency
	competency: Record<string, string>;
	// S5: Safeguarding & Conduct
	safeguardingConcerns: string;
	disciplinaryActions: string;
	conductConcerns: Record<string, boolean>;
	conductDetails: string;
	// S6: Rehire Recommendation
	wouldReemploy: string;
	reemployReservations: string;
	// S7: Overall Recommendation
	overallRecommendation: string;
	// S8: Additional Comments
	additionalComments: string;
	// S9: Declaration
	declarationAgreed: boolean;
	signatureName: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

const STEP_LABELS = [
	'Referee Details',
	'Employment',
	'Performance',
	'Competency',
	'Safeguarding',
	'Rehire',
	'Recommendation',
	'Comments',
	'Declaration',
];

const RATINGS = [
	{ value: 'excellent', label: 'Excellent' },
	{ value: 'good', label: 'Good' },
	{ value: 'satisfactory', label: 'Satisfactory' },
	{ value: 'needs_improvement', label: 'Needs Improvement' },
	{ value: 'unable_to_comment', label: 'N/A' },
] as const;

const RATING_SKILLS = [
	{ key: 'reliability', label: 'Reliability' },
	{ key: 'timekeeping', label: 'Timekeeping' },
	{ key: 'attendance', label: 'Attendance' },
	{ key: 'communication_skills', label: 'Communication Skills' },
	{ key: 'teamwork', label: 'Teamwork' },
	{ key: 'professionalism', label: 'Professionalism' },
	{ key: 'compassion', label: 'Compassion' },
	{ key: 'respect_for_service_users', label: 'Respect for Service Users' },
	{ key: 'record_keeping', label: 'Record Keeping' },
	{ key: 'following_policies', label: 'Following Policies & Procedures' },
];

const COMPETENCY_QUESTIONS = [
	{ key: 'worked_independently', label: 'Was the applicant able to work independently?' },
	{ key: 'followed_care_plans', label: 'Did they follow care plans appropriately?' },
	{ key: 'maintained_boundaries', label: 'Did they maintain professional boundaries?' },
	{ key: 'person_centred', label: 'Were they respectful and person-centred?' },
	{ key: 'reporting_concerns', label: 'Were they competent in reporting concerns?' },
	{
		key: 'trust_vulnerable',
		label: 'Would you trust them caring for a vulnerable adult or child?',
	},
];

const CONDUCT_CONCERNS = [
	{ key: 'abuse', label: 'Abuse' },
	{ key: 'neglect', label: 'Neglect' },
	{ key: 'fraud', label: 'Fraud' },
	{ key: 'medication_errors', label: 'Medication Errors' },
	{ key: 'professional_misconduct', label: 'Professional Misconduct' },
	{ key: 'violence_or_aggression', label: 'Violence or Aggression' },
	{ key: 'breach_of_confidentiality', label: 'Breach of Confidentiality' },
];

const RELATIONSHIP_OPTIONS = [
	{ value: 'line_manager', label: 'Line Manager' },
	{ value: 'supervisor', label: 'Supervisor' },
	{ value: 'registered_manager', label: 'Registered Manager' },
	{ value: 'team_leader', label: 'Team Leader' },
	{ value: 'colleague', label: 'Colleague' },
	{ value: 'other', label: 'Other' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
	{ value: 'permanent', label: 'Permanent' },
	{ value: 'temporary', label: 'Temporary' },
	{ value: 'agency', label: 'Agency' },
	{ value: 'bank_staff', label: 'Bank Staff' },
];

const RECOMMENDATION_OPTIONS = [
	{
		value: 'strongly_recommend',
		label: 'Strongly Recommend',
		desc: 'I would hire this person without hesitation',
		danger: false,
	},
	{
		value: 'recommend',
		label: 'Recommend',
		desc: 'I am happy to recommend this person for care work',
		danger: false,
	},
	{
		value: 'recommend_with_reservations',
		label: 'Recommend with Reservations',
		desc: 'I have some concerns but overall would recommend',
		danger: false,
	},
	{
		value: 'do_not_recommend',
		label: 'Do Not Recommend',
		desc: 'I cannot recommend this person for care work',
		danger: true,
	},
];

function makeInitialForm(
	refereeName: string,
	refereeEmail: string,
	refereeOrg: string | null,
): FormData {
	return {
		refereeName,
		refereeJobTitle: '',
		refereeOrganization: refereeOrg ?? '',
		refereeWorkEmail: refereeEmail,
		refereeWorkPhone: '',
		relationshipToApplicant: '',
		howLongKnown: '',
		datesWorkedTogether: '',
		confirmedEmployment: '',
		jobTitleHeld: '',
		employmentStartDate: '',
		currentlyEmployed: '',
		employmentEndDate: '',
		reasonForLeaving: '',
		employmentType: '',
		ratings: Object.fromEntries(RATING_SKILLS.map((s) => [s.key, ''])),
		competency: Object.fromEntries(COMPETENCY_QUESTIONS.map((q) => [q.key, ''])),
		safeguardingConcerns: '',
		disciplinaryActions: '',
		conductConcerns: Object.fromEntries(CONDUCT_CONCERNS.map((c) => [c.key, false])),
		conductDetails: '',
		wouldReemploy: '',
		reemployReservations: '',
		overallRecommendation: '',
		additionalComments: '',
		declarationAgreed: false,
		signatureName: '',
	};
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validateStep(step: number, form: FormData): string | null {
	switch (step) {
		case 1:
			if (!form.refereeName.trim()) return 'Please enter your full name.';
			if (!form.refereeJobTitle.trim()) return 'Please enter your job title.';
			if (!form.refereeOrganization.trim()) return 'Please enter your organisation name.';
			if (!form.refereeWorkEmail.trim() || !isValidEmail(form.refereeWorkEmail))
				return 'Please enter a valid work email address.';
			if (!form.refereeWorkPhone.trim()) return 'Please enter a work phone number.';
			if (!form.relationshipToApplicant) return 'Please select your relationship to the applicant.';
			if (!form.howLongKnown.trim())
				return 'Please indicate how long you have known the applicant.';
			if (!form.datesWorkedTogether.trim()) return 'Please enter the dates you worked together.';
			return null;
		case 2:
			if (!form.confirmedEmployment)
				return 'Please confirm whether the applicant worked for your organisation.';
			if (form.confirmedEmployment === 'yes') {
				if (!form.jobTitleHeld.trim()) return 'Please enter the job title held.';
				if (!form.employmentStartDate) return 'Please enter the employment start date.';
				if (!form.currentlyEmployed)
					return 'Please indicate if the applicant is currently employed here.';
				if (form.currentlyEmployed === 'no' && !form.employmentEndDate)
					return 'Please enter the employment end date.';
				if (!form.employmentType) return 'Please select the employment type.';
			}
			return null;
		case 3: {
			const unrated = RATING_SKILLS.filter((s) => !form.ratings[s.key]);
			if (unrated.length > 0)
				return `Please rate: ${unrated.map((s) => s.label).join(', ')}.`;
			return null;
		}
		case 4: {
			const unanswered = COMPETENCY_QUESTIONS.filter((q) => !form.competency[q.key]);
			if (unanswered.length > 0) return 'Please answer all care competency questions.';
			return null;
		}
		case 5: {
			if (!form.safeguardingConcerns)
				return 'Please indicate whether there were any safeguarding concerns.';
			if (!form.disciplinaryActions)
				return 'Please indicate whether there were any disciplinary actions.';
			const hasConcerns =
				form.safeguardingConcerns === 'yes' ||
				form.disciplinaryActions === 'yes' ||
				Object.values(form.conductConcerns).some(Boolean);
			if (hasConcerns && !form.conductDetails.trim())
				return 'Please provide details for all concerns identified.';
			return null;
		}
		case 6:
			if (!form.wouldReemploy) return 'Please indicate if you would re-employ this individual.';
			if (form.wouldReemploy === 'with_reservations' && !form.reemployReservations.trim())
				return 'Please explain your reservations about re-employment.';
			return null;
		case 7:
			if (!form.overallRecommendation) return 'Please select an overall recommendation.';
			return null;
		case 8:
			return null;
		case 9:
			if (!form.declarationAgreed) return 'You must confirm the declaration before submitting.';
			if (!form.signatureName.trim()) return 'Please enter your full name as a signature.';
			return null;
		default:
			return null;
	}
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({
	step,
	title,
	description,
	tone = 'default',
}: {
	step: number;
	title: string;
	description: string;
	tone?: 'default' | 'warn';
}) {
	return (
		<div className='mb-6'>
			<div className='flex items-start gap-3'>
				<span
					className={cn(
						'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
						tone === 'warn' ? 'bg-amber-500' : 'bg-slate-900',
					)}
				>
					{step}
				</span>
				<div>
					<h2 className='text-lg font-semibold leading-tight text-slate-900'>{title}</h2>
					<p className='mt-0.5 text-sm text-slate-500'>{description}</p>
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	required,
	hint,
	children,
}: {
	label: string;
	required?: boolean;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className='space-y-1.5'>
			<Label className='text-sm font-medium text-slate-700'>
				{label}
				{required && <span className='ml-0.5 text-red-500'>*</span>}
			</Label>
			{hint && <p className='text-xs text-slate-400'>{hint}</p>}
			{children}
		</div>
	);
}

function YesNoToggle({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className='flex gap-2'>
			{[
				{ value: 'yes', label: 'Yes' },
				{ value: 'no', label: 'No' },
			].map((opt) => (
				<button
					key={opt.value}
					type='button'
					onClick={() => onChange(opt.value)}
					className={cn(
						'min-w-[72px] rounded-lg border px-4 py-2 text-sm font-medium transition-all',
						value === opt.value
							? 'border-slate-900 bg-slate-900 text-white'
							: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
					)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

function RatingRow({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className='border-b border-slate-100 py-3.5 last:border-0'>
			<p className='mb-2 text-sm font-medium text-slate-800'>{label}</p>
			<div className='flex flex-wrap gap-1.5'>
				{RATINGS.map((r) => (
					<button
						key={r.value}
						type='button'
						onClick={() => onChange(r.value)}
						className={cn(
							'rounded-full border px-3 py-1 text-xs font-medium transition-all',
							value === r.value
								? 'border-slate-900 bg-slate-900 text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900',
						)}
					>
						{r.label}
					</button>
				))}
			</div>
		</div>
	);
}

function CompetencyRow({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className='border-b border-slate-100 py-3.5 last:border-0'>
			<p className='mb-2.5 text-sm text-slate-800'>{label}</p>
			<div className='flex flex-wrap gap-2'>
				{[
					{
						value: 'yes',
						label: 'Yes',
						activeClass: 'border-emerald-600 bg-emerald-600 text-white',
					},
					{
						value: 'no',
						label: 'No',
						activeClass: 'border-red-600 bg-red-600 text-white',
					},
					{
						value: 'unable_to_comment',
						label: 'Unable to comment',
						activeClass: 'border-slate-600 bg-slate-600 text-white',
					},
				].map((opt) => (
					<button
						key={opt.value}
						type='button'
						onClick={() => onChange(opt.value)}
						className={cn(
							'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
							value === opt.value
								? opt.activeClass
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
						)}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}

function OptionCard({
	label,
	description,
	selected,
	onClick,
	danger,
}: {
	label: string;
	description: string;
	selected: boolean;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'w-full rounded-xl border p-4 text-left transition-all',
				selected
					? danger
						? 'border-red-400 bg-red-50'
						: 'border-slate-900 bg-slate-50'
					: 'border-slate-200 bg-white hover:border-slate-300',
			)}
		>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<p
						className={cn(
							'text-sm font-semibold',
							selected
								? danger
									? 'text-red-700'
									: 'text-slate-900'
								: 'text-slate-700',
						)}
					>
						{label}
					</p>
					<p className='mt-0.5 text-xs text-slate-500'>{description}</p>
				</div>
				<div
					className={cn(
						'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all',
						selected
							? danger
								? 'border-red-500 bg-red-500'
								: 'border-slate-900 bg-slate-900'
							: 'border-slate-300',
					)}
				/>
			</div>
		</button>
	);
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
	return (
		<div>
			<div className='flex items-center gap-1'>
				{Array.from({ length: TOTAL_STEPS }, (_, i) => {
					const s = i + 1;
					const done = s < current;
					const active = s === current;
					return (
						<div
							key={s}
							className={cn(
								'h-1.5 flex-1 rounded-full transition-all duration-300',
								done ? 'bg-slate-900' : active ? 'bg-slate-500' : 'bg-slate-200',
							)}
						/>
					);
				})}
			</div>
			<div className='mt-2 flex items-center justify-between'>
				<p className='text-xs font-medium text-slate-500'>
					Step {current} of {TOTAL_STEPS} — {STEP_LABELS[current - 1]}
				</p>
				<p className='text-xs text-slate-400'>
					{Math.round(((current - 1) / TOTAL_STEPS) * 100)}% complete
				</p>
			</div>
		</div>
	);
}

// ─── Status screens ───────────────────────────────────────────────────────────

function SubmittedState({
	reference,
}: {
	reference: { carerName: string; organizationName: string };
}) {
	return (
		<main className='flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12'>
			<div className='mx-auto max-w-md text-center'>
				<div className='mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100'>
					<CheckCircle2 className='h-8 w-8 text-emerald-600' />
				</div>
				<h1 className='text-xl font-semibold text-slate-900'>Reference submitted</h1>
				<p className='mt-2 text-sm text-slate-500'>
					Thank you for completing the employment reference for{' '}
					<strong className='text-slate-700'>{reference.carerName}</strong>.{' '}
					<strong className='text-slate-700'>{reference.organizationName}</strong> has been
					notified.
				</p>
				<p className='mt-5 text-xs text-slate-400'>
					Your response is confidential. You may now close this window.
				</p>
			</div>
		</main>
	);
}

function ExpiredState({
	reference,
}: {
	reference: { carerName: string; organizationName: string };
}) {
	return (
		<main className='flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12'>
			<div className='mx-auto max-w-md text-center'>
				<div className='mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100'>
					<Clock className='h-8 w-8 text-amber-600' />
				</div>
				<h1 className='text-xl font-semibold text-slate-900'>This link has expired</h1>
				<p className='mt-2 text-sm text-slate-500'>
					The reference link for{' '}
					<strong className='text-slate-700'>{reference.carerName}</strong> has expired.
					Please contact{' '}
					<strong className='text-slate-700'>{reference.organizationName}</strong> to
					request a new one.
				</p>
			</div>
		</main>
	);
}

function AlreadySubmittedState() {
	return (
		<main className='flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12'>
			<div className='mx-auto max-w-md text-center'>
				<div className='mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100'>
					<CheckCircle2 className='h-8 w-8 text-slate-500' />
				</div>
				<h1 className='text-xl font-semibold text-slate-900'>Already submitted</h1>
				<p className='mt-2 text-sm text-slate-500'>
					This reference has already been submitted. Thank you for your time.
				</p>
			</div>
		</main>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReferenceFormClient({ token, reference }: ReferenceFormClientProps) {
	const [step, setStep] = useState(1);
	const [form, setForm] = useState<FormData>(() =>
		makeInitialForm(
			reference.refereeName,
			reference.refereeEmail,
			reference.refereeOrganization,
		),
	);
	const [stepError, setStepError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(reference.status === 'responded');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const setRating = (skill: string, value: string) =>
		setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [skill]: value } }));

	const setCompetency = (key: string, value: string) =>
		setForm((prev) => ({ ...prev, competency: { ...prev.competency, [key]: value } }));

	const setConductConcern = (key: string, checked: boolean) =>
		setForm((prev) => ({
			...prev,
			conductConcerns: { ...prev.conductConcerns, [key]: checked },
		}));

	const next = () => {
		const error = validateStep(step, form);
		if (error) {
			setStepError(error);
			return;
		}
		setStepError(null);
		setStep((s) => Math.min(s + 1, TOTAL_STEPS));
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const back = () => {
		setStepError(null);
		setStep((s) => Math.max(s - 1, 1));
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleSubmit = async () => {
		const error = validateStep(9, form);
		if (error) {
			setStepError(error);
			return;
		}
		setStepError(null);
		setSubmitError(null);
		setIsSubmitting(true);
		try {
			const res = await fetch('/api/references/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, ...form }),
			});
			const payload = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) throw new Error(payload.error || 'Reference could not be submitted.');
			setSubmitted(true);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : 'Reference could not be submitted.',
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (reference.expired) return <ExpiredState reference={reference} />;
	if (submitted) return <SubmittedState reference={reference} />;
	if (['approved', 'rejected'].includes(reference.status)) return <AlreadySubmittedState />;

	const hasConductConcerns =
		form.safeguardingConcerns === 'yes' ||
		form.disciplinaryActions === 'yes' ||
		Object.values(form.conductConcerns).some(Boolean);

	const noSafeguardingIssues =
		form.safeguardingConcerns === 'no' &&
		form.disciplinaryActions === 'no' &&
		!Object.values(form.conductConcerns).some(Boolean);

	return (
		<main className='min-h-screen bg-slate-50'>
			{/* ── Sticky top bar ─────────────────────────────────────── */}
			<div className='sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm'>
				<div className='mx-auto max-w-2xl px-4 py-3'>
					<div className='flex items-center justify-between gap-4'>
						<div className='min-w-0'>
							<p className='text-[10px] font-bold uppercase tracking-widest text-slate-400'>
								CareComply
							</p>
							<h1 className='truncate text-sm font-semibold text-slate-900'>
								Employment Reference — {reference.carerName}
							</h1>
						</div>
						<span className='flex flex-shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500'>
							<Clock className='h-3 w-3' />
							~4 min
						</span>
					</div>
				</div>
			</div>

			<div className='mx-auto max-w-2xl px-4 pb-20 pt-5'>
				{/* ── Context banner ────────────────────────────────────── */}
				<div className='mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3.5'>
					<p className='text-sm text-slate-600'>
						<strong className='text-slate-900'>{reference.organizationName}</strong> has
						requested an employment reference for{' '}
						<strong className='text-slate-900'>{reference.carerName}</strong>. Your
						response is confidential and will only be seen by authorised staff.
					</p>
				</div>

				{/* ── Progress ──────────────────────────────────────────── */}
				<StepProgress current={step} />

				{/* ── Step card ─────────────────────────────────────────── */}
				<Card className='mt-4 border-slate-200 shadow-sm'>
					<CardContent className='p-6'>
						{/* S1: Referee Verification ─────────────────────── */}
						{step === 1 && (
							<>
								<SectionHeader
									step={1}
									title='Referee Verification'
									description='Your details help the care provider confirm the authenticity of this reference.'
								/>
								<div className='space-y-5'>
									<div className='grid gap-4 sm:grid-cols-2'>
										<Field label='Full Name' required>
											<Input
												value={form.refereeName}
												onChange={(e) => set('refereeName', e.target.value)}
												placeholder='e.g. Amara Okafor'
											/>
										</Field>
										<Field label='Job Title' required>
											<Input
												value={form.refereeJobTitle}
												onChange={(e) => set('refereeJobTitle', e.target.value)}
												placeholder='e.g. Registered Manager'
											/>
										</Field>
									</div>
									<Field label='Organisation Name' required>
										<Input
											value={form.refereeOrganization}
											onChange={(e) => set('refereeOrganization', e.target.value)}
											placeholder='e.g. Brightpath Care Ltd'
										/>
									</Field>
									<div className='grid gap-4 sm:grid-cols-2'>
										<Field label='Work Email Address' required>
											<Input
												type='email'
												value={form.refereeWorkEmail}
												onChange={(e) => set('refereeWorkEmail', e.target.value)}
												placeholder='you@organisation.co.uk'
											/>
										</Field>
										<Field label='Work Phone Number' required>
											<Input
												type='tel'
												value={form.refereeWorkPhone}
												onChange={(e) => set('refereeWorkPhone', e.target.value)}
												placeholder='e.g. 01234 567890'
											/>
										</Field>
									</div>
									<Field label='Relationship to Applicant' required>
										<Select
											value={form.relationshipToApplicant}
											onValueChange={(v) => set('relationshipToApplicant', v)}
										>
											<SelectTrigger>
												<SelectValue placeholder='Select your relationship' />
											</SelectTrigger>
											<SelectContent>
												{RELATIONSHIP_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
									<div className='grid gap-4 sm:grid-cols-2'>
										<Field
											label='How long have you known the applicant?'
											required
											hint='e.g. "2 years" or "18 months"'
										>
											<Input
												value={form.howLongKnown}
												onChange={(e) => set('howLongKnown', e.target.value)}
												placeholder='e.g. 2 years'
											/>
										</Field>
										<Field
											label='Dates worked together'
											required
											hint='e.g. "Jan 2022 – Mar 2024"'
										>
											<Input
												value={form.datesWorkedTogether}
												onChange={(e) => set('datesWorkedTogether', e.target.value)}
												placeholder='e.g. Jan 2022 – Mar 2024'
											/>
										</Field>
									</div>
								</div>
							</>
						)}

						{/* S2: Employment Verification ──────────────────── */}
						{step === 2 && (
							<>
								<SectionHeader
									step={2}
									title='Employment Verification'
									description={`Confirm ${reference.carerName}'s employment history at your organisation.`}
								/>
								<div className='space-y-5'>
									<Field
										label={`Did ${reference.carerName} work for your organisation?`}
										required
									>
										<YesNoToggle
											value={form.confirmedEmployment}
											onChange={(v) => set('confirmedEmployment', v)}
										/>
									</Field>

									{form.confirmedEmployment === 'yes' && (
										<>
											<div className='h-px bg-slate-100' />
											<div className='grid gap-4 sm:grid-cols-2'>
												<Field label='Job Title Held' required>
													<Input
														value={form.jobTitleHeld}
														onChange={(e) => set('jobTitleHeld', e.target.value)}
														placeholder='e.g. Care Assistant'
													/>
												</Field>
												<Field label='Employment Type' required>
													<Select
														value={form.employmentType}
														onValueChange={(v) => set('employmentType', v)}
													>
														<SelectTrigger>
															<SelectValue placeholder='Select type' />
														</SelectTrigger>
														<SelectContent>
															{EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
																<SelectItem key={opt.value} value={opt.value}>
																	{opt.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</Field>
											</div>
											<div className='grid gap-4 sm:grid-cols-2'>
												<Field label='Employment Start Date' required>
													<Input
														type='date'
														value={form.employmentStartDate}
														onChange={(e) => set('employmentStartDate', e.target.value)}
													/>
												</Field>
												<Field label='Still employed here?' required>
													<YesNoToggle
														value={form.currentlyEmployed}
														onChange={(v) => set('currentlyEmployed', v)}
													/>
												</Field>
											</div>
											{form.currentlyEmployed === 'no' && (
												<Field label='Employment End Date' required>
													<Input
														type='date'
														value={form.employmentEndDate}
														onChange={(e) => set('employmentEndDate', e.target.value)}
													/>
												</Field>
											)}
											<Field label='Reason for Leaving'>
												<Textarea
													value={form.reasonForLeaving}
													onChange={(e) => set('reasonForLeaving', e.target.value)}
													placeholder='Optional — describe the circumstances of leaving, if known.'
													rows={3}
													className='resize-none'
												/>
											</Field>
										</>
									)}

									{form.confirmedEmployment === 'no' && (
										<div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
											<p className='text-sm text-amber-800'>
												<strong>Note:</strong> You have indicated the applicant did not
												work for your organisation. You may still proceed to provide a
												professional character reference.
											</p>
										</div>
									)}
								</div>
							</>
						)}

						{/* S3: Performance Assessment ───────────────────── */}
						{step === 3 && (
							<>
								<SectionHeader
									step={3}
									title='Performance Assessment'
									description='Rate the applicant on each competency. Use N/A if you cannot comment on a particular area.'
								/>
								<div>
									{RATING_SKILLS.map((skill) => (
										<RatingRow
											key={skill.key}
											label={skill.label}
											value={form.ratings[skill.key] ?? ''}
											onChange={(v) => setRating(skill.key, v)}
										/>
									))}
								</div>
							</>
						)}

						{/* S4: Care Competency ──────────────────────────── */}
						{step === 4 && (
							<>
								<SectionHeader
									step={4}
									title='Care Competency'
									description={`Assess ${reference.carerName}'s approach to care delivery and professional conduct.`}
								/>
								<div>
									{COMPETENCY_QUESTIONS.map((q) => (
										<CompetencyRow
											key={q.key}
											label={q.label}
											value={form.competency[q.key] ?? ''}
											onChange={(v) => setCompetency(q.key, v)}
										/>
									))}
								</div>
							</>
						)}

						{/* S5: Safeguarding & Conduct ───────────────────── */}
						{step === 5 && (
							<>
								<SectionHeader
									step={5}
									title='Safeguarding & Conduct'
									description='This section helps protect vulnerable people. All responses are handled with strict confidentiality.'
									tone='warn'
								/>
								<div className='space-y-5'>
									<Field
										label='Were there any safeguarding concerns during employment?'
										required
									>
										<YesNoToggle
											value={form.safeguardingConcerns}
											onChange={(v) => set('safeguardingConcerns', v)}
										/>
									</Field>
									<Field
										label='Were any disciplinary actions taken during employment?'
										required
									>
										<YesNoToggle
											value={form.disciplinaryActions}
											onChange={(v) => set('disciplinaryActions', v)}
										/>
									</Field>

									<div>
										<p className='mb-2.5 text-sm font-medium text-slate-700'>
											Were there any concerns relating to: <span className='text-slate-400'>(select all that apply)</span>
										</p>
										<div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
											{CONDUCT_CONCERNS.map((concern) => (
												<label
													key={concern.key}
													className={cn(
														'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-all select-none',
														form.conductConcerns[concern.key]
															? 'border-amber-300 bg-amber-50 text-amber-900'
															: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
													)}
												>
													<Checkbox
														checked={form.conductConcerns[concern.key] ?? false}
														onCheckedChange={(checked) =>
															setConductConcern(concern.key, Boolean(checked))
														}
													/>
													{concern.label}
												</label>
											))}
										</div>
									</div>

									{hasConductConcerns && (
										<Field
											label='Please provide details of all concerns'
											required
											hint='Include the nature of each concern, relevant dates, and any actions taken or outcomes.'
										>
											<Textarea
												value={form.conductDetails}
												onChange={(e) => set('conductDetails', e.target.value)}
												placeholder='Please describe the circumstances, relevant dates, and any actions taken or outcomes...'
												rows={5}
												className='resize-none'
											/>
										</Field>
									)}

									{noSafeguardingIssues && (
										<div className='flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5'>
											<CheckCircle2 className='mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600' />
											<p className='text-sm text-emerald-800'>
												No safeguarding or conduct concerns identified. Please continue
												to the next section.
											</p>
										</div>
									)}
								</div>
							</>
						)}

						{/* S6: Rehire Recommendation ────────────────────── */}
						{step === 6 && (
							<>
								<SectionHeader
									step={6}
									title='Rehire Recommendation'
									description={`Would you employ ${reference.carerName} again at your organisation?`}
								/>
								<div className='space-y-3'>
									{[
										{
											value: 'yes',
											label: 'Yes',
											desc: 'I would re-employ this individual without hesitation',
											danger: false,
										},
										{
											value: 'with_reservations',
											label: 'With Reservations',
											desc: 'I would consider re-employment but have some concerns',
											danger: false,
										},
										{
											value: 'no',
											label: 'No',
											desc: 'I would not re-employ this individual',
											danger: true,
										},
									].map((opt) => (
										<OptionCard
											key={opt.value}
											label={opt.label}
											description={opt.desc}
											selected={form.wouldReemploy === opt.value}
											onClick={() => set('wouldReemploy', opt.value)}
											danger={opt.danger}
										/>
									))}

									{form.wouldReemploy === 'with_reservations' && (
										<Field label='Please explain your reservations' required>
											<Textarea
												value={form.reemployReservations}
												onChange={(e) => set('reemployReservations', e.target.value)}
												placeholder='Please describe what factors would give you pause about re-employing this individual...'
												rows={4}
												className='resize-none'
											/>
										</Field>
									)}
								</div>
							</>
						)}

						{/* S7: Overall Recommendation ───────────────────── */}
						{step === 7 && (
							<>
								<SectionHeader
									step={7}
									title='Overall Recommendation'
									description={`Your overall assessment of ${reference.carerName}'s suitability for health and social care employment.`}
								/>
								<div className='space-y-3'>
									{RECOMMENDATION_OPTIONS.map((opt) => (
										<OptionCard
											key={opt.value}
											label={opt.label}
											description={opt.desc}
											selected={form.overallRecommendation === opt.value}
											onClick={() => set('overallRecommendation', opt.value)}
											danger={opt.danger}
										/>
									))}
								</div>
							</>
						)}

						{/* S8: Additional Comments ──────────────────────── */}
						{step === 8 && (
							<>
								<SectionHeader
									step={8}
									title='Additional Comments'
									description='Optional — share anything else that may help the recruiting organisation assess the applicant.'
								/>
								<div className='space-y-1.5'>
									<Label className='text-sm font-medium text-slate-700'>
										Additional information
									</Label>
									<Textarea
										value={form.additionalComments}
										onChange={(e) => set('additionalComments', e.target.value)}
										placeholder='Please provide any additional information that may assist the recruiting organisation in assessing the applicant&#39;s suitability for care work...'
										rows={9}
										className='resize-none'
									/>
									<p className='text-right text-xs text-slate-400'>
										{form.additionalComments.length} / 4000
									</p>
								</div>
							</>
						)}

						{/* S9: Declaration & Signature ──────────────────── */}
						{step === 9 && (
							<>
								<SectionHeader
									step={9}
									title='Declaration & Signature'
									description='Please read the declaration carefully before signing and submitting.'
								/>
								<div className='space-y-5'>
									<div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
										<p className='text-sm leading-relaxed text-slate-700'>
											I confirm that the information provided in this reference is
											accurate, truthful, and based on my professional knowledge and
											experience of the applicant. I understand that this reference will
											be used to assess the applicant&rsquo;s suitability for employment
											in health or social care, and that knowingly providing false
											information may have serious professional consequences.
										</p>
									</div>

									<label className='flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 select-none'>
										<Checkbox
											id='declaration'
											checked={form.declarationAgreed}
											onCheckedChange={(checked) =>
												set('declarationAgreed', Boolean(checked))
											}
											className='mt-0.5'
										/>
										<span className='text-sm font-medium text-slate-800'>
											I confirm the information provided is accurate and based on my
											professional experience of the applicant.
										</span>
									</label>

									<div className='grid gap-4 sm:grid-cols-2'>
										<Field label='Full Name (Electronic Signature)' required>
											<Input
												value={form.signatureName}
												onChange={(e) => set('signatureName', e.target.value)}
												placeholder='Your full name'
											/>
										</Field>
										<Field label='Date Submitted'>
											<Input
												type='date'
												value={new Date().toISOString().slice(0, 10)}
												disabled
												className='bg-slate-50 text-slate-500'
											/>
										</Field>
									</div>

									<div className='flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3.5'>
										<ShieldCheck className='mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400' />
										<p className='text-xs text-slate-500'>
											This reference is transmitted securely and stored confidentially
											by CareComply. It will only be shared with authorised staff at{' '}
											<strong className='text-slate-600'>
												{reference.organizationName}
											</strong>
											.
										</p>
									</div>
								</div>
							</>
						)}
					</CardContent>
				</Card>

				{/* ── Step error ────────────────────────────────────────── */}
				{stepError && (
					<div className='mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3'>
						<AlertTriangle className='mt-0.5 h-4 w-4 flex-shrink-0 text-red-500' />
						<p className='text-sm text-red-700'>{stepError}</p>
					</div>
				)}

				{/* ── Navigation ────────────────────────────────────────── */}
				<div className='mt-5 flex items-center justify-between'>
					<Button
						type='button'
						variant='ghost'
						onClick={back}
						disabled={step === 1}
						className='gap-1 text-slate-600'
					>
						<ChevronLeft className='h-4 w-4' />
						Back
					</Button>

					<div className='flex items-center gap-3'>
						<span className='text-xs text-slate-400'>
							{step} / {TOTAL_STEPS}
						</span>
						{step < TOTAL_STEPS ? (
							<Button type='button' onClick={next} className='gap-1'>
								Continue
								<ChevronRight className='h-4 w-4' />
							</Button>
						) : (
							<Button
								type='button'
								onClick={handleSubmit}
								disabled={isSubmitting}
								className='gap-1.5'
							>
								{isSubmitting ? (
									'Submitting…'
								) : (
									<>
										<ShieldCheck className='h-4 w-4' />
										Submit Reference
									</>
								)}
							</Button>
						)}
					</div>
				</div>

				{submitError && (
					<p className='mt-3 text-center text-sm text-red-600'>{submitError}</p>
				)}
			</div>
		</main>
	);
}
