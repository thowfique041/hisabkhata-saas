import { NextResponse, type NextRequest } from 'next/server';

const PRIVATE = [
  '/dashboard',
  '/products',
  '/categories',
  '/inventory',
  '/stock-adjustments',
  '/sales',
  '/pos',
  '/purchases',
  '/suppliers',
  '/customers',
  '/expenses',
  '/invoices',
  '/reports',
  '/employees',
  '/roles',
  '/settings',
  '/subscription',
  '/profile',
  '/onboarding',
  '/super-admin',
];

/**
 * Cheap edge check for a session cookie so private pages never flash for signed-out visitors.
 * Real authorization happens on the API for every request.
 *
 * /login and /register are never redirected: the CSRF cookie outlives the access token, so its
 * presence does not prove a live session, and bouncing to /dashboard made a returning visitor wait
 * on the API before they could even see the form.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has('hk_csrf');
  if (!hasSession && PRIVATE.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|favicon.svg|icon.svg|.*\\..*).*)'] };
