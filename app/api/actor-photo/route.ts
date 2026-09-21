import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ photoUrl: null, bio: "Nom manquant" }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ photoUrl: null, bio: "Clé API non configurée." });
    }

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=fr-FR`,
      { next: { revalidate: 86400 } } // Cache de 24h pour optimiser les requêtes
    );

    if (!tmdbRes.ok) {
      return NextResponse.json({ photoUrl: null, bio: "Erreur TMDB" });
    }

    const data = await tmdbRes.json();
    const person = data.results?.[0];

    if (person?.profile_path) {
      return NextResponse.json({
        photoUrl: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
        bio: person.known_for_department ? `Acteur (${person.known_for_department})` : "Information non disponible.",
      });
    }

    return NextResponse.json({ photoUrl: null, bio: "Aucune photo trouvée." });
  } catch (error) {
    return NextResponse.json({ photoUrl: null, bio: "Erreur serveur" }, { status: 500 });
  }
}