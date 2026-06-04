import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { colors, fontFamily, fontSize } from '../theme';

export interface OnboardingStep {
  title: string;
  detail: string;
}

interface StepListProps {
  steps: OnboardingStep[];
  /** Index of the step the carer is currently on (filled, teal). Default 0. */
  activeIndex?: number;
}

/**
 * Vertical, numbered onboarding flow with a progress feel — the active step is
 * a filled teal node, upcoming steps are outlined. Bulletproof table layout.
 */
export function StepList({ steps, activeIndex = 0 }: StepListProps) {
  return (
    <Section>
      {steps.map((step, i) => {
        const active = i <= activeIndex;
        const last = i === steps.length - 1;
        return (
          <Row key={i}>
            <Column style={{ width: '36px', verticalAlign: 'top' }}>
              <div style={active ? nodeActive : nodeIdle}>{i + 1}</div>
              {!last ? <div style={active ? connectorActive : connector} /> : null}
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '14px', paddingBottom: last ? '0' : '8px' }}>
              <Text style={title}>{step.title}</Text>
              <Text style={detail}>{step.detail}</Text>
            </Column>
          </Row>
        );
      })}
    </Section>
  );
}

const nodeBase: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '9999px',
  textAlign: 'center',
  lineHeight: '26px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '13px',
};

const nodeActive: React.CSSProperties = {
  ...nodeBase,
  backgroundColor: colors.accent500,
  color: colors.white,
  border: `1px solid ${colors.accent500}`,
};

const nodeIdle: React.CSSProperties = {
  ...nodeBase,
  backgroundColor: colors.surface,
  color: colors.slate500,
  border: `1px solid ${colors.lineStrong}`,
  lineHeight: '26px',
};

const connector: React.CSSProperties = {
  width: '2px',
  height: '22px',
  backgroundColor: colors.line,
  margin: '4px auto 0',
};

const connectorActive: React.CSSProperties = {
  ...connector,
  backgroundColor: colors.accent500,
  opacity: 0.45,
};

const title: React.CSSProperties = {
  margin: '4px 0 2px',
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.base,
  color: colors.ink,
};

const detail: React.CSSProperties = {
  margin: '0 0 4px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.55',
  color: colors.slate600,
};
