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
  const type = searchParams.get("type") || "series";
  const id = searchParams.get("id");
  const ext = searchParams.get("ext") || "mp4";

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
      return new Response("Video VOD indisponible", { status: upstream.status });
    }

    return new Response(upstream.body as any, {
      status: 200,
      headers: {
        "Content-Type": `video/${ext === "mkv" ? "x-matroska" : "mp4"}`,
        "Cache-Control": "no-cache",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return new Response("Erreur de flux VOD", { status: 500 });
  }
}