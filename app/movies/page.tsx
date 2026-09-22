"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Film, Play, Clapperboard } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { cn } from "@/lib/utils";
/* =========================================================
   FONCTION DE NETTOYAGE DES NOMS
========================================================= */
const formatCategoryName = (rawName: string) => {
  if (!rawName) return "";
  
  let cleanName = rawName
    .replace(/\[.*?\]/g, "") 
    .replace(/\|.*?\|/g, "") 
    .replace(/[ⓋⒹ║]/g, "")
    .replace(/VOD-FR/gi, "")
    .replace(/FR -/gi, "")
    .replace(/^[-_|\s]+|[-_|\s]+$/g, "")
    .trim();

  const customNames: Record<string, string> = {
    "SCIENCE FICTION": "Sci-Fi",
    "SOUS TITRÉS": "VOSTFR",
    "TÉLÉ-FILM": "Téléfilms",
    "HORREUR": "Horreur",
  };
  
  return customNames[cleanName] || cleanName;
};

/* =========================================================
   COMPOSANT CARTE CATÉGORIE (Design Premium)
========================================================= */
const CategoryCard = ({ 
  name, 
  isActive, 
  onClick 
}: { 
  name: string, 
  isActive: boolean, 
  onClick: (e: React.MouseEvent) => void 
}) => {
  const [bgImage, setBgImage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/category-image?query=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.imageUrl) setBgImage(data.imageUrl);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [name]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex-shrink-0 w-[140px] sm:w-[170px] h-[64px] sm:h-[76px] rounded-[16px] overflow-hidden transition-all duration-300 select-none",
        isActive
          ? "border-[#d8ccff]/50 bg-[#d8ccff]/10 shadow-[0_12px_35px_rgba(170,145,255,.16)] scale-[1.02]"
          : "border border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
      )}
    >
      {/* Background Image with Overlay */}
      {bgImage ? (
        <>
          <img 
            src={bgImage} 
            alt={name} 
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-60 pointer-events-none" 
            onError={(e) => (e.currentTarget.style.display = 'none')} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060608]/90 via-[#060608]/60 to-transparent pointer-events-none" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
      )}
      
      {/* Active Glow Outline */}
      {isActive && (
        <motion.div
          layoutId="active-category-outline"
          className="absolute inset-0 rounded-[16px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]"
        />
      )}

      {/* Text */}
      <span className={cn(
        "absolute inset-0 flex items-center justify-center text-xs sm:text-[13px] font-bold tracking-wide text-center px-3 leading-tight drop-shadow-md transition-colors",
        isActive ? "text-white" : "text-white/70 group-hover:text-white"
      )}>
        {name}
      </span>
    </button>
  );
};

/* =========================================================
   MOTEURS DE GLISSEMENT (Tactile & Souris)
========================================================= */
function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDrag = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    isDrag.current = true;
    setIsDragging(false);
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrag.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(walk) > 5) setIsDragging(true);
    ref.current.scrollLeft = scrollLeft.current - walk;
  };
  const onMouseUpOrLeave = () => {
    isDrag.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };
  return { ref, onMouseDown, onMouseMove, onMouseUp: onMouseUpOrLeave, onMouseLeave: onMouseUpOrLeave, isDragging };
}

function useVerticalScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDrag = useRef(false);
  const startY = useRef(0);
  const scrollTop = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    isDrag.current = true;
    setIsDragging(false);
    startY.current = e.pageY - ref.current.offsetTop;
    scrollTop.current = ref.current.scrollTop;
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrag.current || !ref.current) return;
    e.preventDefault();
    const y = e.pageY - ref.current.offsetTop;
    const walk = (y - startY.current) * 1.5;
    if (Math.abs(walk) > 5) setIsDragging(true);
    ref.current.scrollTop = scrollTop.current - walk;
  };
  const onMouseUpOrLeave = () => {
    isDrag.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };
  return { ref, onMouseDown, onMouseMove, onMouseUp: onMouseUpOrLeave, onMouseLeave: onMouseUpOrLeave, isDragging };
}

