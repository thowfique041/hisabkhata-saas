import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { getI18n } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.homeTitle, template: '%s | HisabKhata' },
    description: t.meta.homeDescription,
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = { themeColor: '#0F1E3D' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
