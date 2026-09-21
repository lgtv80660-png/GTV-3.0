import { spawn } from "node:child_process";
import { requireSession } from "@/lib/session";
import type { StreamKind } from "@/lib/xtream/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "VLC/3.0.20 LibVLC/3.0.20";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export async function GET(req: Request) {
  let creds: any;
  try {
    creds = await requireSession();
  } catch {
    return new Response("Not authenticated", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") as StreamKind) || "series";
  const id = searchParams.get("id");
  const ext = searchParams.get("ext") || "mp4";
  const start = Math.max(0, Math.floor(Number(searchParams.get("t") || 0)));

  if (!type || !id) return new Response("Bad request", { status: 400 });

  const baseUrl = (creds.baseUrl || creds.host || creds.serverUrl || "").replace(/\/+$/, "");
  const username = creds.username;
  const password = creds.password;

  if (!baseUrl || !username || !password) {
    return new Response("Session / Credentials Xtream invalides", { status: 500 });
  }

  // URL source VOD (movie ou series)
  const input = `${baseUrl}/${type}/${username}/${password}/${id}.${ext}`;

  // FFmpeg Remux : Copie vidéo (0% CPU) + Audio AAC pour compatibilité web
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-probesize", "32M",
    "-analyzeduration", "32M",
    "-user_agent", UA,
    ...(start > 0 ? ["-ss", String(start)] : []),
    "-i", input,
    "-map", "0:v:0?",
    "-map", "0:a:0?",
    "-c:v", "copy",
    "-c:a", "aac",
    "-ac", "2",
    "-b:a", "128k",
    "-sn",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset",
    "-f", "mp4",
    "pipe:1",
  ];

  console.log(`[TRANSCODE] ${type}/${id} ext=${ext} t=${start} -> remuxing via ffmpeg`);
  const ff = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });

  ff.stderr.on("data", (d) => {
    const s = String(d).trim();
    if (s) console.log(`[TRANSCODE] ${type}/${id} ffmpeg: ${s}`);
  });

  const stream = new ReadableStream({
    start(controller) {
      ff.stdout.on("data", (chunk) => {
        try {
          if (controller.desiredSize !== null) {
            controller.enqueue(chunk);
          }
        } catch {}
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
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Connection": "keep-alive",
    },
  });
}