"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSeriesInfo } from "@/lib/hooks";
import { Play, Film, Star, ArrowLeft, Maximize2, X, Loader2, Tv } from "lucide-react";
import type { Episode } from "@/lib/xtream/types";

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = String(params.seriesId || params.id || "");

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"none" | "trailer" | "episode">("none");
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  // Chargement des données de la série
  const { data: seriesData, isLoading } = useSeriesInfo(seriesId);

  const info = seriesData?.info;
  const seasonsEpisodes = seriesData?.episodes || {};

  // Saisons disponibles
  const seasons = useMemo(() => {
    return Object.keys(seasonsEpisodes)
      .map(Number)
      .sort((a, b) => a - b);
  }, [seasonsEpisodes]);

  // Liste des épisodes pour la saison sélectionnée
  const episodesList = useMemo<Episode[]>(() => {
    return seasonsEpisodes[String(selectedSeason)] || [];
  }, [seasonsEpisodes, selectedSeason]);

  // Lancer un épisode dans le mini-lecteur
  const handlePlayEpisode = (ep: Episode) => {
    setCurrentEpisode(ep);
    setActiveTab("episode");
  };

  // URL du flux vidéo stream-vod pour la série
  const streamUrl = useMemo(() => {
    if (!currentEpisode) return "";
    const ext = currentEpisode.container_extension || "mp4";
    return `/api/stream-vod?type=series&id=${currentEpisode.id}&ext=${ext}`;
  }, [currentEpisode]);

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
      {/* Top Header */}
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-8 pb-12">
        {/* Titre & Metadonnées */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{info?.name || "Titre de la série"}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
            {info?.rating && (
              <span className="flex items-center gap-1 text-yellow-400 font-medium">
                <Star className="h-4 w-4 fill-yellow-400" />
                {Number(info.rating).toFixed(1)}
              </span>
            )}
            {info?.releaseDate && <span>{info.releaseDate.split("-")[0]}</span>}
            {info?.genre && <span>• {info.genre}</span>}
          </div>
        </div>

        {/* Boutons d'action rapides */}
        <div className="flex items-center gap-4">
          {episodesList.length > 0 && (
            <button
              onClick={() => handlePlayEpisode(episodesList[0])}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-purple-900/30"
            >
              <Play className="h-5 w-5 fill-white" />
              Saison {selectedSeason} Ép. 1
            </button>
          )}

          {youtubeTrailerId && (
            <button
              onClick={() => setActiveTab("trailer")}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-5 py-3 rounded-xl transition backdrop-blur-md"
            >
              <Film className="h-5 w-5" />
              Bande-annonce
            </button>
          )}

          {currentEpisode && (
            <button
              onClick={() =>
                router.push(
                  `/watch?type=series&id=${currentEpisode.id}&ext=${currentEpisode.container_extension || "mp4"}&title=${encodeURIComponent(
                    `${info?.name || "Série"} · S${selectedSeason} E${currentEpisode.episode_num}`
                  )}&series=${seriesId}`
                )
              }
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl transition"
              title="Ouvrir en plein écran sur /watch"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* MINI PLAYER DYNAMIQUE */}
        {activeTab !== "none" && (
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-sm font-medium text-gray-300">
                {activeTab === "episode"
                  ? `S${selectedSeason} E${currentEpisode?.episode_num} - ${currentEpisode?.title || "Épisode"}`
                  : "BANDE-ANNONCE"}
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

        {/* SECTION SELECTION DES SAISONS & EPISODES */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 border-b border-white/10">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-5 py-2.5 rounded-xl font-medium text-sm transition whitespace-nowrap ${
                  selectedSeason === s
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Saison {s}
              </button>
            ))}
          </div>

          {/* Grille des Épisodes - Typer explicitement ep: Episode */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodesList.map((ep: Episode) => {
              const isSelected = currentEpisode?.id === ep.id && activeTab === "episode";
              return (
                <div
                  key={ep.id}
                  onClick={() => handlePlayEpisode(ep)}
                  className={`group relative flex items-center gap-4 p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-purple-900/30 border-purple-500"
                      : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="relative w-24 h-16 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                    {ep.info?.movie_image ? (
                      <img
                        src={ep.info.movie_image}
                        alt={ep.title || "Episode"}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <Tv className="h-6 w-6 text-gray-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-purple-400 font-semibold">
                      ÉPISODE {ep.episode_num}
                    </p>
                    <h3 className="text-sm font-medium text-white truncate">
                      {ep.title || `Épisode ${ep.episode_num}`}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Synopsis & Acteurs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-white/10">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">SYNOPSIS</h2>
            <p className="text-gray-400 leading-relaxed text-sm">
              {info?.plot || "Aucun synopsis disponible."}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">CASTING</h2>
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