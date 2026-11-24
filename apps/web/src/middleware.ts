import { NextResponse, type NextRequest } from 'next/server';

const PRIVATE = ['/dashboard', '/products', '/categories', '/inventory', '/stock-adjustments', '/sales', '/pos', '/purchases', '/suppliers', '/customers', '/expenses', '/invoices', '/reports', '/employees', '/roles', '/settings', '/subscription', '/profile', '/onboarding', '/super-admin'];
const AUTH_PAGES = ['/login', '/register'];

/**
 * Cheap edge check for a session cookie so private pages never flash for signed-out visitors.
 * Real authorization happens on the API for every request.
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
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|favicon.svg|icon.svg|.*\\..*).*)'] };
