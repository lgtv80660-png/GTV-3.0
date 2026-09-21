"use client";

import React, { useState, useMemo, useRef } from "react";
import { Search, Tv, Maximize, Play, Star, ChevronRight } from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useLiveStreams, useLiveCategories } from "@/lib/hooks";
import { useLibrary } from "@/store/library";
import { Skeleton } from "@/components/ui/Skeleton";
import { cleanName, cn } from "@/lib/utils";

type LiveStream = {
  stream_id: string | number;
  name?: string;
  category_id?: string | number;
  stream_icon?: string;
  num?: string | number;
};

export default function LivePage() {
  const { data: categoriesData, isLoading: isCatLoading } = useLiveCategories();
  const { data: streamsData, isLoading: isStreamsLoading } = useLiveStreams();
  const { isFav, toggleFav } = useLibrary();

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<LiveStream | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const categories = categoriesData || [];
  const streams = streamsData || [];

  // Filtrage des chaînes avec protection contre `undefined`
  const filteredStreams = useMemo(() => {
    return streams.filter((stream: LiveStream) => {
      const streamName = stream.name || "";
      const matchCat = selectedCat ? String(stream.category_id) === String(selectedCat) : true;
      const matchQuery = searchQuery
        ? streamName.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchCat && matchQuery;
    });
  }, [streams, selectedCat, searchQuery]);

  const handleFullscreenLandscape = async () => {
    const elem = playerContainerRef.current;
    if (!elem) return;

    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      }

      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        await (window.screen.orientation as any).lock("landscape").catch(() => {});
      }
    } catch (err) {
      console.error("Erreur Plein Écran:", err);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleFullscreenLandscape();
    }
    lastTapRef.current = now;
  };

  const isLoading = isCatLoading || isStreamsLoading;

  return (
    <div className="min-h-screen bg-ink-950 text-white p-3 sm:p-6 space-y-4 select-none pb-24">
      {/* BARRE DE RECHERCHE ET CATÉGORIES */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fog-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une chaîne..."
            className="w-full bg-ink-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-fog-500 focus:outline-none focus:border-iris-400 transition-colors"
          />
        </div>

        {/* DÉFILLEMENT DES CATÉGORIES */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-white/5">
          <button
            onClick={() => setSelectedCat(null)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors",
              selectedCat === null
                ? "bg-iris-400 text-ink-950 font-bold"
                : "bg-ink-850 text-fog-400 hover:bg-ink-800 hover:text-white"
            )}
          >
            Toutes les chaînes
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCat(cat.category_id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                String(selectedCat) === String(cat.category_id)
                  ? "bg-iris-400 text-ink-950 font-bold"
                  : "bg-ink-850 text-fog-400 hover:bg-ink-800 hover:text-white"
              )}
            >
              {cat.category_name}
            </button>
          ))}
        </div>
      </div>

      {/* DISPOSITION PRINCIPALE (LECTEUR 60% / LISTE 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LECTEUR DE FLUX EN DIRECT (HLS) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3 lg:sticky lg:top-6 z-30">
          <div
            ref={playerContainerRef}
            onClick={handleDoubleTap}
            className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl"
          >
            {activeChannel ? (
              <div className="absolute inset-0 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_video]:w-full [&_video]:h-full [&_video]:object-contain">
                <VideoPlayer
                  key={activeChannel.stream_id}
                  sources={[
                    `/api/hls?id=${activeChannel.stream_id}`, // Système HLS exact de gtv2
                  ]}
                  ext="m3u8"
                  isLive={true}
                  title={cleanName(activeChannel.name || "")}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-fog-500 bg-ink-900/50 p-6 text-center">
                <Tv className="w-12 h-12 text-fog-600 animate-pulse" />
                <p className="text-sm font-medium text-fog-400">
                  Sélectionnez une chaîne dans la liste pour démarrer la lecture en direct.
                </p>
              </div>
            )}
          </div>

          {/* BARRE D'INFOS CHAÎNE ACTIVE */}
          {activeChannel && (
            <div className="flex items-center justify-between p-3.5 bg-ink-900 border border-white/10 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                {activeChannel.stream_icon && (
                  <img
                    src={activeChannel.stream_icon}
                    alt={activeChannel.name || "Chaîne"}
                    className="w-10 h-10 object-contain rounded-lg bg-black/40 p-1 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">
                    {cleanName(activeChannel.name || "")}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    En Direct (HLS)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    toggleFav("live", {
                      id: Number(activeChannel.stream_id),
                      name: cleanName(activeChannel.name || ""),
                      poster: activeChannel.stream_icon,
                    })
                  }
                  className="p-2 text-fog-400 hover:text-iris-300 rounded-lg transition-colors"
                  title="Ajouter aux favoris"
                >
                  <Star
                    className={cn(
                      "w-5 h-5",
                      isFav("live", Number(activeChannel.stream_id))
                        ? "fill-iris-300 text-iris-300"
                        : ""
                    )}
                  />
                </button>
                <button
                  onClick={handleFullscreenLandscape}
                  className="p-2 text-fog-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  title="Plein Écran Horizontal"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LISTE DES CHAÎNES SCROLLABLE */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-fog-400">
              Chaînes ({filteredStreams.length})
            </span>
          </div>

          <div className="space-y-1.5 max-h-[60vh] lg:max-h-[75vh] overflow-y-auto pr-1 scrollbar-none">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))
              : filteredStreams.map((stream: LiveStream) => {
                  const isSelected = activeChannel?.stream_id === stream.stream_id;
                  const fav = isFav("live", Number(stream.stream_id));

                  return (
                    <div
                      key={stream.stream_id}
                      onClick={() => setActiveChannel(stream)}
                      className={cn(
                        "group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                        isSelected
                          ? "bg-ink-800 border-iris-500/60 shadow-md"
                          : "bg-ink-900/60 border-white/5 hover:bg-ink-850"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 shrink-0 rounded-lg bg-black/50 border border-white/5 flex items-center justify-center overflow-hidden">
                          {stream.stream_icon ? (
                            <img
                              src={stream.stream_icon}
                              alt=""
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Tv className="w-5 h-5 text-fog-500" />
                          )}
                          {isSelected && (
                            <span className="absolute inset-0 bg-iris-500/20 flex items-center justify-center">
                              <Play className="w-4 h-4 fill-iris-300 text-iris-300" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-xs font-medium truncate transition-colors",
                              isSelected ? "text-iris-300 font-bold" : "text-white"
                            )}
                          >
                            {cleanName(stream.name || "")}
                          </p>
                          <span className="text-[10px] text-fog-500">Chaîne #{stream.num || stream.stream_id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {fav && <Star className="w-3.5 h-3.5 fill-iris-300 text-iris-300" />}
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 text-fog-500 transition-transform group-hover:translate-x-0.5",
                            isSelected ? "text-iris-300" : ""
                          )}
                        />
                      </div>
                    </div>
                  );
                })}

            {!isLoading && filteredStreams.length === 0 && (
              <p className="text-xs text-center py-8 text-fog-500">
                Aucune chaîne disponible dans cette catégorie.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}