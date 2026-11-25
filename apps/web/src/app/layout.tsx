import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { getI18n } from '@/lib/i18n/server';
import { site } from '@/config/site';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    title: { default: t.meta.homeTitle, template: '%s | HisabKhata' },
    description: t.meta.homeDescription,
    metadataBase: new URL(site.url),
    applicationName: 'HisabKhata',
    alternates: { canonical: '/' },
    icons: { icon: '/favicon.svg', apple: '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: 'HisabKhata', statusBarStyle: 'default' },
    openGraph: {
      type: 'website',
      siteName: 'HisabKhata',
      title: t.meta.homeTitle,
      description: t.meta.homeDescription,
      url: '/',
      locale: locale === 'bn' ? 'bn_BD' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.homeTitle,
      description: t.meta.homeDescription,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F1E3D' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1526' },
  ],
};

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
