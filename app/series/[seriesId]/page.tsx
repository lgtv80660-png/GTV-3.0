"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, Star, Calendar, Clock, X, User, Info, Maximize } from "lucide-react";
import { motion, AnimatePresence, Transition } from "framer-motion";
import { DetailHero } from "@/components/catalog/DetailHero";
import { SmartImage } from "@/components/ui/SmartImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useSeriesInfo } from "@/lib/hooks";
import { useLibrary } from "@/store/library";
import { ratingNum, yearFrom, cleanName, cn } from "@/lib/utils";
import type { Episode } from "@/lib/xtream/types";

const smoothTransition: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1] as const,
};

function EpisodeImage({
  ep,
  seriesTitle,
  tmdbId,
  seasonKey,
  fallbackCover,
}: {
  ep: any;
  seriesTitle: string;
  tmdbId?: string | number;
  seasonKey: string;
  fallbackCover?: string;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(ep.info?.movie_image || null);

  useEffect(() => {
    if (ep.info?.movie_image) return;

    let isMounted = true;
    const cleanSeason = seasonKey.replace(/\D/g, "") || "1";

    fetch(
      `/api/episode-image?tmdbId=${tmdbId || ""}&show=${encodeURIComponent(
        seriesTitle
      )}&season=${cleanSeason}&episode=${ep.episode_num || ep.episode}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.imageUrl) {
          setImgSrc(data.imageUrl);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [ep, seriesTitle, tmdbId, seasonKey]);

  return (
    <SmartImage
      src={imgSrc || fallbackCover}
      alt={ep.title || "Episode"}
      rounded="rounded-lg"
      className="h-full w-full object-cover pointer-events-none"
    />
  );
}

const FlipActorCard = ({ name }: { name: string }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string>("Chargement...");
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data?.photoUrl) setPhotoUrl(data.photoUrl);
          if (data?.bio) setBio(data.bio);
        }
      })
      .catch(() => {
        if (isMounted) setBio("Information non disponible.");
      });
    return () => {
      isMounted = false;
    };
  }, [name]);

  return (
    <div
      tabIndex={0}
      onClick={() => setIsFlipped(!isFlipped)}
      className="group perspective w-20 sm:w-28 h-32 sm:h-40 flex-shrink-0 cursor-pointer select-none focus:outline-none"
    >
      <div
        className={cn(
          "relative w-full h-full rounded-xl transition-transform duration-500 transform-style-3d",
          isFlipped ? "rotate-y-180" : "group-hover:scale-105"
        )}
      >
        <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-[#181a24] border border-white/10 shadow-lg backface-hidden flex flex-col justify-end">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-950/40 text-indigo-400">
              <User className="w-5 h-5" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="relative z-10 p-1.5 flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold text-white line-clamp-1">{name}</span>
            <Info className="w-2.5 h-2.5 text-indigo-400 opacity-70 flex-shrink-0" />
          </div>
        </div>

        <div className="absolute inset-0 w-full h-full rounded-xl p-2 bg-gradient-to-br from-indigo-950 to-[#12141c] border border-indigo-500/40 text-white backface-hidden rotate-y-180 flex flex-col justify-between shadow-xl">
          <div className="space-y-0.5 overflow-hidden">
            <p className="text-[9px] font-bold text-indigo-300 line-clamp-1">{name}</p>
            <p className="text-[8px] text-zinc-300 leading-tight line-clamp-4">{bio}</p>
          </div>
          <span className="text-[7px] text-zinc-500 italic self-end">Retourner</span>
        </div>
      </div>
    </div>
  );
};

export default function SeriesDetailPage() {
  const params = useParams();
  const id = (params?.seriesId || params?.id) as string;

  const { data, isLoading, isError } = useSeriesInfo(id);
  const { isFav, toggleFav, progress } = useLibrary();

  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const isMouseDown = useRef(false);
  const startY = useRef(0);
  const scrollTop = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isMouseDown.current = true;
    setIsDragging(false);
    startY.current = e.pageY - scrollRef.current.offsetTop;
    scrollTop.current = scrollRef.current.scrollTop;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !scrollRef.current) return;
    e.preventDefault();
    const y = e.pageY - scrollRef.current.offsetTop;
    const walk = (y - startY.current) * 1.5;
    if (Math.abs(walk) > 5) {
      setIsDragging(true);
    }
    scrollRef.current.scrollTop = scrollTop.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };

  const info = data?.info || data?.series_info || (data && !data.episodes ? data : {}) || {};
  const episodesBySeason = data?.episodes ?? {};

  const seasons = useMemo(() => {
    if (!episodesBySeason) return [];
    return Object.keys(episodesBySeason)
      .filter((k) => (episodesBySeason[k] ?? []).length > 0)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB;
      });
  }, [episodesBySeason]);

  const activeSeasonKey = seasonKey ?? seasons[0] ?? null;
  const episodes = activeSeasonKey !== null ? episodesBySeason[activeSeasonKey] ?? [] : [];

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

  if (isLoading) return <SeriesSkeleton />;
  if (isError || !data || !id)
    return <p className="px-8 py-24 text-center text-red-300">Impossible de charger la série.</p>;

  const title = (info?.name as string) || (info?.title as string) || "Série";
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releaseDate || info?.releasedate, title);
  const fav = isFav("series", Number(id));

  const castList = info?.cast
    ? info.cast.split(",").map((actor: string) => actor.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-ink-950 text-white p-3 sm:p-6 space-y-6 select-none pb-24">
      <style jsx global>{`
        .perspective { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* HERO BANNIÈRE & INFOS */}
      <DetailHero
        backdrop={info?.backdrop_path?.[0] || info?.backdrop}
        poster={info?.cover}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("series", { id: Number(id), name: cleanName(title), poster: info?.cover })
        }
      >
        <div className="space-y-4 max-w-4xl">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{cleanName(title)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-fog-300">
              {rating > 0 && (
                <span className="flex items-center gap-1 font-semibold text-iris-300">
                  <Star className="h-4 w-4 fill-iris-300" /> {rating.toFixed(1)}
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> {year}
                </span>
              )}
              {info?.genre && <span className="text-fog-400">{info.genre}</span>}
              <span className="text-fog-500">
                {seasons.length} saison{seasons.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {(info?.plot || info?.description) && (
            <p className="text-xs sm:text-sm leading-relaxed text-fog-300 font-light line-clamp-3 sm:line-clamp-none">
              {info.plot || info.description}
            </p>
          )}

          {castList.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-iris-400" /> Casting / Acteurs
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {castList.slice(0, 8).map((actor: string, idx: number) => (
                  <FlipActorCard key={idx} name={actor} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DetailHero>

      {/* SECTEUR DES SAISONS & ÉPISODES */}
      <div className="space-y-4 pt-2">
        {/* ONGLETS DE SAISONS */}
        {seasons.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 scrollbar-none">
            {seasons.map((s) => {
              const label =
                s.toLowerCase().includes("season") || s.toLowerCase().includes("saison")
                  ? s
                  : `Saison ${s}`;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSeasonKey(s);
                    setActiveEpisode(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                    s === activeSeasonKey
                      ? "bg-iris-400 text-ink-950 font-bold"
                      : "bg-ink-800 text-fog-400 hover:bg-ink-700 hover:text-white"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* LECTEUR APERÇU + LISTE DES ÉPISODES */}
        <motion.div
          layout="position"
          transition={smoothTransition}
          className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start relative w-full"
        >
          {/* LECTEUR EN MOBILE (STICKY SUR ÉCRAN SI SELECTIONNÉ) */}
          <AnimatePresence mode="popLayout">
            {activeEpisode && (
              <motion.div
                key="player-block"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={smoothTransition}
                className="w-full lg:w-[40%] shrink-0 space-y-2.5 bg-ink-900 border border-white/10 rounded-2xl p-3 sm:p-4 sticky top-2 z-40 shadow-2xl"
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-iris-400 truncate max-w-[70%]">
                    S{activeEpisode.season || activeSeasonKey}E
                    {activeEpisode.episode_num || activeEpisode.episode} -{" "}
                    {cleanName(activeEpisode.title || "")}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleFullscreenLandscape}
                      className="text-fog-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                      title="Plein Écran Horizontal"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveEpisode(null)}
                      className="text-fog-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                      title="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={playerContainerRef}
                  onClick={handleDoubleTap}
                  className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/5 cursor-pointer shadow-inner"
                >
                  <div className="absolute inset-0 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_video]:w-full [&_video]:h-full [&_video]:object-contain">
                    <VideoPlayer
                      key={activeEpisode.id}
                      sources={[
                        activeEpisode.container_extension === "mp4"
                          ? `/api/stream-vod?type=series&id=${activeEpisode.id}&ext=mp4`
                          : `/api/transcode?type=series&id=${activeEpisode.id}&ext=${
                              activeEpisode.container_extension || "mkv"
                            }`,
                      ]}
                      ext={activeEpisode.container_extension || "mp4"}
                      isLive={false}
                      title={`${title} - S${activeEpisode.season || activeSeasonKey}E${
                        activeEpisode.episode_num || activeEpisode.episode
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-1.5 border-t border-white/10 space-y-1 px-1">
                  <div className="flex items-center gap-3 text-[11px] text-fog-400">
                    {activeEpisode.info?.duration && (
                      <span className="flex items-center gap-1 font-medium text-white">
                        <Clock className="w-3 h-3 text-iris-400" />
                        {activeEpisode.info.duration}
                      </span>
                    )}
                    {info?.genre && <span className="text-fog-500">• {info.genre}</span>}
                    <span className="uppercase text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded text-fog-300">
                      {activeEpisode.container_extension || "mp4"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LISTE D'ÉPISODES SCROLLABLE */}
          <motion.div
            layout="position"
            transition={smoothTransition}
            className={cn(
              "w-full transition-all duration-500",
              activeEpisode ? "lg:w-[60%]" : "lg:w-full"
            )}
          >
            <div
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex-1 w-full space-y-2 sm:space-y-2.5 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto pr-1 scrollbar-none cursor-grab active:cursor-grabbing select-none"
            >
              {episodes.map((ep: Episode) => {
                const isSelected = activeEpisode?.id === ep.id;
                const ext = ep.container_extension || "mp4";
                const epTitle = ep.title || `Episode ${ep.episode_num || ep.episode}`;
                const resume = progress[`series:${ep.id}`]?.position ?? 0;

                return (
                  <div
                    key={ep.id}
                    onClick={() => {
                      if (!isDragging) {
                        setActiveEpisode(ep);
                      }
                    }}
                    className={cn(
                      "group flex items-center gap-3 sm:gap-4 rounded-xl border p-2 sm:p-2.5 transition-colors duration-300 cursor-pointer",
                      isSelected
                        ? "bg-ink-800 border-iris-500/50 shadow-md"
                        : "bg-ink-850/60 border-white/5 hover:bg-ink-800"
                    )}
                  >
                    <div className="relative aspect-video w-24 sm:w-36 shrink-0 overflow-hidden rounded-lg bg-ink-900 pointer-events-none">
                      <EpisodeImage
                        ep={ep}
                        seriesTitle={cleanName(title)}
                        tmdbId={info?.tmdb_id}
                        seasonKey={activeSeasonKey || "1"}
                        fallbackCover={info?.cover || info?.backdrop}
                      />
                      <span className="absolute inset-0 grid place-items-center bg-ink-950/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-iris-400 text-ink-950">
                          <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 translate-x-0.5 fill-ink-950" />
                        </span>
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pointer-events-none">
                      <p className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                        <span className="text-fog-500">{ep.episode_num || ep.episode}.</span>
                        <span className="truncate group-hover:text-iris-300 transition-colors">
                          {cleanName(epTitle)}
                        </span>
                      </p>
                      {ep.info?.duration && (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-xs text-fog-500">
                          <Clock className="h-3 w-3" /> {ep.info.duration}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/watch?type=series&id=${ep.id}&ext=${ext}&title=${encodeURIComponent(
                        `${cleanName(title)} ·${epTitle}`
                      )}&series=${id}${resume > 15 ? `&resume=${Math.floor(resume)}` : ""}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-fog-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                      title="Lire en plein écran"
                    >
                      <Maximize className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
              {episodes.length === 0 && (
                <p className="text-xs sm:text-sm text-fog-500">
                  Aucun épisode répertorié pour cette saison.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function SeriesSkeleton() {
  return (
    <div className="px-5 pt-40 sm:px-8">
      <div className="flex gap-6">
        <Skeleton className="hidden aspect-[2/3] w-44 sm:block" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  );
}