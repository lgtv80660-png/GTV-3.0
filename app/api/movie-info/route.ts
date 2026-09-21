import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const movieId = searchParams.get("id");

    if (!movieId) {
      return NextResponse.json({ error: "ID de film manquant" }, { status: 400 });
    }

    let session: any;
    try {
      session = await requireSession();
    } catch {
      return NextResponse.json({ error: "Session non autorisée" }, { status: 401 });
    }

    const host = String(session.baseUrl || session.url || session.server || "").replace(/\/+$/, "");
    const u = session.username || session.user || "";
    const p = session.password || session.pass || "";

    if (!host || !u || !p) {
      return NextResponse.json({ error: "Identifiants de session incomplets" }, { status: 400 });
    }

    const targetUrl = `${host}/player_api.php?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}&action=get_vod_info&vod_id=${encodeURIComponent(movieId)}`;

    console.log(`[MOVIE-INFO] Appel Xtream : ${host}/player_api.php?action=get_vod_info&vod_id=${movieId}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        "Accept": "*/*",
      },
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Le serveur IPTV a répondu avec le code ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[MOVIE-INFO ERROR]", err);
    return NextResponse.json(
      { error: "Impossible de joindre le serveur IPTV", details: err.message },
      { status: 504 }
    );
  }
}
