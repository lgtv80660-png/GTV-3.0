"use client";

import { useState, useEffect, use } from "react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ArrowLeft, Play, Star, Calendar, Clock } from "lucide-react";
import { cleanName, ratingNum, yearFrom } from "@/lib/utils";

export default function MovieDetailPage({ params }: { params: Promise<{ movieId: string }> }) {
  const resolvedParams = use(params);
  const movieId = resolvedParams.movieId;

  const [movieData, setMovieData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function fetchMovieInfo() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/movie-info?id=${movieId}`);
        
        if (!res.ok) {
          throw new Error("Impossible de charger les informations du film.");
        }
        
        const data = await res.json();
        if (!data || (!data.info && !data.movie_data)) {
          throw new Error("Données du film introuvables.");
        }

        setMovieData(data);
      } catch (err: any) {
        console.error("Erreur chargement film:", err);
        setError(err.message || "Impossible de charger ce film.");
      } finally {
        setLoading(false);
      }
    }

    if (movieId) {
      fetchMovieInfo();
    }
  }, [movieId]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <p className="text-sm font-medium animate-pulse">Chargement du film...</p>
      </div>
    );
  }

  if (error || !movieData) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white p-6">
        <p className="text-base font-semibold text-red-500 mb-4">{error || "Impossible de charger ce film."}</p>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au catalogue
        </button>
      </div>
    );
  }

  const info = movieData.info || movieData.movie_data || {};
  const containerExt = info.container_extension || movieData.movie_data?.container_extension || "mp4";
  
  // ✅ Endpoint VOD FFmpeg obligatoire pour les films
  const movieStreamUrl = `/api/stream-vod?type=movie&id=${movieId}&ext=${containerExt}`;

  // --- MODE LECTEUR VIDÉO ---
  if (isPlaying) {
    return (
      <div className="relative h-screen w-screen bg-black">
        <VideoPlayer
          sources={[movieStreamUrl]}
          ext={containerExt}
          isLive={false}
          title={cleanName(info.name || info.title)}
          poster={info.movie_image || info.cover_big}
          knownDuration={Number(info.duration_secs || 0)}
          onBack={() => setIsPlaying(false)}
        />
      </div>
    );
  }

  // --- PAGE DÉTAILS FILM ---
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-10">
      <button
        onClick={() => window.history.back()}
        className="mb-6 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <div className="flex flex-col md:flex-row gap-8 items-start max-w-6xl mx-auto">
        {(info.movie_image || info.cover_big) && (
          <img
            src={info.movie_image || info.cover_big}
            alt={info.name || "Affiche film"}
            className="h-80 w-56 rounded-2xl object-cover shadow-2xl shrink-0"
          />
        )}

        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold">{cleanName(info.name || info.title)}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-zinc-400">
            {info.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                {ratingNum(info.rating)}
              </span>
            )}
            {info.releasedate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {yearFrom(info.releasedate)}
              </span>
            )}
            {info.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {info.duration}
              </span>
            )}
          </div>

          <p className="mt-6 text-sm text-zinc-300 leading-relaxed max-w-3xl">
            {info.plot || info.description || "Aucun résumé disponible pour ce film."}
          </p>

          <button
            onClick={() => setIsPlaying(true)}
            className="mt-8 flex items-center gap-3 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-500"
          >
            <Play className="h-5 w-5 fill-white" /> Regarder le film
          </button>
        </div>
      </div>
    </div>
  );
}