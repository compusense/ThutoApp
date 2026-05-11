import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Thuto',
  description: 'A modern School Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased h-full" suppressHydrationWarning>
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
