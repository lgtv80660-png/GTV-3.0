"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Star, Calendar, Clock, User, Info, Maximize, Play, Film, X, BookOpen } from "lucide-react";
import { motion, AnimatePresence, Transition } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { DetailHero } from "@/components/catalog/DetailHero";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useLibrary } from "@/store/library";
import { ratingNum, yearFrom, cleanName, cn } from "@/lib/utils";

const smoothTransition: Transition = {
  duration: 0.6,
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
  const id = (params?.movieId || params?.id) as string;

  // État pour afficher ou masquer le lecteur
  const [isPlaying, setIsPlaying] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["movie-info", id],
    queryFn: async () => {
      let res = await fetch(`/api/movie-info?id=${id}&vod_id=${id}`);
      if (!res.ok) {
        res = await fetch(`/api/xtream?action=get_vod_info&vod_id=${id}`);
      }
      if (!res.ok) throw new Error("Impossible de charger les données");
      return res.json();
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });

  const { isFav, toggleFav } = useLibrary();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const actorScrollRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // Drag Horizontal
  const isDragX = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isDraggingX, setIsDraggingX] = useState(false);

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

      {/* HERO BANNIÈRE */}
      <DetailHero
        backdrop={info?.backdrop_path?.[0] || info?.backdrop}
        poster={info?.cover || info?.movie_image}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("movies", { id: Number(id), name: cleanName(title), poster: info?.cover || info?.movie_image })
        }
      >
        <div className="space-y-5 max-w-4xl">
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
              {cleanName(title)}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-fog-200">
              {rating > 0 && (
                <span className="flex items-center gap-1 font-bold text-yellow-400 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                  <Star className="h-4 w-4 fill-yellow-400" /> {rating.toFixed(1)}
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 opacity-70" /> {year}
                </span>
              )}
              {info?.genre && <span className="opacity-90">{info.genre}</span>}
              {info?.duration && (
                <span className="flex items-center gap-1 opacity-90">
                  <Clock className="w-4 h-4 opacity-70" /> {info.duration}
                </span>
              )}
            </div>
          </div>

          {/* BOUTONS D'ACTION (Apparaissent quand le film n'est pas lancé) */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="flex items-center gap-3 pt-2"
              >
                <button
                  onClick={() => setIsPlaying(true)}
                  className="bg-iris-600 hover:bg-iris-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-white" /> Play
                </button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanName(title) + " trailer bande annonce")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-ink-900/80 hover:bg-ink-800 border border-white/10 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors backdrop-blur-md"
                >
                  <Film className="w-5 h-5 text-red-500" /> Bande-annonce
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DetailHero>

      {/* ZONE DYNAMIQUE (Lecteur + Infos) */}
      <motion.div
        layout="position"
        transition={smoothTransition}
        className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start relative w-full pt-2"
      >
        {/* LECTEUR VIDÉO (Apparaît si isPlaying est true) */}
        <AnimatePresence mode="popLayout">
          {isPlaying && (
            <motion.div
              key="movie-player"
              initial={{ opacity: 0, scale: 0.95, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -20 }}
              transition={smoothTransition}
              className="w-full lg:w-[60%] shrink-0 space-y-2.5 bg-[#12141c] border border-white/10 rounded-2xl p-3 sm:p-4 sticky top-4 z-40 shadow-2xl"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-iris-400 truncate max-w-[70%]">
                  {cleanName(title)}
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
                    onClick={() => setIsPlaying(false)}
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
          )}
        </AnimatePresence>

        {/* COLONNE DES INFORMATIONS (Synopsis & Casting) */}
        <motion.div
          layout="position"
          transition={smoothTransition}
          className={cn(
            "flex-1 w-full space-y-4 sm:space-y-6 transition-all duration-500",
            isPlaying ? "lg:w-[40%]" : "lg:w-full"
          )}
        >
          {/* CARTE SYNOPSIS */}
          <div className="bg-[#181a24] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-lg">
            <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-iris-400" /> Synopsis & Histoire
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-fog-300 font-light">
              {info?.plot || info?.description || "Aucun synopsis disponible pour ce film."}
            </p>
            {info?.director && (
              <p className="mt-4 text-xs text-fog-400">
                Réalisateur : <span className="font-medium text-white">{info.director}</span>
              </p>
            )}
          </div>

          {/* CARTE CASTING */}
          {castList.length > 0 && (
            <div className="bg-[#181a24] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-iris-400" /> Casting / Acteurs
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
                {castList.map((actor: string, idx: number) => (
                  <FlipActorCard key={idx} name={actor} />
                ))}
              </div>
            </div>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}

function MovieSkeleton() {
  return (
    <div className="px-5 pt-40 sm:px-8">
      <div className="flex gap-6">
        <Skeleton className="hidden aspect-[2/3] w-44 sm:block rounded-xl" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-12 w-40 mt-4" /> {/* Fake buttons */}
        </div>
      </div>
      <div className="mt-12 space-y-6">
         <Skeleton className="h-32 w-full rounded-2xl" />
         <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}