'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { ConfirmProvider } from '@/components/confirm';

export function Providers({ children }: { children: React.ReactNode }) {
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
  React.useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).catch(() => undefined);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <ConfirmProvider>{children}</ConfirmProvider>
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
