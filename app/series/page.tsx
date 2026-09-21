"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tv, Search, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function SeriesCatalogPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("0");

  // 1. Charger les catégories de séries
  const { data: categories, isLoading: isLoadingCats } = useQuery({
    queryKey: ["series-categories"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_series_categories");
      if (!res.ok) throw new Error("Erreur catégories");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // 2. Charger les séries de la catégorie sélectionnée
  const { data: series, isLoading: isLoadingSeries } = useQuery({
    queryKey: ["series", activeCategory],
    queryFn: async () => {
      const action = activeCategory === "0" 
        ? "/api/xtream?action=get_series" 
        : `/api/xtream?action=get_series&category_id=${activeCategory}`;
      const res = await fetch(action);
      if (!res.ok) throw new Error("Erreur séries");
      return res.json();
    },
    enabled: !!categories,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <Tv className="w-8 h-8 text-iris-500" />
          Séries TV
        </h1>
      </div>

      {/* BARRE DES CATÉGORIES */}
      <div className="flex overflow-x-auto gap-3 pb-4 mb-6 scrollbar-none">
        <button
          onClick={() => setActiveCategory("0")}
          className={`px-5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
            activeCategory === "0"
              ? "bg-white text-black"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          Toutes les séries
        </button>
        {categories?.map((cat: any) => (
          <button
            key={cat.category_id}
            onClick={() => setActiveCategory(cat.category_id)}
            className={`px-5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeCategory === cat.category_id
                ? "bg-white text-black"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {cat.category_name}
          </button>
        ))}
      </div>

      {/* GRILLE DES SÉRIES */}
      {isLoadingSeries ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse border border-white/5" />
          ))}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
        >
          {series?.slice(0, 100).map((show: any) => (
            <div
              key={show.series_id}
              onClick={() => router.push(`/series/${show.series_id}`)}
              className="group cursor-pointer relative"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                {show.cover ? (
                  <img
                    src={show.cover}
                    alt={show.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tv className="w-10 h-10 text-zinc-700" />
                  </div>
                )}
                
                {/* OVERLAY HOVER */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-white/20 p-3 rounded-full">
                    <Play className="w-6 h-6 fill-white text-white" />
                  </div>
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                {show.name}
              </h3>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}