/* =========================================================
   PAGE PRINCIPALE
========================================================= */
export default function MoviesCatalogPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("0");

  const categoryDrag = useHorizontalScroll();
  const movieDrag = useVerticalScroll();

  const { data: categories, isLoading: isLoadingCats } = useQuery({
    queryKey: ["vod-categories"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_vod_categories");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    select: (data) => data.map((cat: any) => ({ ...cat, category_name: formatCategoryName(cat.category_name) })),
    staleTime: 10 * 60 * 1000,
  });

  const { data: movies, isLoading: isLoadingMovies } = useQuery({
    queryKey: ["movies", activeCategory],
    queryFn: async () => {
      const action = activeCategory === "0"
        ? "/api/xtream?action=get_vod_streams"
        : `/api/xtream?action=get_vod_streams&category_id=${activeCategory}`;
      const res = await fetch(action);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!categories,
    staleTime: 5 * 60 * 1000,
  });

const containerVariants: Variants = { 
    hidden: { opacity: 0 }, 
    show: { opacity: 1, transition: { staggerChildren: 0.04 } } 
  };
  
  const itemVariants: Variants = { 
    hidden: { opacity: 0, scale: 0.95, y: 20 }, 
    show: { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } 
    } 
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#060608] text-white overflow-hidden relative">
      
      {/* BACKGROUND EFFECTS */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-[#d8ccff]/[0.025] to-transparent blur-3xl" />
      </div>

      {/* HEADER & CATÉGORIES */}
      <div className="relative z-10 shrink-0 px-4 sm:px-8 pt-8 pb-2">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3 drop-shadow-md">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
              <Clapperboard className="w-5 h-5 sm:w-6 sm:h-6 text-[#d8ccff]" />
            </div>
            Films
          </h1>
        </div>

        <div className="relative mb-2">
           {isLoadingCats ? (
              <div className="flex gap-3 overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-[64px] w-[140px] sm:h-[76px] sm:w-[170px] bg-white/[0.03] rounded-[16px] animate-pulse border border-white/5 shrink-0" />
                ))}
              </div>
           ) : (
              <div 
                {...categoryDrag}
                style={{ WebkitOverflowScrolling: "touch" }}
                className="flex overflow-x-auto gap-3 pb-4 scrollbar-none cursor-grab active:cursor-grabbing select-none"
              >
                <CategoryCard 
                  name="Tous les films" 
                  isActive={activeCategory === "0"} 
                  onClick={(e) => {
                    if (categoryDrag.isDragging) { e.stopPropagation(); return; }
                    setActiveCategory("0");
                  }} 
                />
                
                {categories?.map((cat: any) => (
                  <CategoryCard 
                    key={cat.category_id}
                    name={cat.category_name} 
                    isActive={activeCategory === cat.category_id} 
                    onClick={(e) => {
                      if (categoryDrag.isDragging) { e.stopPropagation(); return; }
                      setActiveCategory(cat.category_id);
                    }} 
                  />
                ))}
              </div>
           )}
        </div>
      </div>

      {/* LIGNE DE SÉPARATION SUBTILE */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent shrink-0 opacity-50" />

      {/* GRILLE DES FILMS VERTICALE */}
      <div 
        {...movieDrag}
        style={{ WebkitOverflowScrolling: "touch" }}
        className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-8 pt-6 pb-32 scrollbar-none cursor-grab active:cursor-grabbing select-none"
      >
        {isLoadingMovies ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 sm:gap-5">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/[0.03] rounded-[20px] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 sm:gap-5"
            >
              {movies?.slice(0, 150).map((movie: any) => (
                <motion.div
                  variants={itemVariants}
                  key={movie.stream_id}
                  onClick={(e) => {
                    if (movieDrag.isDragging) {
                      e.stopPropagation();
                      return;
                    }
                    router.push(`/movies/${movie.stream_id}`);
                  }}
                  className="group cursor-pointer relative flex flex-col"
                >
                  <div className="relative aspect-[2/3] rounded-[20px] overflow-hidden bg-[#0d0d12] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                    
                    {movie.stream_icon ? (
                      <img
                        src={movie.stream_icon}
                        alt={movie.name}
                        draggable={false}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 pointer-events-none"
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.opacity = '0')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <Film className="w-10 h-10 text-white/10" />
                      </div>
                    )}
                    
                    {/* OVERLAY SOMBRE & ICONE PLAY AU SURVOL */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-out shadow-2xl">
                         <Play className="w-5 h-5 text-white translate-x-0.5 fill-white" />
                      </div>
                    </div>

                    {/* DÉGRADÉ INFÉRIEUR POUR LISIBILITÉ (si on voulait mettre du texte dessus) */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  {/* TITRE SOUS L'AFFICHE */}
                  <h3 className="mt-3 text-[11px] sm:text-[13px] font-semibold text-white/70 truncate group-hover:text-white transition-colors px-1">
                    {movie.name}
                  </h3>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}