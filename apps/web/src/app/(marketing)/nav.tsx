'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { hasSessionCookie } from '@/lib/api';
import { cn } from '@/lib/utils';

const LINKS = [
  ['/features', 'Features'],
  ['/pricing', 'Pricing'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

export function MarketingNav() {
  const path = usePathname();
  const [open, setOpen] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(false);
  React.useEffect(() => setSignedIn(hasSessionCookie()), []);
  return (
    <header className="sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" aria-label="HisabKhata home">
          <Logo />
        </Link>
        <nav className="hidden gap-6 text-sm md:flex" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={cn('text-muted-foreground hover:text-foreground', path === href && 'font-medium text-foreground')}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Start free</Link>
              </Button>
            </>
          )}
        </div>
        <button className="ml-auto rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="space-y-1 border-t px-6 py-3 md:hidden" aria-label="Mobile">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="block py-2 text-sm" onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href={signedIn ? '/dashboard' : '/login'} className="block py-2 text-sm font-medium">
            {signedIn ? 'Open dashboard' : 'Sign in'}
          </Link>
        </nav>
      )}
    </header>
  );
}
