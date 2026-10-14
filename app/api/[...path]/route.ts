import {publicData} from '@/lib/security-json';
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendBase(path: string[]) {
  // Local VOD testing only. Builds and all other APIs keep the production backend.
  const testVod = process.env.NODE_ENV === "development" &&
    ["vod-hls", "vod-hls-seg"].includes(path[0]);
  const value = (testVod ? process.env.GTV_VOD_TEST_BACKEND_URL : undefined) ||
    process.env.RAILWAY_BACKEND_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
  if (!value) throw new Error("RAILWAY_BACKEND_URL is not configured");
  return value.replace(/\/+$/, "");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const target = new URL(`${backendBase(path)}/api/${path.join("/")}`);
    if (['_h','_u','_p','username','password'].some(k=>request.nextUrl.searchParams.has(k)))return NextResponse.json({error:'Credentials URL refusés'},{status:400});
    request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

    // Preserve byte offsets and resource size only for VOD media responses.
    const isVodMedia = ["vod-direct", "stream-vod", "vod-hls", "vod-hls-seg"].includes(path[0]);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.delete('authorization');
    const sid=request.cookies.get('gtv_session')?.value;
    headers.set('cookie',sid&&/^[A-Za-z0-9_-]{43}$/.test(sid)?'gtv_session='+sid:'');
    headers.set("x-gtv-gateway", "cloudflare");
    if (isVodMedia) headers.set("accept-encoding", "identity");

    const upstreamAbort=new AbortController();
    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal:AbortSignal.any([request.signal,upstreamAbort.signal]),
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(target, init);
    const setCookie=upstream.headers.get('set-cookie')||'';
    const match=/(?:^|,\s*)gtv_session=([^;]*)/.exec(setCookie);
    if(match){let value='';try{value=decodeURIComponent(match[1]);}catch{}if(value&&!/^[A-Za-z0-9_-]{43}$/.test(value)){await upstream.body?.cancel();const denied=NextResponse.json({error:'Backend de session incompatible'},{status:502,headers:{'Cache-Control':'no-store'}});denied.cookies.set('gtv_session','',{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:0});return denied;}}
    const responseHeaders = new Headers(upstream.headers);
    // The production backend's Secure cookie cannot be used over local HTTP.
    // Keep this exception restricted to the explicit loopback runtime.
    if (process.env.GTV_LOCAL_RUNTIME === '1' &&
        ['http://127.0.0.1:3200', 'http://localhost:3200'].includes(new URL(request.url).origin) &&
        target.origin === 'http://127.0.0.1:3201' && match) {
      responseHeaders.delete('set-cookie');
      for (const cookie of upstream.headers.getSetCookie()) {
        responseHeaders.append('set-cookie', cookie.startsWith('gtv_session=')
          ? cookie.replace(/;\s*Secure\b/gi, '').replace(/;\s*Domain=[^;]*/gi, '')
          : cookie);
      }
    }
    // fetch may decode compressed bodies: their original length is then invalid.
    const encoding = upstream.headers.get("content-encoding");
    if (!isVodMedia || (encoding && encoding.toLowerCase() !== "identity")) {
      responseHeaders.delete("content-length");
    }
    responseHeaders.delete("content-encoding");
    responseHeaders.set('Cache-Control','no-store');responseHeaders.set('Referrer-Policy','no-referrer');
    const location=responseHeaders.get('location');if(location){const u=new URL(location,target);if(u.origin!==target.origin||!u.pathname.startsWith('/api/')||['_h','_u','_p','username','password'].some(k=>u.searchParams.has(k)))return NextResponse.json({error:'Redirection refusée'},{status:502});responseHeaders.set('location',u.pathname+u.search);}
    responseHeaders.set("x-gtv-backend", "railway");

    let body:BodyInit|null;
    if(upstream.headers.get('content-type')?.includes('application/json'))body=JSON.stringify(publicData(await upstream.json()));
    else if(upstream.body){
      const reader=upstream.body.getReader();
      body=new ReadableStream<Uint8Array>({async pull(controller){try{const next=await reader.read();if(next.done)controller.close();else controller.enqueue(next.value);}catch{controller.error(new Error('Media unavailable'));}},async cancel(){upstreamAbort.abort();await reader.cancel().catch(()=>{});}});
    }else body=null;
    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // Never log upstream URLs or errors containing credentials.
    return NextResponse.json(
      { error: "Backend Railway indisponible" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
