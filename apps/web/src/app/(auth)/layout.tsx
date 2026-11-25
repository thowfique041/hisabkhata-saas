import Link from 'next/link';
import { Logo } from '@/components/logo';
import { LanguageSwitcher } from '@/components/marketing/language-switcher';
import { ThemeToggle } from '@/components/marketing/theme-toggle';
import { getI18n } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-5">
        <Link href="/" aria-label={t.nav.home} className="rounded-sm">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
