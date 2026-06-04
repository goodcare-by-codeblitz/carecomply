import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { colors, fontFamily, fontSize } from '../theme';

interface ChecklistProps {
  /** Optional heading above the list. */
  title?: string;
  items: string[];
}

/** Neutral tick checklist — "next steps", "what's included". */
export function Checklist({ title, items }: ChecklistProps) {
  return (
    <Section style={{ margin: '0 0 28px' }}>
      {title ? <Text style={heading}>{title}</Text> : null}
      {items.map((item, i) => (
        <Row key={i}>
          <Column style={{ width: '26px', verticalAlign: 'top', paddingBottom: '10px' }}>
            <div style={tick}>&#10003;</div>
          </Column>
          <Column style={{ verticalAlign: 'top', paddingBottom: '10px' }}>
            <Text style={text}>{item}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

const heading: React.CSSProperties = {
  margin: '0 0 16px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.015em',
  color: colors.ink,
};

const tick: React.CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '9999px',
  backgroundColor: colors.accent50,
  border: `1px solid ${colors.accent500}55`,
  color: colors.accent700,
  fontSize: '11px',
  lineHeight: '20px',
  textAlign: 'center',
  fontWeight: 700,
};

const text: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.base,
  lineHeight: '1.5',
  color: colors.ink,
};
