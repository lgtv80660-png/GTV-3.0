"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heart, Film, Tv, Play, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "@/store/library";

/* =========================================================
   HELPER : GESTION INTELLIGENTE DES IMAGES
========================================================= */
function getImageUrl(item: any): string | null {
  const img = item.poster || item.cover || item.movie_image || item.stream_icon;
  if (!img) return null;
  if (img.startsWith("/")) return `https://image.tmdb.org/t/p/w500${img}`;
  return img;
}

/* =========================================================
   COMPOSANT CARTE FAVORIS (Gère ses propres erreurs d'image)
========================================================= */
function FavoriteCard({ item, activeTab, toggleFav }: { item: any; activeTab: string; toggleFav: any }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = getImageUrl(item);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 shadow-lg flex flex-col"
    >
      <Link href={`/${activeTab}/${item.id}`} className="block relative aspect-[2/3] overflow-hidden bg-[#0d0d12]">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={item.name || item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={() => setImgError(true)} // Si l'image est morte, on passe imgError à true proprement
          />
        ) : (
          // Affichage de secours (Fallback) si pas d'image ou lien mort
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/50">
            {activeTab === "movies" ? (
              <Film className="w-10 h-10 text-zinc-600 mb-2" />
            ) : (
              <Tv className="w-10 h-10 text-zinc-600 mb-2" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-[#aa95ff] rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_20px_rgba(170,149,255,0.5)]">
            <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          toggleFav(activeTab, item);
        }}
        className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-red-500/90 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors z-10 opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="p-3 bg-[#12141c]">
        <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#d8ccff] transition-colors">
          {item.name || item.title}
        </h3>
      </div>
    </motion.div>
  );
}

/* =========================================================
   PAGE PRINCIPALE
========================================================= */
export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<"movies" | "series">("movies");
  
  const { favorites, toggleFav } = useLibrary();

  const movies = Object.entries(favorites)
    .filter(([key]) => key.startsWith("movies:"))
    .map(([_, item]) => item);
    
  const series = Object.entries(favorites)
    .filter(([key]) => key.startsWith("series:"))
    .map(([_, item]) => item);

  const currentList = activeTab === "movies" ? movies : series;

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 pb-24 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-8 h-8 text-white fill-white/20" />
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Mes Favoris
        </h1>
      </div>

      {/* SÉLECTEUR D'ONGLETS */}
      <div className="flex mb-8">
        <div className="bg-zinc-900/80 p-1.5 rounded-xl inline-flex border border-white/5 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setActiveTab("movies")}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === "movies" ? "text-black shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            {activeTab === "movies" && (
              <motion.div layoutId="active-tab" className="absolute inset-0 bg-white rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Film className="w-4 h-4" />
              Films <span className="ml-1 bg-black/10 px-1.5 py-0.5 rounded text-xs">{movies.length}</span>
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("series")}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === "series" ? "text-black shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            {activeTab === "series" && (
              <motion.div layoutId="active-tab" className="absolute inset-0 bg-white rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Tv className="w-4 h-4" />
              Séries <span className="ml-1 bg-black/10 px-1.5 py-0.5 rounded text-xs">{series.length}</span>
            </span>
          </button>
        </div>
      </div>

      {/* ZONE DE CONTENU */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-12 sm:mt-24 p-8 border border-dashed border-white/10 rounded-3xl bg-zinc-900/20">
              <Heart className="w-16 h-16 text-zinc-700 mb-4" />
              <h2 className="text-xl font-bold mb-2 text-zinc-300 text-center">
                Aucun{activeTab === "movies" ? " film favori" : "e série favorite"}
              </h2>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              <AnimatePresence>
                {currentList.map((item: any) => (
                  <FavoriteCard 
                    key={item.id} 
                    item={item} 
                    activeTab={activeTab} 
                    toggleFav={toggleFav} 
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}