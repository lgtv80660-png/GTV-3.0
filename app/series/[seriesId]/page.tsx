"use client";

import { useState, useEffect, use } from "react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ArrowLeft, Play, Star, Calendar, Film } from "lucide-react";
import { cleanName, ratingNum, yearFrom } from "@/lib/utils";

export default function SeriesDetailPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const resolvedParams = use(params);
  const seriesId = resolvedParams.seriesId;

  const [seriesData, setSeriesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);

  useEffect(() => {
    async function fetchSeriesInfo() {
      try {
        const res = await fetch(`/api/series-info?id=${seriesId}`);
        if (res.ok) {
          const data = await res.json();
          setSeriesData(data);
        }
      } catch (err) {
        console.error("Erreur chargement série:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSeriesInfo();
  }, [seriesId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p>Chargement des détails de la série...</p>
      </div>
    );
  }

  // --- LECTURE D'UN ÉPISODE ---
  if (selectedEpisode) {
    const ext = selectedEpisode.container_extension || "mkv";
    
    // ✅ Endpoint VOD FFmpeg obligatoire pour les séries
    const episodeStreamUrl = `/api/stream-vod?type=series&id=${selectedEpisode.id}&ext=${ext}`;

    return (
      <div className="relative h-screen w-screen bg-black">
        <VideoPlayer
          sources={[episodeStreamUrl]}
          ext={ext}
          isLive={false}
          title={`${seriesData?.info?.name || "Série"} - S${selectedEpisode.season}E${selectedEpisode.episode}`}
          poster={seriesData?.info?.cover}
          onBack={() => setSelectedEpisode(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <button
        onClick={() => window.history.back()}
        className="mb-6 flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* Détails de la série */}
      <div className="flex gap-6">
        {seriesData?.info?.cover && (
          <img
            src={seriesData.info.cover}
            alt={seriesData.info.name}
            className="h-72 w-48 rounded-xl object-cover shadow-lg"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold">{cleanName(seriesData?.info?.name)}</h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400" /> {ratingNum(seriesData?.info?.rating)}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {yearFrom(seriesData?.info?.releasedate)}</span>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-zinc-300 leading-relaxed">
            {seriesData?.info?.plot || "Aucun résumé disponible."}
          </p>
        </div>
      </div>

      {/* Liste des épisodes */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Épisodes</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Object.keys(seriesData?.episodes || {}).map((seasonKey) =>
            seriesData.episodes[seasonKey].map((ep: any) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEpisode(ep)}
                className="flex items-center justify-between rounded-xl bg-zinc-900 p-4 hover:bg-zinc-800 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-sm">S{ep.season}E{ep.episode} - {cleanName(ep.title || `Épisode ${ep.episode}`)}</p>
                </div>
                <Play className="h-5 w-5 text-indigo-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}