import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SESSION_COOKIE = 'ft-session';

function verifyTokenInMiddleware(token: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return sig === expected;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin pages (not login) — require session
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !verifyTokenInMiddleware(token)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Admin API routes — require session
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !verifyTokenInMiddleware(token)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
