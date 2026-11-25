'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as D from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { api, hasSessionCookie } from '@/lib/api';
import { cn } from '@/lib/utils';

const LINKS = [
  ['/features', 'Features'],
  ['/pricing', 'Pricing'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
] as const;

/**
 * "Open dashboard" only when the visitor really has a live session. The CSRF cookie alone is not
 * proof (it outlives the access token), so we confirm with /auth/session without redirecting.
 */
function useSignedIn() {
  const [hasCookie, setHasCookie] = React.useState(false);
  React.useEffect(() => setHasCookie(hasSessionCookie()), []);
  const q = useQuery({
    queryKey: ['session'],
    queryFn: () => api('/auth/session', { noRedirect: true }),
    enabled: hasCookie,
    retry: false,
    staleTime: 60_000,
  });
  return hasCookie && q.isSuccess;
}

export function MarketingNav() {
  const path = usePathname();
  const [open, setOpen] = React.useState(false);
  const signedIn = useSignedIn();

  React.useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" aria-label="HisabKhata home" className="rounded-sm">
          <Logo />
        </Link>
        <nav className="hidden gap-6 text-sm md:flex" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              className={cn(
                'rounded-sm text-muted-foreground transition-colors hover:text-foreground',
                path === href && 'font-medium text-foreground',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-4 md:flex">
          {signedIn ? (
            <Button asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-sm text-sm font-medium text-foreground hover:underline hover:underline-offset-4"
              >
                Sign in
              </Link>
              <Button asChild>
                <Link href="/register">Start free trial</Link>
              </Button>
            </>
          )}
        </div>

        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger className="-mr-2 ml-auto rounded-md p-2 md:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-40 bg-navy-900/40 animate-fade-in md:hidden" />
            <D.Content className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-xs flex-col border-l bg-surface shadow-xl animate-slide-in focus:outline-none md:hidden">
              <div className="flex h-16 items-center justify-between border-b px-5">
                <D.Title asChild>
                  <span>
                    <Logo />
                  </span>
                </D.Title>
                <D.Description className="sr-only">Site navigation</D.Description>
                <D.Close className="-mr-2 rounded-md p-2" aria-label="Close menu">
                  <X className="size-5" />
                </D.Close>
              </div>
              <nav className="flex-1 px-3 py-4" aria-label="Mobile">
                {LINKS.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={path === href ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-3 text-base hover:bg-muted',
                      path === href && 'bg-muted font-medium',
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="space-y-2 border-t p-5">
                {signedIn ? (
                  <Button asChild className="w-full">
                    <Link href="/dashboard">Open dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild className="w-full">
                      <Link href="/register">Start free trial</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/login">Sign in</Link>
                    </Button>
                  </>
                )}
              </div>
            </D.Content>
          </D.Portal>
        </D.Root>
      </div>
    </header>
  );
}
