"use client";

import { useState, useMemo, useEffect } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { useVodStreams } from "@/lib/hooks";
import { useUI } from "@/store/ui";
import type { VodStream } from "@/lib/xtream/types";
import { useRouter } from "next/navigation";
import { Film, Loader2 } from "lucide-react";

function MoviesCatalog() {
  const router = useRouter();
  const { data: movies = [], isLoading } = useVodStreams();
  const { filters } = useUI();
  const [visibleCount, setVisibleCount] = useState(60);

  const filteredMovies = useMemo(() => {
    let arr = (movies as VodStream[]) || [];
    const search = filters?.search?.toLowerCase() || "";
    if (search) {
      arr = arr.filter(m => (m.name || m.title || "").toLowerCase().includes(search));
    }
    return arr;
  }, [movies, filters]);

  const displayed = filteredMovies.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0d0e12] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
        <span className="text-gray-400">Chargement des films...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white p-6 space-y-6">
      <CatalogBrowser />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {displayed.map((movie) => {
          const id = movie.stream_id;
          const title = movie.name || movie.title || "Film";
          const cover = movie.stream_icon || movie.cover;
          return (
            <div key={id} onClick={() => router.push(`/movies/${id}`)} className="group cursor-pointer rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/50 transition overflow-hidden p-2 flex flex-col">
              <div className="aspect-[2/3] w-full bg-black/40 rounded-lg overflow-hidden relative mb-2 shrink-0">
                {cover ? (
                  <img src={cover} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600"><Film className="h-8 w-8" /></div>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white truncate mt-auto">{title}</h3>
            </div>
          );
        })}
      </div>
      {visibleCount < filteredMovies.length && (
        <div className="flex justify-center pt-8 pb-10">
          <button onClick={() => setVisibleCount(prev => prev + 60)} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-8 py-3 rounded-xl font-medium transition">
            Afficher plus ({filteredMovies.length - visibleCount})
          </button>
        </div>
      )}
    </div>
  );
}

export default function MoviesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="flex h-screen w-full items-center justify-center bg-[#0d0e12]"><Loader2 className="h-10 w-10 animate-spin text-purple-500" /></div>;
  return <MoviesCatalog />;
}
