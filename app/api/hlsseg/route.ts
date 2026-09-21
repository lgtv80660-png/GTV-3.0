import { requireSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "VLC/3.0.20 LibVLC/3.0.20";

export async function GET(req: Request) {
  try {
    await requireSession();
  } catch {
    return new Response("Not authenticated", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  const rawUrl = searchParams.get("url");

  let targetUrl = "";

  if (rawUrl) {
    targetUrl = decodeURIComponent(rawUrl);
  } else if (token) {
    try {
      let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) {
        base64 += "=";
      }
      targetUrl = Buffer.from(base64, "base64").toString("utf-8");
    } catch {
      return new Response("Invalid segment token", { status: 400 });
    }
  } else {
    return new Response("Segment URL/Token required", { status: 400 });
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: { "User-Agent": UA },
    });

    if (!upstreamRes.ok) {
      return new Response("Segment stream unavailable", {
        status: upstreamRes.status,
      });
    }

    // Conversion explicite en ArrayBuffer pour éviter l'erreur de lecture texte du logger Turbopack/Inspector
    const arrayBuffer = await upstreamRes.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp2t",
        "Content-Length": arrayBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(`Segment Proxy Error: ${err.message}`, { status: 502 });
  }
}