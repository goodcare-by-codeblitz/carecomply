import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { DetailCard } from '../components/DetailCard';
import { TrustBadges } from '../components/TrustBadges';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { ReferenceResponseReceivedEmailProps } from '../types';

export function ReferenceResponseReceivedEmail({
	managerName,
	organizationName,
	carerName,
	refereeName,
	refereeRole,
	relationshipConfirmed,
	submittedDate,
	reviewUrl,
	trustScore,
	supportEmail,
	logoUrl,
}: ReferenceResponseReceivedEmailProps) {
	const preview = `${refereeName} responded to ${carerName}'s reference request`;

	return (
		<EmailLayout preview={preview}>
			<EmailHeader logoUrl={logoUrl} />
			<EmailCard>
				<Text style={s.eyebrow(colors.accent700)}>REFERENCE UPDATE</Text>
				<Heading as="h1" style={s.h1}>
					Reference response submitted
				</Heading>
				<Text style={s.lead}>
					Hi {managerName}, <strong style={s.strongInk}>{refereeName}</strong>{' '}
					has completed and submitted a reference for{' '}
					<strong style={s.strongInk}>{carerName}</strong>. The response is now
					available for review in CareComply.
				</Text>

				<Section style={{ height: '24px' }} />

				<StatusCard
					tone="ok"
					badge="Reference received"
					title="One reference is ready to review"
				>
					A completed referee response has landed for {carerName}. Reviewing it
					promptly keeps their pre-employment checks moving toward sign-off.
				</StatusCard>

				<DetailCard
					title="Reference summary"
					rows={[
						{ label: 'Carer', value: carerName },
						{ label: 'Referee', value: refereeName },
						{ label: 'Referee role', value: refereeRole },
						{ label: 'Relationship confirmed', value: relationshipConfirmed },
						{ label: 'Submitted', value: submittedDate },
					]}
				/>

				{trustScore ? (
					<TrustBadges score={trustScore.score} signals={trustScore.signals} />
				) : null}

				<Section style={s.ctaWrap}>
					<EmailButton href={reviewUrl}>Review reference &nbsp;&rarr;</EmailButton>
				</Section>

				<Text style={s.fallback}>
					Button not working? Paste this link into your browser:
				</Text>
				<Link href={reviewUrl} style={s.fallbackUrl}>
					{reviewUrl}
				</Link>

				<Section style={note}>
					<Text style={noteText}>
						Review the reference and determine whether it meets your
						organisation&rsquo;s recruitment and compliance requirements. Once
						you&rsquo;ve assessed it you can accept it, request clarification, or
						flag a concern from the review screen. Need a hand? We&rsquo;re at{' '}
						<a href={`mailto:${supportEmail}`} style={noteLink}>
							{supportEmail}
						</a>
						.
					</Text>
				</Section>
			</EmailCard>
			<EmailFooter supportEmail={supportEmail} organizationName={organizationName} />
		</EmailLayout>
	);
}

ReferenceResponseReceivedEmail.PreviewProps = {
	managerName: 'Daniel',
	organizationName: 'Brightpath Care',
	carerName: 'Priya Sharma',
	refereeName: 'Helen Mortimer',
	refereeRole: 'Registered Manager, Oakdene Care Home',
	relationshipConfirmed: 'Yes — line manager for 3 years',
	submittedDate: '29 May 2026, 14:22',
	reviewUrl: 'https://app.carecomply.co.uk/carers/priya-sharma/references/ref-7741',
	trustScore: {
		score: 'High confidence match',
		signals: ['Verified corporate email', 'Phone verified', 'Domain matches employer'],
	},
	supportEmail: 'support@carecomply.co.uk',
	logoUrl: undefined,
} satisfies ReferenceResponseReceivedEmailProps;

export default ReferenceResponseReceivedEmail;

const note: React.CSSProperties = {
	backgroundColor: colors.surfaceMuted,
	border: `1px solid ${colors.line}`,
	borderRadius: '12px',
	padding: '16px 18px',
	margin: '24px 0 0',
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
