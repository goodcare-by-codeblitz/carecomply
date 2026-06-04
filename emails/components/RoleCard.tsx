import * as React from 'react';
import { Section, Row, Column, Text, Hr } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface RoleCardProps {
  organizationName: string;
  inviterName: string;
  roleName: string;
  roleDescription?: string;
  expiryTime: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Inset "access summary" card: org identity, role pill, who invited them and
 * when access expires. The trust anchor of the team invitation email.
 */
export function RoleCard({
  organizationName,
  inviterName,
  roleName,
  roleDescription,
  expiryTime,
}: RoleCardProps) {
  return (
    <Section style={card}>
      <Row>
        <Column style={{ width: '44px', verticalAlign: 'middle' }}>
          <div style={avatar}>{initials(organizationName)}</div>
        </Column>
        <Column style={{ verticalAlign: 'middle', paddingLeft: '14px' }}>
          <Text style={orgLabel}>ORGANISATION</Text>
          <Text style={orgName}>{organizationName}</Text>
        </Column>
      </Row>

      <Hr style={divider} />

      <Row>
        <Column style={{ verticalAlign: 'top', width: '50%' }}>
          <Text style={fieldLabel}>YOUR ROLE</Text>
          <span style={pill}>{roleName}</span>
        </Column>
        <Column style={{ verticalAlign: 'top', width: '50%' }}>
          <Text style={fieldLabel}>INVITED BY</Text>
          <Text style={fieldValue}>{inviterName}</Text>
        </Column>
      </Row>

      {roleDescription ? <Text style={roleDesc}>{roleDescription}</Text> : null}

      <Hr style={divider} />

      <Row>
        <Column>
          <Text style={fieldLabel}>ACCESS EXPIRES</Text>
          <Text style={expiry}>{expiryTime}</Text>
        </Column>
      </Row>
    </Section>
  );
}

const card: React.CSSProperties = {
  backgroundColor: colors.surfacePage,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '28px 0',
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
  letterSpacing: '-0.01em',
};

const orgLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const orgName: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.02em',
  color: colors.ink,
};

const divider: React.CSSProperties = {
  borderColor: colors.line,
  margin: '18px 0',
};

const fieldLabel: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const fieldValue: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.md,
  color: colors.ink,
};

const pill: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: colors.brand50,
  color: colors.brand700,
  border: `1px solid ${colors.brand100}`,
  borderRadius: radius.full,
  padding: '4px 11px',
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.xs,
};

const roleDesc: React.CSSProperties = {
  margin: '16px 0 0',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.6',
  color: colors.slate600,
};

const expiry: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.md,
  color: colors.ink,
};
