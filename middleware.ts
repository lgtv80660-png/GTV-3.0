import { NextRequest, NextResponse } from 'next/server';
const validToken = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);
async function validateAtAuthority(token: string) { const raw = process.env.RAILWAY_BACKEND_URL || process.env.NEXT_PUBLIC_RAILWAY_URL; if (!raw)
    throw Error('SESSION_UNAVAILABLE'); const base = new URL(raw); if (base.username || base.password || (process.env.NODE_ENV === 'production' && base.protocol !== 'https:' && !(process.env.GTV_LOCAL_RUNTIME==='1' && base.origin==='http://127.0.0.1:3201' && base.pathname==='/' && !base.search && !base.hash)))
    throw Error('SESSION_UNAVAILABLE'); const r = await fetch(new URL('/api/auth', base), { headers: { Cookie: 'gtv_session=' + token }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) }); if (!r.ok)
    throw Error('SESSION_INVALID'); const v = await r.json(); if (v.authenticated !== true)
    throw Error('SESSION_INVALID'); }
import { csrfAllowed, privateHeaders } from './lib/security';
export async function middleware(req: NextRequest) {
    const p = req.nextUrl.pathname;
    if (p.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !csrfAllowed(req))
        return NextResponse.json({ error: 'Origine refusée' }, { status: 403, headers: privateHeaders });
    if (p.startsWith('/api/') && ['_h', '_u', '_p', 'username', 'password'].some(k => req.nextUrl.searchParams.has(k)))
        return NextResponse.json({ error: 'Credentials URL refusés' }, { status: 400, headers: privateHeaders });
    if (p.startsWith('/_next/') || /\.[a-z0-9]+$/i.test(p) && !p.startsWith('/api/'))
        return NextResponse.next();
    const raw = req.cookies.get('gtv_session')?.value;
    let authenticated = false;
    try {
        if (validToken(raw)) {
            await validateAtAuthority(raw);
            authenticated = true;
        }
    }
    catch { /* Fail closed: no stale credential cookie fallback. */ }
    if (p === '/login')
        return NextResponse.next();
    if (['/api/login', '/api/auth', '/api/logout'].includes(p))
        return NextResponse.next();
    if (!authenticated) {
        const r = p.startsWith('/api/') ? NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: privateHeaders }) : NextResponse.redirect(new URL('/login', req.url));
        if (raw && !validToken(raw))
            r.cookies.set('gtv_session', '', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 });
        return r;
    }
    return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
