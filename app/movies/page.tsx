"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// === FONCTION DE NETTOYAGE DES NOMS (Avec Filtre Caractères Spéciaux) ===
const formatCategoryName = (rawName: string) => {
  if (!rawName) return "";
  
  let cleanName = rawName
    .replace(/\[.*?\]/g, "") 
    .replace(/\|.*?\|/g, "") 
    .replace(/[ⓋⒹ║]/g, "") // Détruit les symboles IPTV bizarres
    .replace(/VOD-FR/gi, "")
    .replace(/FR -/gi, "")
    .replace(/^[-_|\s]+|[-_|\s]+$/g, "") // Nettoie les tirets orphelins sur les bords
    .trim();

  const customNames: Record<string, string> = {
    "SCIENCE FICTION": "Sci-Fi",
    "SOUS TITRÉS": "VOSTFR",
    "TÉLÉ-FILM": "Téléfilms",
    "HORREUR": "Horreur",
  };
  
  return customNames[cleanName] || cleanName;
};

// === COMPOSANT CARTE CATÉGORIE ===
const CategoryCard = ({ 
  name, 
  isActive, 
  onClick 
}: { 
  name: string, 
  isActive: boolean, 
  onClick: () => void 
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
      className={`relative flex-shrink-0 w-36 sm:w-44 h-16 sm:h-20 rounded-xl overflow-hidden transition-all duration-300 ${
        isActive
          ? "ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105 opacity-100"
          : "hover:ring-1 hover:ring-white/50 opacity-60 hover:opacity-100 hover:scale-105"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      
      {bgImage && (
        <img 
          src={bgImage} 
          alt={name} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      )}
      
      <div className="absolute inset-0 bg-black/60 transition-colors hover:bg-black/40" />
      <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold text-white tracking-wide text-center px-2 leading-tight drop-shadow-md">
        {name}
      </span>
    </button>
  );
};

// === MOTEURS DE GLISSEMENT ===
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
    const walk = (x - startX.current) * 2;
    if (Math.abs(walk) > 5) setIsDragging(true);
    ref.current.scrollLeft = scrollLeft.current - walk;
  };
  const onMouseUpOrLeave = () => {
    isDrag.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };
  return { ref, onMouseDown, onMouseMove, onMouseUp: onMouseUpOrLeave, onMouseLeave: onMouseUpOrLeave, isDragging, onClickCapture: (e: React.MouseEvent) => { if (isDragging) e.stopPropagation(); } };
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
    const walk = (y - startY.current) * 2;
    if (Math.abs(walk) > 5) setIsDragging(true);
    ref.current.scrollTop = scrollTop.current - walk;
  };
  const onMouseUpOrLeave = () => {
    isDrag.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };
  return { ref, onMouseDown, onMouseMove, onMouseUp: onMouseUpOrLeave, onMouseLeave: onMouseUpOrLeave, isDragging, onClickCapture: (e: React.MouseEvent) => { if (isDragging) e.stopPropagation(); } };
}

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

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      
      {/* HEADER & CATÉGORIES */}
      <div className="shrink-0 p-4 sm:p-8 pb-0">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <Film className="w-8 h-8 text-white" />
            Films
          </h1>
        </div>

        <div className="relative mb-4">
           {isLoadingCats ? (
              <div className="flex gap-3 overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 w-36 sm:w-40 bg-zinc-900 rounded-xl animate-pulse border border-white/5 shrink-0" />
                ))}
              </div>
           ) : (
              <div 
                {...categoryDrag}
                className="flex overflow-x-auto gap-3 pb-4 scrollbar-none cursor-grab active:cursor-grabbing select-none"
              >
                <CategoryCard 
                  name="Tous les films" 
                  isActive={activeCategory === "0"} 
                  onClick={() => setActiveCategory("0")} 
                />
                
                {categories?.map((cat: any) => (
                  <CategoryCard 
                    key={cat.category_id}
                    name={cat.category_name} 
                    isActive={activeCategory === cat.category_id} 
                    onClick={() => setActiveCategory(cat.category_id)} 
                  />
                ))}
              </div>
           )}
        </div>
      </div>

      {/* GRILLE DES FILMS VERTICALE */}
      <div 
        {...movieDrag}
        className="flex-1 overflow-y-auto p-4 sm:p-8 pt-2 pb-32 scrollbar-none cursor-grab active:cursor-grabbing select-none"
      >
        {isLoadingMovies ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {[...Array(18)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-2xl animate-pulse border border-white/5" />
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
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6"
            >
              {movies?.slice(0, 150).map((movie: any) => (
                <motion.div
                  variants={itemVariants}
                  key={movie.stream_id}
                  onClick={() => router.push(`/movies/${movie.stream_id}`)}
                  className="group cursor-pointer relative"
                >
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 relative shadow-lg">
                    {movie.stream_icon ? (
                      <img
                        src={movie.stream_icon}
                        alt={movie.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <Film className="w-10 h-10 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
                  </div>
                  
                  <h3 className="mt-3 text-xs sm:text-sm font-bold text-zinc-300 truncate group-hover:text-white transition-colors">
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