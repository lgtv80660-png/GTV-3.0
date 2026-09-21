"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, Star, Calendar, Clock, Maximize, User, Info } from "lucide-react";
import { DetailHero } from "@/components/catalog/DetailHero";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLibrary } from "@/store/library";
import { ratingNum, yearFrom, cleanName, cn } from "@/lib/utils";

function useMovieInfo(id: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      setIsError(true);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setIsError(false);

    fetch(`/api/vod/info?id=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load movie information");
        return response.json();
      })
      .then((result) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setIsError(true);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  return { data, isLoading, isError };
}

export default function MovieDetailPage() {
  const params = useParams();
  const id = (params?.movieId || params?.id) as string;

  const { data, isLoading, isError } = useMovieInfo(id);
  const { isFav, toggleFav, progress } = useLibrary();

  const [isPlaying, setIsPlaying] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  if (isLoading) return <MovieSkeleton />;
  if (isError || !data || !id)
    return <p className="px-8 py-24 text-center text-red-300">Impossible de charger ce film.</p>;

  const info = data?.info || data?.movie_data || {};
  const movieData = data?.movie_data || {};

  const title = (info?.name as string) || (movieData?.name as string) || "Film";
  const rating = ratingNum(info?.rating || movieData?.rating);
  const year = yearFrom(info?.releasedate || movieData?.added, title);
  const ext = movieData?.container_extension || info?.container_extension || "mp4";
  const fav = isFav("vod", Number(id));
  const resume = progress[`vod:${id}`]?.position ?? 0;

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
    <div className="min-h-screen bg-ink-950 text-white p-3 sm:p-6 space-y-6 select-none pb-24">
      {/* HERO BANNIÈRE */}
      <DetailHero
        backdrop={info?.backdrop_path?.[0] || info?.backdrop}
        poster={info?.movie_image || info?.cover}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("vod", {
            id: Number(id),
            name: cleanName(title),
            poster: info?.movie_image || info?.cover,
          })
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
              {info?.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {info.duration}
                </span>
              )}
              {info?.genre && <span className="text-fog-400">{info.genre}</span>}
            </div>
          </div>

          {(info?.plot || info?.description) && (
            <p className="text-xs sm:text-sm leading-relaxed text-fog-300 font-light line-clamp-3 sm:line-clamp-none">
              {info.plot || info.description}
            </p>
          )}

          {/* BOUTONS D'ACTION (Bande-annonce / Lecture) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!isPlaying && (
              <button
                onClick={() => setIsPlaying(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iris-400 text-ink-950 font-bold text-xs sm:text-sm hover:bg-iris-300 transition-colors shadow-lg"
              >
                <Play className="w-4 h-4 fill-ink-950" />
                Regarder l'Aperçu
              </button>
            )}

            <Link
              href={`/watch?type=movie&id=${id}&ext=${ext}&title=${encodeURIComponent(
                cleanName(title)
              )}${resume > 15 ? `&resume=${Math.floor(resume)}` : ""}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs sm:text-sm hover:bg-white/20 transition-colors border border-white/10"
            >
              <Maximize className="w-4 h-4" />
              {resume > 15 ? "Reprendre en Plein Écran" : "Plein Écran"}
            </Link>
          </div>
        </div>
      </DetailHero>

      {/* LECTEUR APERÇU (SI ACTIVÉ) */}
      {isPlaying && (
        <div className="space-y-3 bg-ink-900 border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl max-w-4xl mx-auto">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-iris-400 truncate">
              Aperçu : {cleanName(title)}
            </h2>
            <button
              onClick={() => setIsPlaying(false)}
              className="text-xs text-fog-400 hover:text-white px-2 py-1 rounded bg-white/5"
            >
              Fermer
            </button>
          </div>

          <div
            ref={playerContainerRef}
            onClick={handleDoubleTap}
            className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/5 cursor-pointer shadow-inner"
          >
            <div className="absolute inset-0 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_video]:w-full [&_video]:h-full [&_video]:object-contain">
              <VideoPlayer
                key={id}
                sources={[`/api/stream?type=movie&id=${id}&ext=${ext}`]}
                ext={ext}
                isLive={false}
                title={cleanName(title)}
              />
            </div>
          </div>
        </div>
      )}
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