import { spawn } from "node:child_process";
import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "VLC/3.0.20 LibVLC/3.0.20";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_URL || "https://gtv-30-production.up.railway.app";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "Access-Control-Allow-Origin": "*",
};

async function checkUrl(url: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.ok || res.status === 206 || res.status === 302;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type") || "movie";
    const id = searchParams.get("id");
    const originalExt = searchParams.get("ext") || "mp4";
    const t = Math.max(0, Math.floor(Number(searchParams.get("t") || 0)));

    if (!id) {
      return new Response("ID manquant", { status: 400, headers: NO_CACHE_HEADERS });
    }

    const directHost = searchParams.get("_h");
    const directUser = searchParams.get("_u");
    const directPass = searchParams.get("_p");

    let rawHost = "";
    let u = "";
    let p = "";

    // === DOUBLE LOGIQUE : VERCEL (TREMPLIN) vs RAILWAY (FFMPEG) ===
    if (directHost && directUser && directPass) {
      rawHost = decodeURIComponent(directHost);
      u = decodeURIComponent(directUser);
      p = decodeURIComponent(directPass);
    } else {
      let creds: any;
      try {
        creds = (await requireSession()) as any;
      } catch (e) {
        return new Response("Non autorisé", { status: 401, headers: NO_CACHE_HEADERS });
      }

      rawHost = creds.baseUrl || creds.url || creds.serverUrl || creds.server || creds.host || "";
      u = creds.username || creds.user || "";
      p = creds.password || creds.pass || "";

      const railwayUrl = `${RAILWAY_URL}/api/stream-vod?type=${type}&id=${id}&ext=${originalExt}&t=${t}&_h=${encodeURIComponent(rawHost)}&_u=${encodeURIComponent(u)}&_p=${encodeURIComponent(p)}`;

      console.log(`[TREMPLIN VOD] Redirection Vercel -> Railway (${type}) ID: ${id}`);
      return NextResponse.redirect(railwayUrl, { status: 302 });
    }

    if (!rawHost) {
      return new Response("URL du serveur manquante", { status: 400, headers: NO_CACHE_HEADERS });
    }

    const host = String(rawHost).replace(/\/+$/, "");
    const folder = type === "series" ? "series" : "movie";

    let inputUrl = `${host}/${folder}/${encodeURIComponent(u)}/${encodeURIComponent(p)}/${id}.${originalExt}`;

    let isOk = await checkUrl(inputUrl);
    if (!isOk) {
      const fallbacks = ["mp4", "mkv", "avi", "ts"].filter((e) => e !== originalExt);
      for (const altExt of fallbacks) {
        const altUrl = `${host}/${folder}/${encodeURIComponent(u)}/${encodeURIComponent(p)}/${id}.${altExt}`;
        if (await checkUrl(altUrl)) {
          inputUrl = altUrl;
          break;
        }
      }
    }

    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-user_agent", UA,
      ...(t > 0 ? ["-ss", String(t)] : []),
      "-i", inputUrl,
      "-c:v", "copy",
      "-c:a", "aac",
      "-ac", "2",
      "-b:a", "192k",
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
      "-f", "mp4",
      "pipe:1",
    ];

    const ff = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });

    const stream = new ReadableStream({
      start(controller) {
        ff.stdout.on("data", (chunk) => {
          try { if (controller.desiredSize !== null) controller.enqueue(chunk); } catch {}
        });
        ff.stdout.on("end", () => {
          try { controller.close(); } catch {}
        });
        ff.on("error", (err) => {
          try { controller.error(err); } catch {}
        });
      },
      cancel() {
        if (!ff.killed) ff.kill("SIGKILL");
      },
    });

    req.signal.addEventListener("abort", () => {
      if (!ff.killed) ff.kill("SIGKILL");
    });

    return new Response(stream, {
      headers: { "content-type": "video/mp4", ...NO_CACHE_HEADERS },
    });
  } catch (err: any) {
    return new Response(`Erreur VOD: ${err.message}`, { status: 500, headers: NO_CACHE_HEADERS });
  }
}