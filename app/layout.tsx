import type { Metadata } from 'next';
import { Manrope, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'CareComply — Compliance that runs itself, while you run the agency',
  description:
    'CareComply is the operations platform UK domiciliary care agencies use to onboard carers, track documents, chase references, and stay CQC-ready — without spreadsheets, WhatsApp threads or guesswork.',
  openGraph: {
    title: 'CareComply — Compliance operations for UK care agencies',
    description:
      'Onboard carers, track documents, chase references, and stay CQC-ready. Live in a day. Free for 14.',
    type: 'website',
  },
};

const manrope = Manrope({
  variable: '--font-manrope',
  display: 'swap',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
