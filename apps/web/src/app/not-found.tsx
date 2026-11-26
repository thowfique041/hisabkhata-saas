import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata = { title: 'Page not found' };

/** Shown for any address that does not exist, instead of the framework's bare 404. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Link href="/" aria-label="HisabKhata home">
        <Logo />
      </Link>
      <div className="space-y-2">
        <p className="num text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The address may be mistyped, or the page has moved. এই পেজটি খুঁজে পাওয়া যায়নি।
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md border border-input bg-surface px-4 text-sm font-medium hover:bg-muted"
        >
          Home page
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
