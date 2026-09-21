import { NextRequest, NextResponse } from "next/server";

// Hôte Xtream sécurisé côté serveur (Totalement masqué pour le client)
const XTREAM_HOST = process.env.XTREAM_HOST || "https://gmztv.vercel.app";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get("username");
  const password = searchParams.get("password");
  const action = searchParams.get("action");
  const categoryId = searchParams.get("category_id");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Identifiant et mot de passe requis" },
      { status: 400 }
    );
  }

  try {
    let targetUrl = `${XTREAM_HOST}/player_api.php?username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`;

    if (action && action !== "auth") {
      targetUrl += `&action=${action}`;
      if (categoryId) targetUrl += `&category_id=${categoryId}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Erreur de réponse du serveur distant" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur de communication avec le serveur Xtream" },
      { status: 500 }
    );
  }
}