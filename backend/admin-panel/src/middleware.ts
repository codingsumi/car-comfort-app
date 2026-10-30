import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * With basePath `/admin`, pathname here is already stripped
 * (e.g. `/login`, not `/admin/login`).
 *
 * Auth enforcement:
 *  - Public paths (login, forgot-password, reset-password, api/*) pass through.
 *  - All other paths require the `admin_session` HttpOnly cookie to be present.
 *  - Missing/absent cookie redirects to /login.
 *
 * Note: this is a presence check only — the token signature is verified by the
 * backend on every API call. The middleware prevents the HTML shell of protected
 * pages from being served to unauthenticated visitors.
 */

const COOKIE_NAME = 'admin_session';

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Next.js API routes and static assets are always public
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname === '/favicon.ico') return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect bare root to login
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!sessionToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the originally requested path so login can redirect back after auth
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
