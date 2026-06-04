import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface FeedbackCardProps {
	/** The reviewer's reason, shown prominently as the focal point of the email. */
	reason: string;
	/** Who reviewed the document — rendered as an attribution line. */
	reviewerName: string;
	/** Mono caption above the reason. Defaults to "REVIEWER FEEDBACK". */
	label?: string;
}

/**
 * Highlighted reviewer-feedback block. Amber-tinted to match the warn StatusCard,
 * with the rejection reason set large so it reads as the focal point, and a
 * quiet attribution line below.
 */
export function FeedbackCard({ reason, reviewerName, label = 'Reviewer feedback' }: FeedbackCardProps) {
	return (
		<Section style={card}>
			<Text style={labelStyle}>{label.toUpperCase()}</Text>
			<Text style={reasonStyle}>&ldquo;{reason}&rdquo;</Text>
			<Text style={attribution}>
				Reviewed by <span style={reviewer}>{reviewerName}</span>
			</Text>
		</Section>
	);
}

const card: React.CSSProperties = {
	backgroundColor: colors.warn50,
	border: '1px solid #FCD9A555',
	borderLeft: '3px solid #F59E0B',
	borderRadius: radius.lg,
	padding: '18px 20px',
	margin: '0 0 28px',
};

const labelStyle: React.CSSProperties = {
	margin: '0 0 8px',
	fontFamily: fontFamily.mono,
	fontSize: '10px',
	fontWeight: 600,
	letterSpacing: '0.12em',
	color: colors.warn700,
};

const reasonStyle: React.CSSProperties = {
	margin: '0 0 10px',
	fontFamily: fontFamily.sans,
	fontWeight: 600,
	fontSize: fontSize.lg,
	lineHeight: '1.5',
	letterSpacing: '-0.01em',
	color: colors.ink,
};

const attribution: React.CSSProperties = {
	margin: 0,
	fontFamily: fontFamily.sans,
	fontSize: fontSize.sm,
	color: colors.slate500,
};

const reviewer: React.CSSProperties = {
	fontWeight: 600,
	color: colors.ink3,
};
