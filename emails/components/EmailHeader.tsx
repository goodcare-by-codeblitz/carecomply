import * as React from 'react';
import { Section, Row, Column, Img, Text } from '@react-email/components';
import { colors, fontFamily } from '../theme';

interface EmailHeaderProps {
  /** Absolute URL to the 88×88 brandmark PNG. Falls back to a CSS mark. */
  logoUrl?: string;
}

/**
 * CareComply lockup: brandmark + wordmark. Centred above the card.
 * If `logoUrl` is provided it is used (recommended for production — SVG is
 * stripped by Gmail); otherwise a CSS-only dark tile renders as a fallback.
 */
export function EmailHeader({ logoUrl }: EmailHeaderProps) {
  return (
    <Section style={{ padding: '0 0 28px' }}>
      <Row>
        <Column style={{ width: '40px', verticalAlign: 'middle' }}>
          {logoUrl ? (
            <Img src={logoUrl} width="40" height="40" alt="CareComply" style={mark} />
          ) : (
            <div style={markFallback}>C</div>
          )}
        </Column>
        <Column style={{ verticalAlign: 'middle', paddingLeft: '12px' }}>
          <Text style={wordmark}>CareComply</Text>
        </Column>
      </Row>
    </Section>
  );
}

const mark: React.CSSProperties = {
  borderRadius: '10px',
  display: 'block',
};

const markFallback: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  backgroundColor: colors.ink,
  color: colors.accent500,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '20px',
  lineHeight: '40px',
  textAlign: 'center',
};

const wordmark: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '18px',
  letterSpacing: '-0.03em',
  color: colors.ink,
};
