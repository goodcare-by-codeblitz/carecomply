import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

export interface DetailRow {
  label: string;
  value: string;
  /** Render the value as a brand pill (e.g. a role or status). */
  pill?: boolean;
}

interface DetailCardProps {
  /** Optional mono caption at the top of the card. */
  title?: string;
  /** Optional avatar initials shown left of the title row. */
  avatarInitials?: string;
  rows: DetailRow[];
}

/**
 * Inset key/value summary card — document details, carer info, pending request.
 * Two-column label/value rows on a muted surface.
 */
export function DetailCard({ title, avatarInitials, rows }: DetailCardProps) {
  return (
    <Section style={card}>
      {title || avatarInitials ? (
        <Row>
          {avatarInitials ? (
            <Column style={{ width: '44px', verticalAlign: 'middle' }}>
              <div style={avatar}>{avatarInitials}</div>
            </Column>
          ) : null}
          <Column style={{ verticalAlign: 'middle', paddingLeft: avatarInitials ? '14px' : '0' }}>
            {title ? <Text style={cardTitle}>{title}</Text> : null}
          </Column>
        </Row>
      ) : null}

      {title || avatarInitials ? <div style={hr} /> : null}

      {rows.map((r, i) => (
        <Row key={i} style={{ marginBottom: i === rows.length - 1 ? 0 : 12 }}>
          <Column style={{ width: '42%', verticalAlign: 'top' }}>
            <Text style={labelStyle}>{r.label}</Text>
          </Column>
          <Column style={{ verticalAlign: 'top', textAlign: 'right' }}>
            {r.pill ? (
              <span style={pill}>{r.value}</span>
            ) : (
              <Text style={valueStyle}>{r.value}</Text>
            )}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

const card: React.CSSProperties = {
  backgroundColor: colors.surfacePage,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '0 0 28px',
};

const avatar: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: radius.md,
  backgroundColor: colors.ink,
  color: colors.white,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '15px',
  lineHeight: '44px',
  textAlign: 'center',
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.02em',
  color: colors.ink,
};

const hr: React.CSSProperties = {
  height: '1px',
  backgroundColor: colors.line,
  margin: '16px 0',
};

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.slate500,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.sm,
  color: colors.ink,
};

const pill: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: colors.brand50,
  color: colors.brand700,
  border: `1px solid ${colors.brand100}`,
  borderRadius: radius.full,
  padding: '3px 10px',
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.xs,
};
