import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'ifc_session';

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/kyc/webhook',
  '/api/offerings',
  '/api/orders/book',
  '/api/portfolio',
  '/api/trades',
  '/api/compliance/check',
];

function isPublic(pathname: string, method: string): boolean {
  if (pathname === '/api/offerings' && method !== 'GET') return false;
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (isPublic(pathname, req.method)) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json(
      { error: { code: 'AUTH_REQUIRED', message: 'Sesión requerida' } },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
