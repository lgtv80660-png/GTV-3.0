import { requireSession } from "@/lib/session";
import { buildStreamUrl } from "@/lib/xtream/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "VLC/3.0.20 LibVLC/3.0.20";

export async function GET(req: Request) {
  let sessionData: any;
  try {
    sessionData = await requireSession();
  } catch {
    return new Response("Not authenticated", { status: 401 });
  }

  const creds = sessionData?.user || sessionData;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "movie";
  const id = searchParams.get("id");
  const ext = searchParams.get("ext") || "mp4";

  if (!id) return new Response("Missing Stream ID", { status: 400 });

  // Construction de l'URL brute vers le serveur IPTV Xtream
  const targetUrl = buildStreamUrl(creds, type, id, ext);

  // Transmission des headers de Range envoyés par le navigateur
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
  };

  const range = req.headers.get("range");
  if (range) {
    headers["Range"] = range;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers,
      redirect: "follow",
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response(`Upstream Stream Error: ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const responseHeaders = new Headers();
    
    // Transmission des headers essentiels pour la lecture HTML5
    const forwardHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ];

    forwardHeaders.forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(upstreamRes.body as any, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(`Stream Proxy Error: ${err.message}`, { status: 502 });
  }
}