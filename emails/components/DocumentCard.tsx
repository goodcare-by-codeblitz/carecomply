import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface DocumentCardProps {
  documents: string[];
}

/**
 * "What you'll need" card: lists the required documents with check bullets and
 * a plain-language note on why the checks matter (soft healthcare framing).
 */
export function DocumentCard({ documents }: DocumentCardProps) {
  return (
    <Section style={card}>
      <Text style={label}>WHAT YOU&rsquo;LL NEED</Text>

      {documents.map((doc, i) => (
        <Row key={i} style={{ marginBottom: '2px' }}>
          <Column style={{ width: '24px', verticalAlign: 'top' }}>
            <div style={tick}>&#10003;</div>
          </Column>
          <Column style={{ verticalAlign: 'middle' }}>
            <Text style={docText}>{doc}</Text>
          </Column>
        </Row>
      ))}

      <div style={hr} />

      <Text style={why}>
        These checks keep the people you care for safe and meet CQC
        requirements. Your documents are encrypted, stored securely, and only
        seen by your verification team — never shared.
      </Text>
    </Section>
  );
}

const card: React.CSSProperties = {
  backgroundColor: colors.accent50,
  border: `1px solid ${colors.accent500}33`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '28px 0',
};

const label: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.accent700,
};

const tick: React.CSSProperties = {
  width: '18px',
  height: '18px',
  borderRadius: '9999px',
  backgroundColor: colors.accent500,
  color: colors.white,
  fontSize: '11px',
  lineHeight: '18px',
  textAlign: 'center',
  fontWeight: 700,
};

const docText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.md,
  lineHeight: '18px',
  color: colors.ink,
};

const hr: React.CSSProperties = {
  height: '1px',
  backgroundColor: `${colors.accent500}33`,
  margin: '16px 0',
};

const why: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.accent700,
};
