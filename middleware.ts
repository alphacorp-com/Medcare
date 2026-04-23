import {NextRequest, NextResponse} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const token = request.cookies.get('auth-token');

  // Check if the page is public (login)
  const isPublicPage = pathname.endsWith('/login') || pathname.includes('/login/');

  // If no token and not a public page, redirect to login
  if (!token && !isPublicPage) {
    // Attempt to extract locale from path or use default
    const locale = pathname.split('/')[1];
    const isSupportedLocale = routing.locales.includes(locale as any);
    const targetLocale = isSupportedLocale ? locale : routing.defaultLocale;
    
    return NextResponse.redirect(new URL(`/${targetLocale}/login`, request.url));
  }

  // If token and on login page, redirect to dashboard
  if (token && isPublicPage) {
    const locale = pathname.split('/')[1];
    const isSupportedLocale = routing.locales.includes(locale as any);
    const targetLocale = isSupportedLocale ? locale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${targetLocale}/`, request.url));
  }

  return handleI18nRouting(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(fr|en)/:path*']
};
