"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tv, Play, Search, X } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/* =========================================================
   FONCTIONS DE NETTOYAGE DES NOMS
========================================================= */

const formatCategoryName = (rawName: string) => {
  if (!rawName) return "";
  
  let cleanName = rawName
    .replace(/\[.*?\]/g, "") 
    .replace(/\|.*?\|/g, "") 
    .replace(/[Ⓐ-Ⓩⓐ-ⓩ║]/g, "") 
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

const cleanSeriesName = (rawName: string) => {
  if (!rawName) return "";

  return rawName
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(/[Ⓐ-Ⓩⓐ-ⓩ║]/g, "") 
    .replace(/\b(4K|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFI|FR)\b/gi, "")
    .replace(/\s*\(\d{4}\)/g, "")
    .replace(/\s*\[\d{4}\]/g, "")
    .replace(/[\/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* =========================================================
   COMPOSANT CARTE CATÉGORIE
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
      
      {isActive && (
        <motion.div
          layoutId="active-category-outline-series"
          className="absolute inset-0 rounded-[16px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]"
        />
      )}

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
   MOTEURS DE GLISSEMENT
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
   PAGE PRINCIPALE DES SÉRIES
========================================================= */
export default function SeriesCatalogPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("0");
  const [searchQuery, setSearchQuery] = useState(""); // 🔍 Nouvel état pour la recherche

  const categoryDrag = useHorizontalScroll();
  const seriesDrag = useVerticalScroll();

  const { data: categories, isLoading: isLoadingCats } = useQuery({
    queryKey: ["series-categories"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_series_categories");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    select: (data) => data.map((cat: any) => ({ ...cat, category_name: formatCategoryName(cat.category_name) })),
    staleTime: 10 * 60 * 1000,
  });

  const { data: seriesList, isLoading: isLoadingSeries } = useQuery({
    queryKey: ["series", activeCategory],
    queryFn: async () => {
      const action = activeCategory === "0"
        ? "/api/xtream?action=get_series"
        : `/api/xtream?action=get_series&category_id=${activeCategory}`;
      const res = await fetch(action);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!categories,
    staleTime: 5 * 60 * 1000,
  });

  // 🔍 Moteur de filtrage instantané (Mémoïsé pour la performance)
  const filteredSeries = useMemo(() => {
    if (!seriesList) return [];
    if (!searchQuery.trim()) return seriesList.slice(0, 150);
    
    const lowerQuery = searchQuery.toLowerCase();
    return seriesList.filter((series: any) => 
      cleanSeriesName(series.name).toLowerCase().includes(lowerQuery)
    ).slice(0, 150);
  }, [seriesList, searchQuery]);

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
      
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-[#d8ccff]/[0.025] to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 shrink-0 px-4 sm:px-8 pt-8 pb-2">
        {/* EN-TÊTE AVEC BARRE DE RECHERCHE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3 drop-shadow-md">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
              <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-[#d8ccff]" />
            </div>
            Séries
          </h1>

          {/* 🔍 Barre de recherche Glassmorphism */}
          <div className="relative group w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-[#d8ccff] transition-colors" />
            <input
              type="text"
              placeholder="Rechercher une série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-[280px] h-11 bg-white/[0.04] border border-white/10 rounded-full pl-11 pr-10 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-[#d8ccff]/50 focus:bg-white/[0.08] transition-all shadow-inner"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/60 hover:text-white" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CATÉGORIES */}
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
                  name="Toutes les séries" 
                  isActive={activeCategory === "0"} 
                  onClick={(e) => {
                    if (categoryDrag.isDragging) { e.stopPropagation(); return; }
                    setActiveCategory("0");
                    setSearchQuery(""); // On vide la recherche au changement de catégorie
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
                      setSearchQuery(""); // On vide la recherche au changement de catégorie
                    }} 
                  />
                ))}
              </div>
           )}
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent shrink-0 opacity-50" />

      {/* GRILLE DES SÉRIES */}
      <div 
        {...seriesDrag}
        style={{ WebkitOverflowScrolling: "touch" }}
        className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-8 pt-6 pb-32 scrollbar-none cursor-grab active:cursor-grabbing select-none"
      >
        {isLoadingSeries ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 sm:gap-5">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/[0.03] rounded-[20px] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filteredSeries.length === 0 ? (
          // 🔍 État "Aucun résultat" 
          <div className="flex flex-col items-center justify-center h-full opacity-60 mt-10">
            <Search className="w-12 h-12 mb-4 text-white/40" />
            <p className="text-lg font-medium text-white/70 text-center">
              Aucun résultat pour "{searchQuery}"
            </p>
            <p className="text-sm text-white/40 mt-1">
              Essayez avec un autre mot-clé ou changez de catégorie.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory + searchQuery}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 sm:gap-5"
            >
              {filteredSeries.map((series: any) => {
                const seriesImage = series.cover || series.stream_icon || series.poster || null;
                const cleanName = cleanSeriesName(series.name);

                return (
                  <motion.div
                    variants={itemVariants}
                    key={series.series_id}
                    onClick={(e) => {
                      if (seriesDrag.isDragging) {
                        e.stopPropagation();
                        return;
                      }
                      router.push(`/series/${series.series_id}`);
                    }}
                    className="group cursor-pointer relative flex flex-col"
                  >
                    <div className="relative aspect-[2/3] rounded-[20px] overflow-hidden bg-[#0d0d12] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                      
                      {seriesImage ? (
                        <img
                          src={seriesImage}
                          alt={cleanName}
                          draggable={false}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 pointer-events-none"
                          loading="lazy"
                          onError={(e) => (e.currentTarget.style.opacity = '0')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center pointer-events-none">
                          <Tv className="w-10 h-10 text-white/10" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-out shadow-2xl">
                           <Play className="w-5 h-5 text-white translate-x-0.5 fill-white" />
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    
                    <h3 className="mt-3 text-[11px] sm:text-[13px] font-semibold text-white/70 truncate group-hover:text-white transition-colors px-1" title={cleanName}>
                      {cleanName}
                    </h3>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}