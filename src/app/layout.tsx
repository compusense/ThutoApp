import type { Metadata, Viewport } from 'next';
import './globals.css';
import './print.css';
import './ResultsSummaryPrint.css';
import './reports/results-metrics/ResultsMetricsPrint.css';
import './teacher/notes/quiz-print.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import AuthGuard from './auth-guard';
import { AppStateProvider } from '@/hooks/use-app-state';
import { ThemeProvider } from '@/components/theme-provider';

/* ── Metadata ─────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default: 'Thuto',
    template: '%s · Thuto',
  },
  description:
    'Thuto — a modern, centralized school management system for Botswana. ' +
    'Streamline administration, empower educators, and engage learners.',
  keywords: ['school management', 'Botswana', 'education', 'Thuto', 'admin'],
  authors: [{ name: 'Thuto' }],
  robots: 'noindex, nofollow', // keep private; remove when ready for public
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f1ea' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0f1a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/* ── Layout ───────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/*
          Font stack:
          - Cormorant Garamond  → display / headline (serif, elegant)
          - Outfit              → body / UI (sans-serif, modern, legible)
          - JetBrains Mono      → code blocks
          Fallbacks in tailwind.config.ts keep PT Sans & Space Grotesk
          for any component that still uses font-body / font-headline.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>

      <body
        className="font-body antialiased h-full"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppStateProvider>
            <FirebaseClientProvider>
              <AuthGuard>{children}</AuthGuard>
            </FirebaseClientProvider>
            <Toaster />
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
