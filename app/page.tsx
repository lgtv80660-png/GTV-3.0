"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Film, 
  Tv, 
  Radio, 
  Play, 
  Plus, 
  Info,
  ChevronRight,
  Clock,
  Heart,
  Loader2
} from "lucide-react";
import { cleanName, cn } from "@/lib/utils";
import { useLibrary } from "@/store/library";

/* =========================================================
   TYPES & ANIMATIONS
========================================================= */

type LastWatched = {
  id: number | string;
  title: string;
  poster: string;
  progress: number;
  type: "movie" | "series" | "live";
};

const slideVariants: Variants = {
  enter: { opacity: 0, scale: 1.05 },
  center: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.8 }
  }
};

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } }
};

/* =========================================================
   COMPOSANT PAGE D'ACCUEIL
========================================================= */

export default function HomePage() {
  const router = useRouter();
  const { favorites } = useLibrary();
  
  const [lastWatched, setLastWatched] = useState<LastWatched | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // 1. REQUÊTE API : Récupère TES films depuis ton serveur IPTV
  const { data: allMovies, isLoading: isLoadingMovies } = useQuery({
    queryKey: ["hero-movies"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_vod_streams");
      if (!res.ok) throw new Error("Erreur réseau");
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // Garde en cache 10 min pour fluidifier la navigation
  });

  // 2. PRÉPARATION DU HERO BANNER : Prendre 5 films (idéalement ceux avec un logo ou bien notés)
  const heroSlides = useMemo(() => {
    if (!allMovies || !Array.isArray(allMovies)) return [];
    
    // On prend les 15 premiers, on filtre ceux sans image, et on en garde 5 pour le slider
    const validMovies = allMovies
      .filter((m: any) => m.stream_icon && m.stream_icon.startsWith("http"))
      .slice(0, 5);

    return validMovies.map((movie: any) => ({
      id: movie.stream_id,
      title: cleanName(movie.name),
      subtitle: `Ajout Récent • ${movie.rating ? `Note: ${movie.rating}/10` : "Film"}`,
      description: "Plongez dans ce contenu exceptionnel directement depuis votre catalogue premium G-TV.",
      image: movie.stream_icon,
      badge: "Inclus dans votre abonnement",
      link: `/movies/${movie.stream_id}` // ➔ LIEN DIRECT VERS LA PAGE DU FILM
    }));
  }, [allMovies]);

  // Rotation automatique du Hero Banner
  useEffect(() => {
    if (heroSlides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Historique de lecture
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gtv_last_watched");
      if (stored) {
        setLastWatched(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erreur lecture last_watched", e);
    }
  }, []);

  const favItems = Object.values(favorites).slice(0, 8); // Afficher jusqu'à 8 favoris
  const activeSlide = heroSlides[currentSlide];

  return (
    <main className="min-h-[100dvh] bg-[#060608] text-white overflow-x-hidden relative pb-24 font-sans">
      
      {/* =========================================================
          HERO BANNER DYNAMIQUE (BRANCHE SUR TON API)
      ========================================================= */}
      <div className="relative w-full h-[75vh] min-h-[600px] lg:h-[85vh] select-none bg-[#0d0d12]">
        
        {isLoadingMovies ? (
          // État de chargement élégant
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-white/20" />
          </div>
        ) : activeSlide ? (
          <>
            {/* Images avec fondu croisé */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentSlide}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0 z-0"
              >
                <img 
                  src={activeSlide.image} 
                  alt={activeSlide.title}
                  className="w-full h-full object-cover object-top opacity-70"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </motion.div>
            </AnimatePresence>

            {/* Dégradés superposés pour lisibilité du texte */}
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#060608] via-[#060608]/80 to-transparent w-[90%] md:w-[65%]" />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#060608] via-[#060608]/40 to-transparent" />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#060608] h-40 bottom-0 mt-auto" />

            {/* Contenu du Hero */}
            <div className="relative z-20 h-full flex flex-col justify-end px-4 sm:px-8 lg:px-12 pb-32 md:pb-40 max-w-4xl">
              <motion.div
                key={`content-${currentSlide}`}
                variants={contentVariants}
                initial="hidden"
                animate="show"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-emerald-500">
                    <Play className="w-4 h-4 fill-emerald-500" />
                  </span>
                  <span className="text-sm font-bold text-emerald-500">{activeSlide.badge}</span>
                </div>
                
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-white mb-2 uppercase drop-shadow-2xl line-clamp-2">
                  {activeSlide.title}
                </h1>
                
                <p className="text-sm md:text-lg font-semibold text-[#d8ccff] mb-4 drop-shadow-md">
                  {activeSlide.subtitle}
                </p>
                
                <p className="text-xs sm:text-sm md:text-base text-white/60 mb-8 line-clamp-3 max-w-2xl leading-relaxed">
                  {activeSlide.description}
                </p>

                {/* Boutons d'action liés à TES pages */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => router.push(activeSlide.link)}
                    className="flex items-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 bg-white text-black rounded-lg font-bold text-sm sm:text-base hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    <Play className="w-5 h-5 fill-black" />
                    Lecture
                  </button>
                  
                  <button 
                    onClick={() => router.push(activeSlide.link)}
                    className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all active:scale-95"
                    title="Plus d'infos"
                  >
                    <Info className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Indicateurs (Dots) */}
            <div className="absolute bottom-24 left-0 right-0 z-20 flex justify-center gap-2">
              {heroSlides.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentSlide ? "bg-white w-8 shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "bg-white/30 w-1.5 hover:bg-white/50"
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* =========================================================
          CONTENU PRINCIPAL (Chevauche le Hero)
      ========================================================= */}
      <div className="relative z-30 -mt-16 px-4 sm:px-8 lg:px-12 space-y-12">
        
        {/* 1. NAVIGATION RAPIDE (LIÉE AUX PAGES DU SITE) */}
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          <button onClick={() => router.push("/movies")} className="group relative overflow-hidden rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 md:p-6 text-left transition-all hover:bg-white/[0.08] hover:border-[#d8ccff]/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#d8ccff]/10">
            <Film className="w-6 h-6 md:w-8 md:h-8 mb-2 sm:mb-3 text-white/50 group-hover:text-white transition-colors" />
            <h3 className="text-xs sm:text-sm md:text-lg font-bold">Films</h3>
          </button>
          
          <button onClick={() => router.push("/series")} className="group relative overflow-hidden rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 md:p-6 text-left transition-all hover:bg-white/[0.08] hover:border-pink-500/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-500/10">
            <Tv className="w-6 h-6 md:w-8 md:h-8 mb-2 sm:mb-3 text-white/50 group-hover:text-white transition-colors" />
            <h3 className="text-xs sm:text-sm md:text-lg font-bold">Séries</h3>
          </button>
          
          <button onClick={() => router.push("/live")} className="group relative overflow-hidden rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 md:p-6 text-left transition-all hover:bg-white/[0.08] hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10">
            <Radio className="w-6 h-6 md:w-8 md:h-8 mb-2 sm:mb-3 text-white/50 group-hover:text-white transition-colors" />
            <h3 className="text-xs sm:text-sm md:text-lg font-bold">Direct TV</h3>
          </button>
        </div>

        {/* 2. REPRENDRE LA LECTURE */}
        {lastWatched && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#d8ccff]" />
              Continuez à regarder
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              <button 
                onClick={() => {
                  if (lastWatched.type === "movie") router.push(`/movies/${lastWatched.id}`);
                  if (lastWatched.type === "series") router.push(`/series/${lastWatched.id}`);
                  if (lastWatched.type === "live") router.push(`/live`);
                }}
                className="group relative w-[260px] md:w-[320px] aspect-video rounded-xl overflow-hidden bg-[#0d0d12] border border-white/10 flex-shrink-0 transition-all hover:scale-[1.03] hover:border-white/30 hover:shadow-2xl"
              >
                <img 
                  src={lastWatched.poster} 
                  alt="Affiche" 
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                
                {/* Overlay sombre en bas */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/95 to-transparent">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {cleanName(lastWatched.title)}
                  </p>
                  
                  {/* Barre de progression style Prime */}
                  {lastWatched.progress > 0 && lastWatched.progress < 100 && (
                    <div className="w-full h-1 bg-white/20 mt-2 sm:mt-3 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{ width: `${lastWatched.progress}%` }} />
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center bg-black/40 backdrop-blur-md scale-75 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-white translate-x-0.5" />
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* 3. VOS FAVORIS */}
        {favItems.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Ma Liste
            </h2>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-6 scrollbar-none snap-x">
              {favItems.map((fav: any) => (
                <button
                  key={fav.id}
                  onClick={() => {
                    if (fav.type === "movie" || !fav.type) router.push(`/movies/${fav.id}`);
                    if (fav.type === "series") router.push(`/series/${fav.id}`);
                  }}
                  className="group relative w-[130px] sm:w-[160px] md:w-[180px] aspect-[2/3] rounded-xl overflow-hidden bg-[#0d0d12] border border-white/10 flex-shrink-0 snap-start transition-all duration-300 hover:scale-105 hover:border-white/40 hover:shadow-xl hover:-translate-y-1"
                >
                  {fav.poster ? (
                    <img 
                      src={fav.poster} 
                      alt={cleanName(fav.name)} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/5"><Film className="w-8 h-8 text-white/20" /></div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                      <Play className="w-4 h-4 fill-white translate-x-0.5" />
                    </div>
                  </div>

                  {/* Gradient inférieur pour la lisibilité */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="absolute bottom-2 sm:bottom-3 left-2 right-2 text-[10px] sm:text-xs font-bold text-white truncate text-center">
                      {cleanName(fav.name)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        
      </div>
    </main>
  );
}