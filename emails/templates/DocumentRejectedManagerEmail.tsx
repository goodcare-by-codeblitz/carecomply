import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { DetailCard } from '../components/DetailCard';
import { FeedbackCard } from '../components/FeedbackCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { DocumentRejectedManagerEmailProps } from '../types';

export function DocumentRejectedManagerEmail({
	managerName,
	carerName,
	organizationName,
	documentName,
	rejectionReason,
	reviewerName,
	complianceImpact,
	actionUrl,
	supportEmail,
	logoUrl,
}: DocumentRejectedManagerEmailProps) {
	const preview = `Compliance alert: ${carerName}'s ${documentName} was rejected on review`;

	return (
		<EmailLayout preview={preview}>
			<EmailHeader logoUrl={logoUrl} />
			<EmailCard>
				<Text style={s.eyebrow('#B91C1C')}>COMPLIANCE ALERT</Text>
				<Heading as="h1" style={s.h1}>
					A document failed review
				</Heading>
				<Text style={s.lead}>
					Hi {managerName}, a document submitted for{' '}
					<strong style={s.strongInk}>{carerName}</strong> at{' '}
					<strong style={s.strongInk}>{organizationName}</strong> has been
					reviewed and rejected. This may affect their compliance standing —
					here&rsquo;s what was found and what to do next.
				</Text>

				<Section style={{ height: '24px' }} />

				<StatusCard
					tone="danger"
					badge="Review outcome · rejected"
					title={`${carerName}'s ${documentName} was not approved`}
				>
					The carer has been notified and asked to resubmit. Until an approved
					version is on file, this requirement counts as outstanding against
					their compliance record.
				</StatusCard>

				<FeedbackCard
					reason={rejectionReason}
					reviewerName={reviewerName}
					label="Reviewer notes"
				/>

				<DetailCard
					title="Submission details"
					rows={[
						{ label: 'Carer', value: carerName },
						{ label: 'Document', value: documentName },
						{ label: 'Organisation', value: organizationName },
						{ label: 'Reviewed by', value: reviewerName },
						{ label: 'Outcome', value: 'Rejected', pill: true },
					]}
				/>

				<Section style={risk}>
					<Text style={riskLabel}>COMPLIANCE IMPACT</Text>
					<Text style={riskText}>{complianceImpact}</Text>
				</Section>

				<Section style={s.ctaWrap}>
					<EmailButton href={actionUrl}>
						Review compliance issue &nbsp;&rarr;
					</EmailButton>
				</Section>

				<Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
				<Link href={actionUrl} style={s.fallbackUrl}>{actionUrl}</Link>

				<Section style={note}>
					<Text style={noteTitle}>Recommended follow-up</Text>
					<Text style={noteText}>
						Open {carerName}&rsquo;s profile to see the full review history,
						confirm whether the requirement blocks active shifts, and follow up
						on the resubmission. If you believe this was rejected in error, you
						can override or re-open the review from the same screen. Questions
						about a decision? Reach us at{' '}
						<a href={`mailto:${supportEmail}`} style={noteLink}>{supportEmail}</a>.
					</Text>
				</Section>
			</EmailCard>
			<EmailFooter supportEmail={supportEmail} />
		</EmailLayout>
	);
}

DocumentRejectedManagerEmail.PreviewProps = {
	managerName: 'Daniel',
	carerName: 'Priya Sharma',
	organizationName: 'Brightpath Care',
	documentName: 'Enhanced DBS certificate',
	rejectionReason:
		'The certificate photo is cut off, so the issue date and reference number can\u2019t be verified against the DBS record.',
	reviewerName: 'Amara Okafor',
	complianceImpact:
		'DBS clearance is a mandatory pre-shift requirement. Priya is now flagged non-compliant for this document and should not be rostered onto regulated activity until an approved version is on file.',
	actionUrl: 'https://app.carecomply.co.uk/carers/priya-sharma/compliance',
	supportEmail: 'support@carecomply.co.uk',
	logoUrl: undefined,
} satisfies DocumentRejectedManagerEmailProps;

export default DocumentRejectedManagerEmail;

const risk: React.CSSProperties = {
	backgroundColor: '#FEF2F2',
	border: '1px solid #FECACA88',
	borderLeft: '3px solid #EF4444',
	borderRadius: '12px',
	padding: '16px 18px',
	margin: '0 0 28px',
};
const riskLabel: React.CSSProperties = {
	margin: '0 0 6px',
	fontFamily: "'JetBrains Mono', ui-monospace, monospace",
	fontSize: '10px',
	fontWeight: 600,
	letterSpacing: '0.12em',
	color: '#B91C1C',
};
const riskText: React.CSSProperties = {
	margin: 0,
	fontSize: '13px',
	lineHeight: '1.65',
	color: colors.slate700,
};

const note: React.CSSProperties = {
	backgroundColor: colors.surfaceMuted,
	border: `1px solid ${colors.line}`,
	borderRadius: '12px',
	padding: '16px 18px',
	margin: '24px 0 0',
};
const noteTitle: React.CSSProperties = {
	margin: '0 0 6px',
	fontWeight: 700,
	fontSize: '15px',
	color: colors.ink,
};
const noteText: React.CSSProperties = {
	margin: 0,
	fontSize: '13px',
	lineHeight: '1.65',
	color: colors.slate600,
};
const noteLink: React.CSSProperties = {
	color: colors.brand700,
	textDecoration: 'underline',
	fontWeight: 600,
};
