"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Play, Film, Star, ArrowLeft, Maximize2, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();

  const idParam = params?.id || params?.movieId;
  const movieId = Array.isArray(idParam) ? idParam[0] : String(idParam || "");

  const [activeTab, setActiveTab] = useState<"none" | "trailer" | "movie">("none");

  // Récupération des infos du film
  const { data: movieData, isLoading, isError } = useQuery({
    queryKey: ["vod", "info", movieId],
    queryFn: async () => {
      if (!movieId) return null;
      try {
        return await api.vodInfo(movieId);
      } catch (err) {
        const res = await fetch(`/api/movie-info?id=${movieId}`);
        if (!res.ok) throw new Error("Impossible de charger les infos du film");
        return await res.json();
      }
    },
    enabled: !!movieId,
    staleTime: 10 * 60 * 1000,
  });

  const info = (movieData?.info || movieData?.movie_data || movieData) as any;
  const ext = (movieData?.movie_data as any)?.container_extension || info?.container_extension || "mp4";
  const title = info?.name || info?.title || "Film";

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

  if (isError || !info || (!info.name && !info.title && !info.movie_image)) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0d0e12] text-white p-6">
        <p className="text-red-500 font-semibold mb-4 text-lg">
          Impossible de charger les informations du film ({movieId}).
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/movies")}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-xl transition text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au catalogue
          </button>
          <button
            onClick={() =>
              router.push(`/watch?type=movie&id=${movieId}&ext=mp4&title=Film%20${movieId}`)
            }
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl transition text-sm font-medium"
          >
            Forcer la lecture sur /watch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white">
      {/* Header */}
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-8 pb-12">
        {/* Titre */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
            {info?.rating && (
              <span className="flex items-center gap-1 text-yellow-400 font-medium">
                <Star className="h-4 w-4 fill-yellow-400" />
                {Number(info.rating).toFixed(1)}
              </span>
            )}
            {info?.releasedate && <span>{String(info.releasedate).split("-")[0]}</span>}
            {info?.genre && <span>• {info.genre}</span>}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("movie")}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-purple-900/30"
          >
            <Play className="h-5 w-5 fill-white" />
            Lecture sur la page
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

          {/* BOUTON REDIRECTION VERS LA PAGE REGARDER (/watch) */}
          <button
            onClick={() =>
              router.push(
                `/watch?type=movie&id=${movieId}&ext=${ext}&title=${encodeURIComponent(title)}`
              )
            }
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl transition border border-white/10 font-medium"
            title="Ouvrir sur la page /watch"
          >
            <Maximize2 className="h-4 w-4" />
            <span>Ouvrir sur /watch</span>
          </button>
        </div>

        {/* Mini Player */}
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

        {/* Informations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">SYNOPSIS</h2>
            <p className="text-gray-400 leading-relaxed text-sm">
              {info?.plot || info?.description || "Aucun synopsis disponible."}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">CASTING</h2>
            <div className="flex flex-wrap gap-2">
              {info?.cast ? (
                String(info.cast)
                  .split(",")
                  .map((actor: string, i: number) => (
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