"use client";

import { useState, useMemo, useEffect } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { useSeriesStreams } from "@/lib/hooks";
import { useUI } from "@/store/ui";
import type { SeriesItem } from "@/lib/xtream/types";
import { useRouter } from "next/navigation";
import { Tv, Loader2 } from "lucide-react";

function SeriesCatalog() {
  const router = useRouter();
  const { data: seriesList = [], isLoading } = useSeriesStreams();
  const { filters } = useUI();
  const [visibleCount, setVisibleCount] = useState(60);

  const filteredSeries = useMemo(() => {
    let arr = (seriesList as SeriesItem[]) || [];
    const search = filters?.search?.toLowerCase() || "";
    if (search) {
      arr = arr.filter(s => (s.name || s.title || "").toLowerCase().includes(search));
    }
    return arr;
  }, [seriesList, filters]);

  const displayed = filteredSeries.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0d0e12] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
        <span className="text-gray-400">Chargement des series...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white p-6 space-y-6">
      <CatalogBrowser />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {displayed.map((item) => {
          const id = item.series_id;
          const title = item.name || item.title || "Serie";
          const cover = item.cover;
          return (
            <div key={id} onClick={() => router.push(`/series/${id}`)} className="group cursor-pointer rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/50 transition overflow-hidden p-2 flex flex-col">
              <div className="aspect-[2/3] w-full bg-black/40 rounded-lg overflow-hidden relative mb-2 shrink-0">
                {cover ? (
                  <img src={cover} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600"><Tv className="h-8 w-8" /></div>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white truncate mt-auto">{title}</h3>
            </div>
          );
        })}
      </div>
      {visibleCount < filteredSeries.length && (
        <div className="flex justify-center pt-8 pb-10">
          <button onClick={() => setVisibleCount(prev => prev + 60)} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-8 py-3 rounded-xl font-medium transition">
            Afficher plus ({filteredSeries.length - visibleCount})
          </button>
        </div>
      )}
    </div>
  );
}

export default function SeriesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="flex h-screen w-full items-center justify-center bg-[#0d0e12]"><Loader2 className="h-10 w-10 animate-spin text-purple-500" /></div>;
  return <SeriesCatalog />;
}
