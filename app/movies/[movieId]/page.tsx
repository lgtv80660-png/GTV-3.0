"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Star, Calendar, Clock, User, Info, Maximize, Play } from "lucide-react";
import { motion } from "framer-motion";
import { DetailHero } from "@/components/catalog/DetailHero";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useLibrary } from "@/store/library";
import { ratingNum, yearFrom, cleanName, cn } from "@/lib/utils";

function useVodInfo(id: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetch(`/api/vod-info?id=${encodeURIComponent(id)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load movie information");
        return response.json();
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, isLoading, isError };
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

export default function MovieDetailPage() {
  const params = useParams();
  // Support pour [movieId] ou [id]
  const id = (params?.movieId || params?.id) as string;

  const { data, isLoading, isError } = useVodInfo(id);
  const { isFav, toggleFav } = useLibrary();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const actorScrollRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // === DRAG HORIZONTAL TACTILE POUR PC (Acteurs) ===
  const isDragX = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isDraggingX, setIsDraggingX] = useState(false);

  // Typage en "any" pour éviter les erreurs TS strictes avec useRef
  const onMouseDownX = (e: React.MouseEvent<HTMLDivElement>, ref: any) => {
    if (!ref.current) return;
    isDragX.current = true;
    setIsDraggingX(false);
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  };

  const onMouseMoveX = (e: React.MouseEvent<HTMLDivElement>, ref: any) => {
    if (!isDragX.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(walk) > 5) {
      setIsDraggingX(true);
    }
    ref.current.scrollLeft = scrollLeft.current - walk;
  };

  const onMouseUpOrLeaveX = () => {
    isDragX.current = false;
    setTimeout(() => setIsDraggingX(false), 50);
  };

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

  if (isLoading) return <MovieSkeleton />;
  if (isError || !data || !id)
    return <p className="px-8 py-24 text-center text-red-300">Impossible de charger le film.</p>;

  // L'API Xtream renvoie souvent les infos dans info ou movie_data
  const info = data?.info || data?.movie_data || data || {};
  const title = (info?.name as string) || (info?.title as string) || "Film";
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releaseDate || info?.releasedate, title);
  const fav = isFav("movies", Number(id));
  const ext = info?.container_extension || data?.movie_data?.container_extension || "mp4";

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
        poster={info?.cover || info?.movie_image}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("movies", { id: Number(id), name: cleanName(title), poster: info?.cover || info?.movie_image })
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
              {info?.duration && (
                <span className="flex items-center gap-1 text-fog-400">
                  <Clock className="w-3.5 h-3.5" /> {info.duration}
                </span>
              )}
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
              <div 
                ref={actorScrollRef}
                onMouseDown={(e) => onMouseDownX(e, actorScrollRef)}
                onMouseMove={(e) => onMouseMoveX(e, actorScrollRef)}
                onMouseUp={onMouseUpOrLeaveX}
                onMouseLeave={onMouseUpOrLeaveX}
                onClickCapture={(e) => { if (isDraggingX) e.stopPropagation(); }}
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-none cursor-grab active:cursor-grabbing"
              >
                {castList.slice(0, 8).map((actor: string, idx: number) => (
                  <FlipActorCard key={idx} name={actor} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DetailHero>

      {/* LECTEUR VIDÉO FILM */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl mx-auto space-y-3 pt-4"
      >
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-iris-400" /> Film Complet
          </h2>
          <div className="flex items-center gap-3">
            <span className="uppercase text-[10px] font-bold bg-white/10 px-2 py-1 rounded text-fog-300">
              {ext}
            </span>
            <button
              onClick={handleFullscreenLandscape}
              className="text-fog-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <Maximize className="w-4 h-4" /> <span className="hidden sm:inline">Plein Écran</span>
            </button>
          </div>
        </div>

        <div
          ref={playerContainerRef}
          onClick={handleDoubleTap}
          className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl cursor-pointer group"
        >
          <div className="absolute inset-0 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_video]:w-full [&_video]:h-full [&_video]:object-contain">
            <VideoPlayer
              key={id}
              sources={[
                ext === "mp4"
                  ? `/api/stream-vod?type=movie&id=${id}&ext=mp4`
                  : `/api/transcode?type=movie&id=${id}&ext=${ext}`
              ]}
              ext={ext}
              isLive={false}
              title={cleanName(title)}
            />
          </div>
        </div>
      </motion.div>
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
      <div className="mt-12 w-full max-w-6xl mx-auto">
         <Skeleton className="aspect-video w-full rounded-2xl" />
      </div>
    </div>
  );
}