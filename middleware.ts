import {NextRequest, NextResponse} from 'next/server';
import {getToken} from 'next-auth/jwt';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import {getNextAuthSecret} from './lib/auth-secret';

const handleI18nRouting = createMiddleware(routing);

function resolveLocale(pathname: string) {
  const candidate = pathname.split('/')[1];
  const isSupportedLocale = (routing.locales as readonly string[]).includes(candidate);
  return isSupportedLocale ? candidate : routing.defaultLocale;
}

export default async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Check if the page is public (login)
  const isPublicPage = pathname.endsWith('/login') || pathname.includes('/login/');

  const token = await getToken({
    req: request,
    secret: getNextAuthSecret(),
  });

  // A session only grants access to the tenant app if it belongs to a tenant
  // user with a tenantId. Admin sessions (tenantId always null) and orphaned
  // tenant accounts (missing tenantId) don't qualify, even though a session exists.
  const isValidTenantSession = Boolean(token) && token?.role !== 'admin' && Boolean(token?.tenantId);

  // No valid tenant session and not on the login page: send to tenant login.
  if (!isPublicPage && !isValidTenantSession) {
    const locale = resolveLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // Already has a valid tenant session and is on the login page: skip straight to the app.
  if (isPublicPage && isValidTenantSession) {
    const locale = resolveLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/`, request.url));
  }

  // Forward the current pathname to Server Components via a request header —
  // layouts (e.g. the dashboard layout's on-prem license guard) don't otherwise
  // have access to it, and need it to avoid redirecting /settings back to itself.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-pathname', pathname);
  const withPathname = NextResponse.next({ request: { headers: forwardedHeaders } });

  const intlResponse = handleI18nRouting(request);
  if (intlResponse.headers.get('location')) {
    // next-intl decided to redirect (e.g. bare "/" to the default locale) —
    // no Server Component render happens for this response.
    return intlResponse;
  }
  intlResponse.headers.forEach((value, key) => {
    withPathname.headers.set(key, value);
  });
  return withPathname;
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(fr|en)/:path*']
};
