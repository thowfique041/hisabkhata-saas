'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { wakeApi } from '@/lib/wake';
import { I18nProvider } from '@/lib/i18n/client';
import type { Locale } from '@/lib/i18n';
import { ConfirmProvider } from '@/components/confirm';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  // Wake the API (a free instance sleeps when idle) while the visitor is still reading the page.
  React.useEffect(() => wakeApi(), []);
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <I18nProvider locale={locale}>
          <TooltipProvider delayDuration={200}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </TooltipProvider>
        </I18nProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
