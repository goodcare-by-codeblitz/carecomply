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
import type { DocumentRejectedCarerEmailProps } from '../types';

export function DocumentRejectedCarerEmail({
	carerName,
	organizationName,
	documentName,
	rejectionReason,
	reviewerName,
	actionUrl,
	supportEmail,
	logoUrl,
}: DocumentRejectedCarerEmailProps) {
	const preview = `Your ${documentName} needs a quick correction before it can be approved`;

	return (
		<EmailLayout preview={preview}>
			<EmailHeader logoUrl={logoUrl} />
			<EmailCard>
				<Text style={s.eyebrow(colors.warn700)}>DOCUMENT REVIEW</Text>
				<Heading as="h1" style={s.h1}>
					A document needs a small fix
				</Heading>
				<Text style={s.lead}>
					Hi {carerName}, thanks for uploading your document to{' '}
					<strong style={s.strongInk}>{organizationName}</strong>. Our
					verification team has reviewed it and it can&rsquo;t be approved just
					yet — there&rsquo;s one thing to put right and then you&rsquo;re good
					to go.
				</Text>

				<Section style={{ height: '24px' }} />

				<StatusCard
					tone="warn"
					badge="Needs resubmission"
					title={`Your ${documentName} wasn't approved`}
				>
					This is a normal part of the checks — it just means the version we
					have can&rsquo;t be accepted as-is. Fixing it usually takes a couple
					of minutes.
				</StatusCard>

				<FeedbackCard reason={rejectionReason} reviewerName={reviewerName} />

				<DetailCard
					title="Document details"
					rows={[
						{ label: 'Document', value: documentName },
						{ label: 'Organisation', value: organizationName },
						{ label: 'Reviewed by', value: reviewerName },
						{ label: 'Outcome', value: 'Not approved', pill: true },
					]}
				/>

				<Section style={s.ctaWrap}>
					<EmailButton href={actionUrl}>
						Upload corrected document &nbsp;&rarr;
					</EmailButton>
				</Section>

				<Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
				<Link href={actionUrl} style={s.fallbackUrl}>{actionUrl}</Link>

				<Section style={note}>
					<Text style={noteTitle}>What happens next</Text>
					<Text style={noteText}>
						Once you upload a corrected version it goes straight back to the
						verification team for review. There&rsquo;s no penalty for a
						resubmission — keeping your records accurate is what keeps you
						cleared to work and protects the people you support. Stuck on the
						feedback? Email us at{' '}
						<a href={`mailto:${supportEmail}`} style={noteLink}>{supportEmail}</a>{' '}
						and a real person will help.
					</Text>
				</Section>
			</EmailCard>
			<EmailFooter supportEmail={supportEmail} />
		</EmailLayout>
	);
}

DocumentRejectedCarerEmail.PreviewProps = {
	carerName: 'Priya',
	organizationName: 'Brightpath Care',
	documentName: 'Enhanced DBS certificate',
	rejectionReason:
		'The certificate photo is cut off at the bottom, so the issue date and reference number can\u2019t be read. Please re-upload a clear scan showing the full document.',
	reviewerName: 'Amara Okafor',
	actionUrl: 'https://app.carecomply.co.uk/documents/upload',
	supportEmail: 'support@carecomply.co.uk',
	logoUrl: undefined,
} satisfies DocumentRejectedCarerEmailProps;

export default DocumentRejectedCarerEmail;

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
