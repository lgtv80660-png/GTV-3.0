import { requireSession } from "@/lib/session";
import { buildStreamUrl } from "@/lib/xtream/urls";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let sessionData: any;
  try {
    sessionData = await requireSession();
  } catch {
    return new Response("Non authentifié", { status: 401 });
  }

  const creds = sessionData?.user || sessionData;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "series";
  const id = searchParams.get("id");
  const ext = searchParams.get("ext") || "mkv";

  if (!id) return new Response("ID manquant", { status: 400 });

  // Sécurité : Vérification et reconstruction stricte de l'URL du fournisseur IPTV
  const upstreamUrl = buildStreamUrl(creds, type, id, ext);

  // Vérification que l'URL ne pointe pas sur Vercel
  if (upstreamUrl.includes("vercel.app")) {
    console.error("Erreur de configuration baseUrl Xtream:", upstreamUrl);
    return new Response("Configuration du serveur Xtream invalide", { status: 500 });
  }

  console.log("Lecture du flux source IPTV :", upstreamUrl);

  const ffmpeg = spawn("ffmpeg", [
    "-headers", "User-Agent: VLC/3.0.20 LibVLC/3.0.20\r\n",
    "-i", upstreamUrl,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1"
  ]);

  const stream = new ReadableStream({
    start(controller) {
      ffmpeg.stdout.on("data", (chunk) => controller.enqueue(chunk));
      ffmpeg.stdout.on("end", () => controller.close());
      ffmpeg.stderr.on("data", (data) => console.log("FFmpeg stderr:", data.toString()));
      ffmpeg.on("error", (err) => controller.error(err));
    },
    cancel() {
      ffmpeg.kill("SIGKILL");
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}