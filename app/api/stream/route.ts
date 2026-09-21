import { requireSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "VLC/3.0.20 LibVLC/3.0.20";

export async function GET(req: Request) {
  let creds: any;
  try {
    creds = await requireSession();
  } catch {
    return new Response("Not authenticated", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "live";
  const id = searchParams.get("id");
  const ext = searchParams.get("ext") || "ts";

  if (!id) return new Response("Bad request", { status: 400 });

  const baseUrl = (creds.baseUrl || creds.host || creds.serverUrl || "").replace(/\/+$/, "");
  const username = creds.username;
  const password = creds.password;

  const targetUrl = `${baseUrl}/${type}/${username}/${password}/${id}.${ext}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: { "User-Agent": UA },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Flux indisponible", { status: upstream.status });
    }

    return new Response(upstream.body as any, {
      status: 200,
      headers: {
        "Content-Type": ext === "m3u8" ? "application/x-mpegURL" : "video/mp2t",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response("Erreur de connexion au serveur IPTV", { status: 500 });
  }
}