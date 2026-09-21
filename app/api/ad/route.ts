import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const media = searchParams.get("media") || "movie";
  const slot = searchParams.get("slot");

  // Domaine et hôte AlwaysData par défaut
  const ALWAYS_DATA_DOMAIN = "https://gmz.alwaysdata.net";
  const baseUrl = process.env.PHP_ADSERVER_URL || `${ALWAYS_DATA_DOMAIN}/api.php`;

  let phpApiUrl = `${baseUrl}?media=${encodeURIComponent(media)}`;
  if (slot) {
    phpApiUrl += `&slot=${encodeURIComponent(slot)}`;
  }

  try {
    const res = await fetch(phpApiUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ status: "empty", message: "AdServer indisponible" });
    }

    // Lecture du JSON distant
    const data = await res.json();

    // Normalisation de l'URL de la vidéo publicitaire
    if (data?.ad?.video_url) {
      let rawUrl = data.ad.video_url;
      if (!rawUrl.startsWith("http")) {
        rawUrl = `${ALWAYS_DATA_DOMAIN}/${rawUrl.replace(/^\//, "")}`;
      } else {
        rawUrl = rawUrl.replace(/^http:\/\//i, "https://");
      }
      data.ad.video_url = rawUrl;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      status: "empty",
      message: "Erreur lors du traitement de la publicité",
    });
  }
}