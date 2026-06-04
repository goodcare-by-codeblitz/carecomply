import * as React from 'react';
import { Section, Text, Row, Column } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface TrustBadgesProps {
	/** Short overall confidence label. e.g. "High confidence match". */
	score: string;
	/** Verification signals, each rendered as a check-prefixed badge. */
	signals: string[];
	label?: string;
}

/**
 * Compliance-insight block: an overall trust score plus a wrapped row of
 * verification badges. Uses the accent (teal) family so it reads as
 * "verified / trustworthy" without competing with the green status banner.
 */
export function TrustBadges({ score, signals, label = 'Reference trust score' }: TrustBadgesProps) {
	return (
		<Section style={card}>
			<Row>
				<Column>
					<Text style={labelStyle}>{label.toUpperCase()}</Text>
				</Column>
				<Column style={{ textAlign: 'right' as const }}>
					<span style={scorePill}>{score}</span>
				</Column>
			</Row>
			<Section style={{ marginTop: '14px' }}>
				{signals.map((signal) => (
					<span key={signal} style={badge}>
						<span style={check}>&#10003;</span>&nbsp;{signal}
					</span>
				))}
			</Section>
		</Section>
	);
}

const card: React.CSSProperties = {
	backgroundColor: colors.accent50,
	border: '1px solid #99F6E455',
	borderRadius: radius.lg,
	padding: '18px 20px',
	margin: '0 0 28px',
};

const labelStyle: React.CSSProperties = {
	margin: 0,
	fontFamily: fontFamily.mono,
	fontSize: '10px',
	fontWeight: 600,
	letterSpacing: '0.12em',
	color: colors.accent700,
};

const scorePill: React.CSSProperties = {
	display: 'inline-block',
	backgroundColor: colors.accent700,
	color: colors.white,
	borderRadius: radius.full,
	padding: '4px 12px',
	fontFamily: fontFamily.sans,
	fontSize: fontSize.xs,
	fontWeight: 700,
	letterSpacing: '-0.01em',
};

const badge: React.CSSProperties = {
	display: 'inline-block',
	backgroundColor: colors.white,
	border: '1px solid #99F6E4',
	borderRadius: radius.full,
	padding: '6px 12px',
	margin: '0 8px 8px 0',
	fontFamily: fontFamily.sans,
	fontSize: fontSize.xs,
	fontWeight: 600,
	color: colors.accent700,
	lineHeight: '1',
};

const check: React.CSSProperties = {
	color: colors.accent500,
	fontWeight: 700,
};
