"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Star, Calendar, Clock, User, Info, Maximize, Play, Film, X, BookOpen } from "lucide-react";
import { motion, AnimatePresence, Transition } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { DetailHero } from "@/components/catalog/DetailHero";
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
        <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-lg backface-hidden flex flex-col justify-end">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500">
              <User className="w-6 h-6" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="relative z-10 p-2 flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-white line-clamp-1">{name}</span>
            <Info className="w-3 h-3 text-white/50 flex-shrink-0" />
          </div>
        </div>

        <div className="absolute inset-0 w-full h-full rounded-xl p-2.5 bg-zinc-900 border border-white/10 text-white backface-hidden rotate-y-180 flex flex-col justify-between shadow-xl">
          <div className="space-y-1 overflow-hidden">
            <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-1">{name}</p>
            <p className="text-[9px] text-zinc-400 leading-tight line-clamp-4">{bio}</p>
          </div>
          <span className="text-[8px] text-zinc-500 italic self-end">Retourner</span>
        </div>
      </div>
    </div>
  );
};

export default function MovieDetailPage() {
  const params = useParams();
  const id = (params?.movieId || params?.id) as string;

  const [playerMode, setPlayerMode] = useState<"none" | "movie" | "trailer">("none");

  // CHARGEMENT ULTRA-RAPIDE AVEC PROMISE.ANY
  const { data, isLoading, isError } = useQuery({
    queryKey: ["movie-info", id],
    queryFn: async () => {
      const fetch1 = fetch(`/api/movie-info?id=${id}&vod_id=${id}`).then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      });
      const fetch2 = fetch(`/api/xtream?action=get_vod_info&vod_id=${id}`).then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      });

      // Lance les deux requêtes en même temps, prend la première qui réussit
      return await Promise.any([fetch1, fetch2]);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });

  const { isFav, toggleFav } = useLibrary();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const actorScrollRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

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
    return <p className="px-8 py-24 text-center text-red-400 font-medium">Impossible de charger le film. Veuillez réessayer.</p>;

  const info = data?.info || {};
  const movieData = data?.movie_data || {};
  
  const title = movieData?.name || info?.name || info?.title || movieData?.title || "Film Inconnu";
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releaseDate || info?.releasedate, title);
  
  const posterImg = info?.cover || movieData?.stream_icon || info?.movie_image || movieData?.movie_image || "";
  const backdropImg = info?.backdrop_path?.[0] || info?.backdrop || movieData?.backdrop_path?.[0] || posterImg;
  
  const fav = isFav("movies", Number(id));
  const ext = info?.container_extension || movieData?.container_extension || "mp4";
  
  const youtubeTrailer = info?.youtube_trailer || movieData?.youtube_trailer;

  const castList = info?.cast
    ? info.cast.split(",").map((actor: string) => actor.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-6 space-y-6 select-none pb-24">
      <style jsx global>{`
        .perspective { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* HERO BANNIÈRE */}
      <DetailHero
        backdrop={backdropImg}
        poster={posterImg}
        title={title}
        fav={fav}
        onToggleFav={() =>
          toggleFav("movies", { id: Number(id), name: cleanName(title), poster: posterImg })
        }
      >
        <div className="space-y-6 max-w-4xl">
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
              {cleanName(title)}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-zinc-300">
              {rating > 0 && (
                <span className="flex items-center gap-1 font-bold text-white bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/5">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> {rating.toFixed(1)}
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-4 w-4 text-zinc-400" /> {year}
                </span>
              )}
              {info?.genre && <span className="font-medium text-zinc-300">{info.genre}</span>}
              {info?.duration && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-zinc-400" /> {info.duration}
                </span>
              )}
            </div>
          </div>

          {/* BOUTONS D'ACTION */}
          <AnimatePresence>
            {playerMode === "none" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="flex items-center gap-3 pt-2"
              >
                <button
                  onClick={() => setPlayerMode("movie")}
                  className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all transform hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-black" /> Lecture
                </button>
                
                {youtubeTrailer ? (
                  <button
                    onClick={() => setPlayerMode("trailer")}
                    className="bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors backdrop-blur-md"
                  >
                    <Film className="w-5 h-5 text-zinc-400" /> Bande-annonce
                  </button>
                ) : (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanName(title) + " trailer bande annonce")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors backdrop-blur-md"
                  >
                    <Film className="w-5 h-5 text-zinc-400" /> Chercher la bande-annonce
                  </a>
                )}
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
        {/* LECTEUR VIDÉO OU TRAILER */}
        <AnimatePresence mode="popLayout">
          {playerMode !== "none" && (
            <motion.div
              key="movie-player"
              initial={{ opacity: 0, scale: 0.95, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -20 }}
              transition={smoothTransition}
              className="w-full lg:w-[50%] shrink-0 space-y-2.5 bg-zinc-900 border border-white/10 rounded-2xl p-3 sm:p-4 sticky top-4 z-40 shadow-2xl"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate max-w-[70%]">
                  {cleanName(title)} {playerMode === "trailer" && " - Bande-annonce"}
                </h2>
                <div className="flex items-center gap-1">
                  {playerMode === "movie" && (
                    <button
                      onClick={handleFullscreenLandscape}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title="Plein Écran Horizontal"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setPlayerMode("none")}
                    className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
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
                {playerMode === "movie" ? (
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
                ) : (
                  <iframe 
                    src={`https://www.youtube.com/embed/${youtubeTrailer}?autoplay=1`}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* COLONNE DES INFORMATIONS */}
        <motion.div
          layout="position"
          transition={smoothTransition}
          className={cn(
            "flex-1 w-full space-y-4 sm:space-y-6 transition-all duration-500",
            playerMode !== "none" ? "lg:w-[50%]" : "lg:w-full"
          )}
        >
          {/* CARTE SYNOPSIS */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 sm:p-6 shadow-lg">
            <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-zinc-400" /> Synopsis & Histoire
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-300 font-light">
              {info?.plot || info?.description || "Aucun synopsis disponible pour ce film."}
            </p>
            {info?.director && (
              <p className="mt-4 text-xs text-zinc-500">
                Réalisateur : <span className="font-medium text-white">{info.director}</span>
              </p>
            )}
          </div>

          {/* CARTE CASTING */}
          {castList.length > 0 && (
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-zinc-400" /> Casting / Acteurs
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

// SKELETON PREMIUM IMMERSIF
function MovieSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-6 pb-24">
      {/* Fausse Bannière (imite exactement le layout du Hero) */}
      <div className="relative w-full h-[50vh] sm:h-[60vh] rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 animate-pulse mb-6 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-10 w-full flex items-end gap-6 z-20">
          <div className="w-32 sm:w-48 aspect-[2/3] bg-zinc-800 rounded-xl shadow-lg hidden sm:block" />
          <div className="flex-1 space-y-4">
            <div className="h-10 sm:h-14 bg-zinc-800 w-3/4 sm:w-1/2 rounded-lg" />
            <div className="flex gap-3">
              <div className="h-6 w-16 bg-zinc-800 rounded-md" />
              <div className="h-6 w-16 bg-zinc-800 rounded-md" />
              <div className="h-6 w-24 bg-zinc-800 rounded-md" />
            </div>
            <div className="h-11 w-32 bg-zinc-800 rounded-xl mt-4" />
          </div>
        </div>
      </div>

      {/* Fausses cartes de contenu */}
      <div className="space-y-6 animate-pulse">
         <div className="h-32 w-full bg-zinc-900 rounded-2xl border border-white/5" />
         <div className="h-48 w-full bg-zinc-900 rounded-2xl border border-white/5" />
      </div>
    </div>
  );
}