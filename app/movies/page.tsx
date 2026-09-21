"use client";

import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { useVodStreams } from "@/lib/hooks";
import type { VodStream } from "@/lib/xtream/types";
import { useRouter } from "next/navigation";
import { Film, Star, Loader2 } from "lucide-react";

export default function MoviesPage() {
  const router = useRouter();
  const { data: movies = [], isLoading } = useVodStreams();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d0e12] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white p-6 space-y-6">
      <CatalogBrowser />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(movies as VodStream[]).map((movie) => {
          const id = movie.stream_id;
          const title = movie.name || movie.title || "Film";
          const cover = movie.stream_icon || movie.cover;
          return (
            <div
              key={id}
              onClick={() => router.push(`/movies/${id}`)}
              className="group cursor-pointer rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/50 transition overflow-hidden p-2"
            >
              <div className="aspect-[2/3] w-full bg-black/40 rounded-lg overflow-hidden relative mb-2">
                {cover ? (
                  <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600"><Film className="h-8 w-8" /></div>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}
