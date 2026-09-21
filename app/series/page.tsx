"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSeriesInfo } from "@/lib/hooks";
import { Play, Film, Star, ArrowLeft, Maximize2, X, Loader2, Tv } from "lucide-react";
import type { Episode } from "@/lib/xtream/types";

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();

  // Supporte [seriesId] ou [id] selon le nom du dossier
  const seriesIdParam = params?.seriesId || params?.id;
  const seriesId = Array.isArray(seriesIdParam) ? seriesIdParam[0] : String(seriesIdParam || "");

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"none" | "trailer" | "episode">("none");
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  // Chargement des informations de la série
  const { data: seriesData, isLoading, isError } = useSeriesInfo(seriesId);

  const info = seriesData?.info;
  const seasonsEpisodes = seriesData?.episodes || {};

  // Saisons ordonnées
  const seasons = useMemo(() => {
    return Object.keys(seasonsEpisodes)
      .map(Number)
      .sort((a, b) => a - b);
  }, [seasonsEpisodes]);

  // Liste des épisodes de la saison active
  const episodesList = useMemo<Episode[]>(() => {
    return seasonsEpisodes[String(selectedSeason)] || [];
  }, [seasonsEpisodes, selectedSeason]);

  // Lancement rapide dans le mini-lecteur
  const handlePlayEpisode = (ep: Episode) => {
    setCurrentEpisode(ep);
    setActiveTab("episode");
  };

  const streamUrl = useMemo(() => {
    if (!currentEpisode) return "";
    const ext = currentEpisode.container_extension || "mp4";
    return `/api/stream-vod?type=series&id=${currentEpisode.id}&ext=${ext}`;
  }, [currentEpisode]);

  // Certains flux Xtream ajoutent cette propriété sans la déclarer dans SeriesItem.
  const youtubeTrailerId = (info as { youtube_trailer?: string } | undefined)?.youtube_trailer;
  const bannerImage = (info as { backdrop_path?: string[] } | undefined)?.backdrop_path?.[0] || info?.cover;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d0e12] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0d0e12] text-white p-6">
        <p className="text-red-500 font-semibold mb-4 text-lg">Impossible de charger les informations de la série.</p>
        <button
          onClick={() => router.push("/series")}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-xl transition text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white relative">
      {/* BANNIÈRE HERO EN ARRIÈRE-PLAN */}
      {bannerImage && (
        <div className="absolute top-0 left-0 right-0 h-[480px] overflow-hidden pointer-events-none z-0">
          <img
            src={bannerImage}
            alt={info?.name || "Série"}
            className="w-full h-full object-cover opacity-25 blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e12]/40 via-[#0d0e12]/80 to-[#0d0e12]" />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-16 space-y-8">
        {/* BOUTON RETOUR */}
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
        </div>

        {/* CONTENU PRINCIPAL DE LA SÉRIE (POSTER + DÉTAILS) */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* POSTER SÉRIE */}
          {info?.cover && (
            <div className="w-48 md:w-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/50 aspect-[2/3] relative group">
              <img
                src={info.cover}
                alt={info.name || "Affiche"}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* INFORMATIONS SÉRIE */}
          <div className="flex-1 space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
              {info?.name || "Titre de la série"}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
              {info?.rating && (
                <span className="flex items-center gap-1.5 text-yellow-400 font-semibold bg-yellow-400/10 px-3 py-1 rounded-lg border border-yellow-400/20">
                  <Star className="h-4 w-4 fill-yellow-400" />
                  {Number(info.rating).toFixed(1)}
                </span>
              )}
              {info?.releaseDate && (
                <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                  {info.releaseDate.split("-")[0]}
                </span>
              )}
              {info?.genre && (
                <span className="text-purple-400 font-medium">
                  {info.genre}
                </span>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {episodesList.length > 0 && (
                <button
                  onClick={() => handlePlayEpisode(episodesList[0])}
                  className="flex items-center gap-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3.5 rounded-xl transition shadow-lg shadow-purple-900/40"
                >
                  <Play className="h-5 w-5 fill-white" />
                  Regarder S{selectedSeason} E1
                </button>
              )}

              {youtubeTrailerId && (
                <button
                  onClick={() => setActiveTab("trailer")}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-5 py-3.5 rounded-xl transition backdrop-blur-md border border-white/10"
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
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 px-5 py-3.5 rounded-xl transition border border-white/10 font-medium"
                  title="Ouvrir en plein écran sur /watch"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>Plein écran (/watch)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MINI LECTEUR INTÉGRÉ SUR LA PAGE */}
        {activeTab !== "none" && (
          <div className="relative w-full max-w-4xl mx-auto aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
              <span className="text-sm font-medium text-gray-200">
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

        {/* ONGLETS DES SAISONS & GRILLE DES ÉPISODES */}
        <div className="space-y-6 pt-6">
          <h2 className="text-xl font-bold tracking-tight text-gray-100">Saisons & Épisodes</h2>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/10 scrollbar-none">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition whitespace-nowrap ${
                  selectedSeason === s
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                }`}
              >
                Saison {s}
              </button>
            ))}
          </div>

          {/* GRILLE DES ÉPISODES (Typage strict ep: Episode) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodesList.map((ep: Episode) => {
              const isSelected = currentEpisode?.id === ep.id && activeTab === "episode";
              return (
                <div
                  key={ep.id}
                  onClick={() => handlePlayEpisode(ep)}
                  className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-900/30"
                      : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="relative w-28 h-18 rounded-xl bg-black/50 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                    {ep.info?.movie_image ? (
                      <img
                        src={ep.info.movie_image}
                        alt={ep.title || "Episode"}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <Tv className="h-6 w-6 text-gray-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-purple-400 font-bold tracking-wider uppercase">
                      Épisode {ep.episode_num}
                    </p>
                    <h3 className="text-sm font-semibold text-white truncate">
                      {ep.title || `Épisode ${ep.episode_num}`}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SYNOPSIS & ACTEURS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/10">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-lg font-bold text-gray-200">Synopsis</h2>
            <p className="text-gray-400 leading-relaxed text-sm">
              {info?.plot || "Aucun synopsis disponible."}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-200">Distribution / Casting</h2>
            <div className="flex flex-wrap gap-2">
              {info?.cast ? (
                String(info.cast)
                  .split(",")
                  .map((actor: string, i: number) => (
                    <span
                      key={i}
                      className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs text-gray-300 font-medium"
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