import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { classifyBot, classifyByHeaders, isMaliciousPath } from '@/lib/analytics/bots';

const SESSION_COOKIE = 'ft-session';

function verifyHmacToken(token: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  try {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block .php requests — always bot probes
  if (pathname.endsWith('.php')) {
    return new NextResponse(null, { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  }

  // Block malicious paths (WordPress probes, .env, etc.)
  if (isMaliciousPath(pathname)) {
    return new NextResponse(null, { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  }

  // Admin pages (not login) — require session
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !verifyHmacToken(token)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Admin API routes — require session
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !verifyHmacToken(token)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  // --- Analytics tracking ---
  const userAgent = request.headers.get('user-agent') || '';

  // Skip tracking for admin pages, API routes, empty UAs
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/') && userAgent) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    // Classify bot: UA match → 3, missing browser headers → 2, default → 1
    const bot = classifyBot(userAgent);
    let botScore = 1;
    if (bot.isBot) {
      botScore = 3;
    } else {
      const headerScore = classifyByHeaders(request.headers);
      if (headerScore > 0) botScore = headerScore;
    }

    // Extract referrer (only external)
    const refHeader = request.headers.get('referer') || '';
    let referrer: string | undefined;
    try {
      if (refHeader) {
        const refUrl = new URL(refHeader);
        const reqHost = request.nextUrl.host;
        if (refUrl.host !== reqHost) {
          referrer = refHeader;
        }
      }
    } catch {
      // Invalid referrer URL — ignore
    }

    // Fire-and-forget to internal tracking API (avoids importing Node.js-only modules)
    const trackUrl = new URL('/api/analytics/track', request.url);
    fetch(trackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, ip, userAgent, referrer, botScore }),
    }).catch(() => {});
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
