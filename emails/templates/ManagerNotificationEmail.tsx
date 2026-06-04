import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard, type StatusTone } from '../components/StatusCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { ManagerNotificationEmailProps, NotificationPriority } from '../types';

/** Maps a priority to a StatusCard tone, a human badge label and an eyebrow colour. */
const priorityMap: Record<
	NotificationPriority,
	{ tone: StatusTone; label: string; eyebrow: string }
> = {
	low: { tone: 'brand', label: 'For your information', eyebrow: colors.brand700 },
	medium: { tone: 'warn', label: 'Needs attention', eyebrow: colors.warn700 },
	high: { tone: 'warn', label: 'High priority', eyebrow: colors.warn700 },
	critical: { tone: 'danger', label: 'Critical · act now', eyebrow: '#B91C1C' },
};

export function ManagerNotificationEmail({
	managerName,
	organizationName,
	title,
	summary,
	details,
	priority,
	actionLabel,
	actionUrl,
	supportEmail,
	logoUrl,
}: ManagerNotificationEmailProps) {
	const p = priorityMap[priority];
	const preview =
		priority === 'critical' || priority === 'high'
			? `${p.label}: ${title}`
			: title;

	return (
		<EmailLayout preview={preview}>
			<EmailHeader logoUrl={logoUrl} />
			<EmailCard>
				<Text style={s.eyebrow(p.eyebrow)}>MANAGER NOTIFICATION</Text>
				<Heading as="h1" style={s.h1}>
					{title}
				</Heading>
				<Text style={s.lead}>
					Hi {managerName}, here&rsquo;s an update from your{' '}
					<strong style={s.strongInk}>{organizationName}</strong> workspace that
					needs your attention.
				</Text>

				<Section style={{ height: '24px' }} />

				<StatusCard tone={p.tone} badge={p.label} title={summary}>
					{details}
				</StatusCard>

				<Section style={s.ctaWrap}>
					<EmailButton href={actionUrl}>
						{actionLabel} &nbsp;&rarr;
					</EmailButton>
				</Section>

				<Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
				<Link href={actionUrl} style={s.fallbackUrl}>{actionUrl}</Link>

				<Section style={note}>
					<Text style={noteText}>
						You&rsquo;re receiving this because you manage compliance for{' '}
						<strong style={s.strongInk}>{organizationName}</strong> on
						CareComply. You can adjust which events notify you, and how often,
						from <strong style={s.strongInk}>Settings &rsaquo; Notifications</strong>{' '}
						in your dashboard. Need a hand? We&rsquo;re at{' '}
						<a href={`mailto:${supportEmail}`} style={noteLink}>{supportEmail}</a>.
					</Text>
				</Section>
			</EmailCard>
			<EmailFooter supportEmail={supportEmail} />
		</EmailLayout>
	);
}

ManagerNotificationEmail.PreviewProps = {
	managerName: 'Daniel',
	organizationName: 'Brightpath Care',
	title: 'New document submitted for review',
	summary: 'Priya Sharma uploaded a Right to Work document',
	details:
		'A new document is waiting in your review queue. Verifying it promptly keeps Priya\u2019s onboarding moving and her compliance record up to date.',
	priority: 'medium',
	actionLabel: 'Review submission',
	actionUrl: 'https://app.carecomply.co.uk/reviews/queue',
	supportEmail: 'support@carecomply.co.uk',
	logoUrl: undefined,
} satisfies ManagerNotificationEmailProps;

export default ManagerNotificationEmail;

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
