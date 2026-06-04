import * as React from 'react';
import {
  Html,
  Head,
  Font,
  Preview,
  Body,
  Container,
  Section,
} from '@react-email/components';
import { colors, fontFamily, spacing } from '../theme';

interface EmailLayoutProps {
  /** Text shown in the inbox preview line (preheader). */
  preview: string;
  children: React.ReactNode;
}

/**
 * The shared shell for every CareComply email: document, web-font loading,
 * inbox preheader, page background and the centred 600px column.
 * Compose your template inside it.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <Font
          fontFamily="Manrope"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggexSg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Manrope"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggexSg.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Manrope"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggexSg.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Section style={pagePad}>
          <Container style={container}>{children}</Container>
        </Section>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: colors.surfacePage,
  fontFamily: fontFamily.sans,
  WebkitFontSmoothing: 'antialiased',
};

const pagePad: React.CSSProperties = {
  padding: `${spacing.outerY} 20px`,
};

const container: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
};
