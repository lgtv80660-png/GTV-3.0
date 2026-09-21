"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Play, Film, Star, ArrowLeft, Maximize2, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const movieId = String(params.id || "");

  const [activeTab, setActiveTab] = useState<"none" | "trailer" | "movie">("none");

  const { data: movieData, isLoading } = useQuery({
    queryKey: ["movie", "info", movieId],
    queryFn: () => api.vodInfo(movieId),
    enabled: !!movieId,
  });

  const info = (movieData?.info || movieData?.movie_data) as any;
  const ext = (movieData?.movie_data as any)?.container_extension || "mp4";

  const streamUrl = useMemo(() => {
    if (!movieId) return "";
    return `/api/stream-vod?type=movie&id=${movieId}&ext=${ext}`;
  }, [movieId, ext]);

  const youtubeTrailerId = info?.youtube_trailer;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d0e12] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white">
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-8 pb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{info?.name || "Titre du film"}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
            {info?.rating && (
              <span className="flex items-center gap-1 text-yellow-400 font-medium">
                <Star className="h-4 w-4 fill-yellow-400" />
                {Number(info.rating).toFixed(1)}
              </span>
            )}
            {info?.releasedate && <span>{info.releasedate.split("-")[0]}</span>}
            {info?.genre && <span>• {info.genre}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("movie")}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-purple-900/30"
          >
            <Play className="h-5 w-5 fill-white" />
            Play
          </button>

          {youtubeTrailerId && (
            <button
              onClick={() => setActiveTab("trailer")}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-5 py-3 rounded-xl transition backdrop-blur-md"
            >
              <Film className="h-5 w-5" />
              Bande-annonce
            </button>
          )}

          <button
            onClick={() => router.push(`/watch?type=movie&id=${movieId}&ext=${ext}`)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl transition"
            title="Plein écran"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {activeTab !== "none" && (
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-sm font-medium text-gray-300">
                {activeTab === "movie" ? "FILM EN LECTURE" : "BANDE-ANNONCE"}
              </span>
              <button
                onClick={() => setActiveTab("none")}
                className="p-1.5 rounded-full bg-black/60 hover:bg-white/20 text-gray-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeTab === "trailer" ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeTrailerId}?autoplay=1`}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <video
                src={streamUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">SYNOPSIS & HISTOIRE</h2>
            <p className="text-gray-400 leading-relaxed text-sm">
              {info?.plot || info?.description || "Aucun synopsis disponible."}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">CASTING / ACTEURS</h2>
            <div className="flex flex-wrap gap-2">
              {info?.cast ? (
                info.cast.split(",").map((actor: string, i: number) => (
                  <span
                    key={i}
                    className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs text-gray-300"
                  >
                    {actor.trim()}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">Non disponible</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}