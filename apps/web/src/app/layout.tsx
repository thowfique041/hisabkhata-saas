import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'HisabKhata: inventory, POS and invoicing for Bangladeshi shops', template: '%s | HisabKhata' },
  description: 'Run your shop’s stock, sales, dues and invoices in one place. Built for retail, grocery, pharmacy and wholesale businesses in Bangladesh.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#0F1E3D' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
