"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight, Loader2, Flame, ChevronLeft, ChevronRight } from "lucide-react";

const TMDB_API_KEY = "7b311a6f43090b24f188272bcc0655b3";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  backdrop_path?: string;
  poster_path?: string;
  media_type?: "movie" | "tv";
}

export default function LoginPage() {
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);

  // Données TMDB
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<MediaItem | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  // Formulaire de connexion
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Gestion du Drag & Scroll à la souris (Desktop style iOS)
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // 1. Récupération des contenus tendances TMDB
  useEffect(() => {
    async function loadTrending() {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const valid = data.results.filter(
            (m: MediaItem) => m.backdrop_path && m.poster_path
          );
          setMovies(valid);
          setFeaturedItem(valid[0]);
        }
      } catch (err) {
        console.error("Erreur de chargement TMDB:", err);
      }
    }
    loadTrending();
  }, []);

  // 2. Défilement au clic sur les flèches
  const scroll = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // 3. Glissement à la souris / pavé tactile (Mode Drag Desktop & Touch Mobile)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeftState(carouselRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    carouselRef.current.scrollLeft = scrollLeftState - walk;
  };

  // 4. Lancement du Trailer YouTube au clic sur un poster
  const handleItemClick = async (item: MediaItem) => {
    setFeaturedItem(item);
    try {
      const type = item.media_type === "tv" || item.name ? "tv" : "movie";
      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=videos`
      );
      const data = await res.json();

      const videos = data.videos?.results || [];
      const trailer =
        videos.find(
          (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
        ) || videos[0];

      if (trailer?.key) {
        setTrailerKey(trailer.key);
      } else {
        setTrailerKey(null);
      }
    } catch (err) {
      console.error("Erreur chargement trailer:", err);
      setTrailerKey(null);
    }
  };

  // 5. Soumission du formulaire de connexion G-TV
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Enregistrement des données utilisateur locales
        localStorage.setItem(
          "gtv_xtream_credentials",
          JSON.stringify({
            username,
            password,
            userInfo: data.user,
          })
        );

        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Identifiants incorrects ou compte expiré.");
      }
    } catch (err) {
      setError("Impossible de contacter le service de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-[#0b0e14] text-white overflow-hidden font-sans select-none flex flex-col justify-between">
      
      {/* 1. HERO BACKDROP / BANDE-ANNONCE YOUTUBE EN ARRIÈRE-PLAN */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {trailerKey ? (
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&showinfo=0&rel=0`}
            className="w-full h-full object-cover scale-125 opacity-40 transition-opacity duration-1000"
            allow="autoplay; encrypted-media"
          />
        ) : featuredItem?.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/original${featuredItem.backdrop_path}`}
            alt={featuredItem.title || featuredItem.name || "Hero Backdrop"}
            className="w-full h-full object-cover object-center transition-all duration-1000 scale-105"
          />
        ) : (
          <div className="w-full h-full bg-zinc-950 animate-pulse" />
        )}

        {/* Dégradés d'ombrage pour la lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0e14]/90 via-[#0b0e14]/60 to-[#0b0e14]/80" />
      </div>

      {/* 2. EN-TÊTE LOGO G-TV */}
      <header className="relative z-20 flex items-center justify-between px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            G
          </div>
          <span className="text-xl font-extrabold tracking-wider text-white">
            G-TV <span className="text-xs font-semibold text-zinc-400">3.0</span>
          </span>
        </div>
      </header>

      {/* 3. SECTION CENTRALE : DÉTAILS À GAUCHE & CARTE DE CONNEXION FIXE À DROITE */}
      <main className="relative z-20 flex-1 px-8 md:px-16 flex items-center justify-between gap-8 my-auto">
        
        {/* Côté Gauche : Infos sur le film/série en vedette */}
        {featuredItem && (
          <div className="hidden md:flex flex-col max-w-xl space-y-4 animate-in fade-in duration-500">
            <span className="inline-block bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-extrabold px-3 py-1 rounded-md tracking-wider uppercase w-fit">
              {featuredItem.media_type === "tv" || featuredItem.name ? "Série" : "Film"}
            </span>

            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg">
              {featuredItem.title || featuredItem.name}
            </h1>

            <p className="text-sm text-zinc-300 line-clamp-3 leading-relaxed drop-shadow">
              {featuredItem.overview || "Découvrez nos derniers contenus en haute définition."}
            </p>
          </div>
        )}

        {/* Côté Droit : Notre Formulaire de Connexion Glassmorphism */}
        <div className="w-full max-w-md ml-auto bg-zinc-950/80 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_25px_60px_rgba(0,0,0,0.95)]">
          
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              <span className="font-black text-black text-2xl">G</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wider">
              G-TV 3.0
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              Connexion à votre espace Cinéma & Direct
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium shadow-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 ml-1">
                Identifiant
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-3.5 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 ml-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-3.5 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 bg-white text-black font-bold rounded-xl flex items-center justify-center space-x-2 hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>

      {/* 4. CARROUSEL HORIZONTAL GLISSANT STYLE iOS (EN BAS DE PAGE) */}
      <footer className="relative z-20 px-8 md:px-16 pb-6 space-y-3">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Tendances & Nouveautés Cinéma</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => scroll("left")}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rail de défilement horizontal avec support du Drag & Drop tactile/souris */}
        <div
          ref={carouselRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeaveOrUp}
          onMouseUp={handleMouseLeaveOrUp}
          onMouseMove={handleMouseMove}
          className="flex space-x-4 overflow-x-auto scrollbar-none py-2 px-1 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {movies.map((item) => {
            const isSelected = featuredItem?.id === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setFeaturedItem(item)}
                onClick={() => handleItemClick(item)}
                className={`flex-none w-32 sm:w-40 aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border transition-all duration-300 cursor-pointer group relative ${
                  isSelected
                    ? "border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)] z-10"
                    : "border-white/10 hover:border-white/40 hover:scale-105"
                }`}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                  alt={item.title || item.name || "Affiche"}
                  className="w-full h-full object-cover group-hover:opacity-80 transition-opacity pointer-events-none"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                  <span className="text-[11px] font-bold text-white line-clamp-1">
                    {item.title || item.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </footer>

    </div>
  );
}