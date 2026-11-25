'use client';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Runs `fn` when the URL carries `?new=1` (from the command palette or a link), then removes the
 * flag so the same action can be triggered again while staying on the page.
 */
export function useNewIntent(fn: () => void, enabled = true) {
  useUrlIntent('new', () => fn(), enabled);
}

/** Runs `fn(value)` once for `?<name>=<value>` (for example `?open=<id>`), then strips it. */
export function useUrlIntent(name: string, fn: (value: string) => void, enabled = true) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flag = params.get(name);
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => {
    if (!flag || !enabled) return;
    ref.current(flag);
    const next = new URLSearchParams(params.toString());
    next.delete(name);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [flag, enabled, name, params, pathname, router]);
}

/** Keeps a list filter in sync with a query parameter, so alert links open the right view. */
export function useUrlFilter(name: string, fallback: string, apply: (v: string) => void) {
  const value = useSearchParams().get(name) ?? fallback;
  const ref = React.useRef(apply);
  ref.current = apply;
  React.useEffect(() => {
    ref.current(value);
  }, [value]);
  return value;
}
