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

  if (!id) {
    return new Response("Missing Live Stream ID", { status: 400 });
  }

  const upstreamUrl = buildStreamUrl(creds, "live", id, "m3u8");

  try {
    const safeUrl = new URL(upstreamUrl);

    console.log("===== HLS REQUEST =====");
    console.log("stream id:", id);
    console.log("protocol:", safeUrl.protocol);
    console.log("host:", safeUrl.host);
    console.log("pathname ending:", safeUrl.pathname.slice(-40));

    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        Connection: "keep-alive",
      },
      redirect: "follow",
      cache: "no-store",
    });

    console.log("===== HLS UPSTREAM RESPONSE =====");
    console.log("status:", upstreamRes.status);
    console.log("statusText:", upstreamRes.statusText);
    console.log("content-type:", upstreamRes.headers.get("content-type"));
    console.log("final url:", upstreamRes.url);

    if (!upstreamRes.ok) {
      const body = await upstreamRes.text().catch(() => "");

      console.error("HLS upstream HTTP error:", {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        body: body.slice(0, 500),
      });

      return new Response(
        `Upstream Live Error: ${upstreamRes.status} ${upstreamRes.statusText}`,
        {
          status: 502,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const playlistText = await upstreamRes.text();

    if (!playlistText) {
      console.error("HLS playlist is empty");

      return new Response("HLS Proxy Error: empty playlist", {
        status: 502,
      });
    }

    console.log("playlist length:", playlistText.length);
    console.log(
      "playlist preview:",
      playlistText.slice(0, 200).replace(/\n/g, " ")
    );

    const rewritten = playlistText.replace(/^(?!#)(.+)$/gm, (line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      let segUrl: string;

      try {
        segUrl = new URL(trimmed, upstreamRes.url || upstreamUrl).toString();
      } catch (err) {
        console.error("Invalid HLS segment URL:", trimmed);
        return line;
      }

      const token = Buffer.from(segUrl, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

      return `/api/hlsseg?t=${token}`;
    });

    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("===== HLS FETCH ERROR =====");
    console.error("message:", err?.message);
    console.error("name:", err?.name);
    console.error("cause:", err?.cause);
    console.error("cause message:", err?.cause?.message);
    console.error("code:", err?.cause?.code);
    console.error("errno:", err?.cause?.errno);
    console.error("address:", err?.cause?.address);
    console.error("port:", err?.cause?.port);

    try {
      const u = new URL(upstreamUrl);

      console.error("protocol:", u.protocol);
      console.error("host:", u.host);
      console.error("pathname ending:", u.pathname.slice(-40));
    } catch {}

    const detail =
      err?.cause?.code ||
      err?.cause?.message ||
      err?.message ||
      "unknown fetch error";

    return new Response(`HLS Proxy Error: ${detail}`, {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}