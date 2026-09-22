import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let category = searchParams.get("query") || "";

    const TMDB_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_KEY || !category) return NextResponse.json({ imageUrl: null });

    // Astuce : Si c'est "Tous les films", on cherche un film ultra populaire pour avoir un beau fond
    if (category.toLowerCase() === "tous les films") {
      category = "Inception"; 
    }

    // === FONCTION DE RECHERCHE TMDB RÉUTILISABLE ===
    const searchTMDB = async (query: string) => {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&page=1`;
      const res = await fetch(searchUrl);
      
      if (res.ok) {
        const data = await res.json();
        // On prend le premier résultat qui possède bien une image de fond (backdrop)
        const movie = data.results?.find((m: any) => m.backdrop_path);
        if (movie) {
          return `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`;
        }
      }
      return null;
    };

    // --- TENTATIVE 1 : On cherche avec le nom complet nettoyé ---
    let imageUrl = await searchTMDB(category);

    // --- TENTATIVE 2 : Si ça échoue, on cherche le premier "vrai" mot ---
    if (!imageUrl) {
      // Découpe la catégorie par espaces, slashs (/) ou tirets (-)
      const words = category.split(/[\s/\-|_]+/);
      
      // On cherche le premier mot qui fait plus de 2 lettres 
      // (ça permet d'ignorer "4K", "HD", "FR" si jamais ils sont passés)
      const firstSignificantWord = words.find(w => w.length > 2 && !["les", "des", "aux"].includes(w.toLowerCase()));
      
      if (firstSignificantWord && firstSignificantWord !== category) {
        imageUrl = await searchTMDB(firstSignificantWord);
      }
    }

    // --- TENTATIVE 3 : Ultime secours, on prend juste le tout premier mot ---
    if (!imageUrl) {
        const firstWord = category.split(/[\s/\-|_]+/)[0];
        if (firstWord && firstWord !== category) {
            imageUrl = await searchTMDB(firstWord);
        }
    }

    // RÉSULTAT FINAL (S'il ne trouve vraiment rien à l'étape 3, il renvoie null et ton interface mettra le dégradé)
    return NextResponse.json({ imageUrl: imageUrl || null });
    
  } catch (error) {
    return NextResponse.json({ imageUrl: null });
  }
}