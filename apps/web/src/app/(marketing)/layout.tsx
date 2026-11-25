import Link from 'next/link';
import { Logo } from '@/components/logo';
import { LanguageSwitcher } from '@/components/marketing/language-switcher';
import { ThemeToggle } from '@/components/marketing/theme-toggle';
import { site } from '@/config/site';
import { getI18n } from '@/lib/i18n/server';
import { MarketingNav } from './nav';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const link = 'rounded-sm text-muted-foreground transition-colors hover:text-foreground';
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 md:grid-cols-[1.4fr_auto_auto_auto] md:gap-14">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.tagline}</p>
            <div className="mt-5 flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
          <nav className="flex flex-col gap-2.5 text-sm" aria-label={t.footer.product}>
            <p className="font-medium">{t.footer.product}</p>
            <Link href="/features" className={link}>
              {t.nav.features}
            </Link>
            <Link href="/pricing" className={link}>
              {t.nav.pricing}
            </Link>
            <Link href="/register" className={link}>
              {t.footer.createAccount}
            </Link>
          </nav>
          <nav className="flex flex-col gap-2.5 text-sm" aria-label={t.footer.company}>
            <p className="font-medium">{t.footer.company}</p>
            <Link href="/about" className={link}>
              {t.nav.about}
            </Link>
            <Link href="/contact" className={link}>
              {t.nav.contact}
            </Link>
            <Link href="/login" className={link}>
              {t.nav.signIn}
            </Link>
          </nav>
          {site.social.length > 0 && (
            <nav className="flex flex-col gap-2.5 text-sm" aria-label={t.footer.followUs}>
              <p className="font-medium">{t.footer.followUs}</p>
              {site.social.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        <p className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} HisabKhata. {t.footer.madeIn}
        </p>
      </footer>
    </div>
  );
}
