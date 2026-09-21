"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, Star, Calendar, Clock, X, User, Info, Maximize } from "lucide-react";
import { motion, AnimatePresence, Transition } from "framer-motion";
import { DetailHero } from "@/components/catalog/DetailHero";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useMovieInfo } from "@/lib/hooks";
import { useLibrary } from "@/store/library";
import { ratingNum, yearFrom, cleanName, cn } from "@/lib/utils";

const smoothTransition: Transition = {
  duration: 0.75,
  ease: [0.16, 1, 0.3, 1] as const,
};

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
      className="group perspective w-24 sm:w-28 h-36 sm:h-40 flex-shrink-0 cursor-pointer select-none focus:outline-none"
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
              <User className="w-6 h-6" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="relative z-10 p-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-white line-clamp-1">{name}</span>
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

export default function MovieDetailPage() {
  const params = useParams();
  const id = (params?.movieId || params?.id) as string;

  const { data, isLoading, isError } = useMovieInfo(id);
  const { isFav, toggleFav, progress } = useLibrary();

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  if (isLoading) return <MovieSkeleton />;
  if (isError || !data || !id)
    return <p className="px-8 py-24 text-center text-red-300">Impossible de charger le film.</p>;

  const info = data?.info || data?.movie_data || data || {};
  const movieData = data?.movie_data || {};

  const title = (info?.name as string) || (info?.title as string) || "Film";
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releasedate || info?.release_date || info?.year, title);
  const ext = movieData?.container_extension || info?.container_extension || "mp4";
  const fav = isFav("movie", Number(id));
  const resume = progress[`movie:${id}`]?.position ?? 0;

  const castList = info?.cast
    ? info.cast.split(",").map((actor: string) => actor.trim()).filter(Boolean)
    : [];

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

  return (
    <div className="min-h-screen bg-ink-950 text-white p-3 sm:p-6 space-y-6 select-none">
      <style jsx global>{`
        .perspective { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* HERO HEADER */}
      <DetailHero
        backdrop={info?.backdrop_path?.[0] || info?.backdrop_url || info?.cover_big}
        poster={info?.movie_image || info?.cover}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("movie", { id: Number(id), name: cleanName(title), poster: info?.movie_image || info?.cover })
        }
      >
        <div className="space-y-4 max-w-4xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{cleanName(title)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fog-300">
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
              {info?.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {info.duration}
                </span>
              )}
              {info?.genre && <span className="text-fog-400">{info.genre}</span>}
              <span className="uppercase text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-fog-300">
                {ext}
              </span>
            </div>
          </div>

          {(info?.plot || info?.description) && (
            <p className="text-sm leading-relaxed text-fog-300 font-light max-w-3xl">
              {info.plot || info.description}
            </p>
          )}

          {/* BOUTONS D'ACTION (LANCER APERÇU / PLEIN ÉCRAN) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setIsPlayingPreview(!isPlayingPreview)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-iris-400 text-ink-950 font-bold hover:bg-iris-300 transition-colors shadow-lg"
            >
              <Play className="w-4 h-4 fill-ink-950" />
              {isPlayingPreview ? "Fermer l'aperçu" : "Aperçu rapide"}
            </button>

            <Link
              href={`/watch?type=movie&id=${id}&ext=${ext}&title=${encodeURIComponent(
                cleanName(title)
              )}${resume > 15 ? `&resume=${Math.floor(resume)}` : ""}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink-800 text-white font-medium hover:bg-ink-700 transition-colors border border-white/10"
            >
              <Maximize className="w-4 h-4" />
              Plein écran
            </Link>
          </div>

          {/* CASTING ACTEURS */}
          {castList.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-iris-400" /> Casting / Acteurs
              </h3>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {castList.slice(0, 8).map((actor: string, idx: number) => (
                  <FlipActorCard key={idx} name={actor} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DetailHero>

      {/* BLOC LECTEUR APERÇU AMOVIBLE */}
      <AnimatePresence mode="popLayout">
        {isPlayingPreview && (
          <motion.div
            key="movie-player-preview"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={smoothTransition}
            className="w-full max-w-4xl mx-auto space-y-3 bg-ink-900 border border-white/10 rounded-2xl p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-iris-400 truncate">
                Lecture : {cleanName(title)}
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
                  onClick={() => setIsPlayingPreview(false)}
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
                  key={id}
                  sources={[
                    `/api/transcode?type=movie&id=${id}&ext=${ext}`,
                    `/api/stream-vod?type=movie&id=${id}&ext=${ext}`,
                  ]}
                  ext="mp4"
                  isLive={false}
                  title={cleanName(title)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MovieSkeleton() {
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