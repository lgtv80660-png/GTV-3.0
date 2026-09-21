import { requireSession } from "@/lib/session";
import { buildStreamUrl } from "@/lib/xtream/urls";

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
  const id = searchParams.get("id");

  if (!id) return new Response("Missing Live Stream ID", { status: 400 });

  const upstreamUrl = buildStreamUrl(creds, "live", id, "m3u8");

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
    });

    if (!upstreamRes.ok) {
      return new Response(`Upstream Live Error: ${upstreamRes.statusText}`, { status: upstreamRes.status });
    }

    // Keep the upstream base URL local so this route does not depend on a
    // missing registry module.
    const session = { baseUrl: new URL(".", upstreamUrl).toString() };
    const playlistText = await upstreamRes.text();

    const rewritten = playlistText.replace(/^(?!#)(.+)$/gm, (line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      let segUrl = trimmed;
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        segUrl = `${session.baseUrl}${trimmed}`;
      }

      // Génération du token t sans caractères bizarres dans l'URL
      const token = Buffer.from(segUrl)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      return `/api/hlsseg?t=${token}`;
    });

    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(`HLS Proxy Error: ${err.message}`, { status: 502 });
  }
}