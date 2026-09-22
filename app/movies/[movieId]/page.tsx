"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Maximize, Play, Plus, Star, User, X, Film, Trophy, Clapperboard } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useLibrary } from "@/store/library";
import { cn, ratingNum, yearFrom } from "@/lib/utils";

/* =========================================================
   CONFIG & UTILS
========================================================= */

const smoothTransition: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1],
};

const blurTransition: Transition = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1],
};

const cleanMovieTitle = (rawTitle: string) => {
  if (!rawTitle) return "";
  return rawTitle
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(/[ⓋⒹ║]/g, "")
    .replace(/\b(4K|202[0-9]|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[\/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}

/* =========================================================
   FANART HOOK
========================================================= */

type FanartData = {
  logo?: string | null;
  backdrop?: string | null;
  poster?: string | null;
};

function useFanartMovie(title: string, tmdbId?: string | number) {
  const [data, setData] = useState<FanartData>({});

  useEffect(() => {
    if (!title) return;
    let mounted = true;
    const cleanedTitle = cleanMovieTitle(title);
    
    const fetchImages = async () => {
      try {
        let logoUrl = `/api/title-logo?title=${encodeURIComponent(cleanedTitle)}&type=movie`;
        if (tmdbId) logoUrl += `&tmdbId=${tmdbId}`;
        const logoRes = await fetch(logoUrl).catch(() => null);
        const logoData = logoRes ? await logoRes.json().catch(() => ({})) : {};

        let fanartData: any = {};
        if (tmdbId) {
          const fanartRes = await fetch(`/api/fanart/movie?tmdbId=${tmdbId}`).catch(() => null);
          fanartData = fanartRes ? await fanartRes.json().catch(() => ({})) : {};
        }

        if (mounted) {
          setData({
            logo: logoData?.logoUrl || fanartData?.logo || null,
            poster: fanartData?.poster || null,
            backdrop: fanartData?.backdrop || null,
          });
        }
      } catch (e) {
        console.error("Erreur images", e);
      }
    };

    fetchImages();
    return () => { mounted = false; };
  }, [title, tmdbId]);

  return data;
}

/* =========================================================
   DIRECTOR SHOWCASE (Robuste)
========================================================= */

type DirectorData = {
  photoUrl: string | null;
  bio: string;
  awards?: string | null;
  knownFor?: { title: string; poster: string }[];
};

function DirectorShowcase({ name, backdrop }: { name?: string; backdrop?: string | null }) {
  const [data, setData] = useState<DirectorData | null>(null);

  useEffect(() => {
    if (!name) return;
    let mounted = true;
    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        
        // Sécurisation de l'API pour les films connus
        let parsedKnownFor: any[] = [];
        if (Array.isArray(json?.knownFor)) parsedKnownFor = json.knownFor;
        else if (Array.isArray(json?.movies)) parsedKnownFor = json.movies;

        setData({ 
          photoUrl: json?.photoUrl || null, 
          bio: json?.bio || "",
          awards: json?.awards || null,
          knownFor: parsedKnownFor
        });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [name]);

  return (
    <div className="absolute inset-0 flex flex-col justify-center overflow-hidden bg-[#07070a] group-hover:bg-[#040406] transition-colors duration-500">
      {backdrop && (
        <img src={backdrop} className="absolute inset-0 w-full h-full object-cover opacity-15 blur-[25px] scale-125 saturate-50" alt="" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/80 to-transparent" />
      
      {name ? (
        <div className="relative z-10 flex flex-col justify-center h-full p-6 lg:p-8 w-full max-w-full">
          
          <div className="flex items-center gap-6">
            {/* Photo Carrée */}
            <div className="w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] shrink-0 rounded-[22px] overflow-hidden border border-white/10 shadow-2xl bg-white/5">
              {data?.photoUrl ? (
                <img src={data.photoUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><User className="w-8 h-8 text-white/20" /></div>
              )}
            </div>
            
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#d8ccff]/70 mb-1 font-medium">
                Réalisateur & Producteur
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-white truncate drop-shadow-md tracking-tight">{name}</h3>
              
              {data?.awards && (
                <div className="mt-2.5 flex items-start gap-2 text-white/65 bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                  <Trophy className="w-4 h-4 text-yellow-500/90 shrink-0" />
                  <p className="text-[11px] sm:text-xs leading-snug line-clamp-1 font-medium">
                    {data.awards}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[13px] sm:text-sm text-white/60 line-clamp-3 leading-relaxed">
              {data?.bio || "Biographie indisponible. Lancez le film ou la bande-annonce pour découvrir son œuvre."}
            </p>
          </div>

          {/* S'affiche UNIQUEMENT si le réalisateur a d'autres films valides */}
          {Array.isArray(data?.knownFor) && data.knownFor.length > 0 && (
            <div className="mt-7 pt-5 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Clapperboard className="w-4 h-4 text-[#d8ccff]/80" />
                <h4 className="text-[11px] uppercase tracking-wider text-white/80 font-medium">Autres œuvres</h4>
              </div>
              <div className="flex gap-3">
                {data.knownFor.slice(0, 5).map((work, idx) => (
                  <div key={idx} className="w-[50px] h-[75px] sm:w-[60px] sm:h-[85px] rounded-[10px] overflow-hidden border border-white/10 bg-white/5 shrink-0 opacity-70 hover:opacity-100 transition-opacity">
                    <img src={work?.poster || undefined} alt={work?.title || "Film"} className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center h-full opacity-40">
           <Film className="w-12 h-12 mb-4 text-white/30" />
           <p className="text-sm font-medium">Cliquez sur Regarder ou Bande-annonce</p>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ACTOR MINI & CASTING
========================================================= */

type ActorMiniData = { name: string; photoUrl: string | null; bio: string; };

function ActorMini({ name, active, compact, onSelect }: { name: string; active: boolean; compact: boolean; onSelect: (actor: ActorMiniData) => void; }) {
  const [data, setData] = useState<ActorMiniData>({ name, photoUrl: null, bio: "" });

  useEffect(() => {
    let mounted = true;
    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        setData({ name, photoUrl: json?.photoUrl || null, bio: json?.bio || "" });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [name]);

  return (
    <motion.button
      layout type="button" draggable={false} onClick={() => onSelect(data)} transition={smoothTransition}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-[14px] border select-none backdrop-blur-xl transition-colors duration-300",
        compact ? "w-[54px] sm:w-[60px] aspect-[3/4]" : "w-[64px] sm:w-[74px] aspect-[3/4]",
        active ? "border-[#d8ccff]/50 bg-[#d8ccff]/10 shadow-[0_12px_35px_rgba(170,145,255,.16)]" : "border-white/10 bg-white/[0.035] hover:border-white/20"
      )}
    >
      {data.photoUrl ? (
        <img src={data.photoUrl || undefined} alt={name} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center"><User className="h-5 w-5 text-white/20" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.11] to-transparent" />
      {active && <motion.div layoutId="active-actor-outline" className="absolute inset-0 rounded-[14px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]" />}
      <p className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate text-[8.5px] font-medium text-white/85 sm:text-[9.5px]">{name}</p>
    </motion.button>
  );
}

function CastingShowcase({ actors, movieLogo }: { actors: string[], movieLogo?: string | null }) {
  const [selected, setSelected] = useState<ActorMiniData | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const mouseDown = useRef(false);
  const dragged = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current) return;
    mouseDown.current = true;
    dragged.current = false;
    startX.current = e.clientX;
    startScroll.current = railRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current || !mouseDown.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    if (dragged.current) {
      e.preventDefault();
      railRef.current.scrollLeft = startScroll.current - delta * 1.15;
    }
  };

  const stopMouseDrag = () => {
    mouseDown.current = false;
    setTimeout(() => { dragged.current = false; }, 70);
  };

  const selectActor = (actor: ActorMiniData) => {
    if (dragged.current) return;
    if (selected?.name === actor.name) { setSelected(null); return; }
    setSelected(actor);
  };

  return (
    <div className="border-t border-white/[0.07] pt-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_14px_rgba(216,204,255,.8)]" />
        <p className="text-[9px] uppercase tracking-[0.24em] text-white/45 font-semibold">Casting / Acteurs</p>
      </div>

      <motion.div layout transition={smoothTransition} className="relative overflow-hidden rounded-[20px] border border-white/[0.10] bg-white/[0.02] p-2.5 sm:p-3 backdrop-blur-xl">
        <motion.div layout transition={smoothTransition} className="relative z-10 flex min-w-0 items-stretch gap-4">
          <motion.div layout transition={smoothTransition} className={cn("flex min-w-0 items-center overflow-hidden", selected ? "w-[46%]" : "w-full")}>
            <div className="relative min-w-0 w-full overflow-hidden">
              <div
                ref={railRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={stopMouseDrag} onMouseLeave={stopMouseDrag}
                style={{ WebkitOverflowScrolling: "touch" }}
                className="flex min-w-0 w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none select-none cursor-grab active:cursor-grabbing items-center"
              >
                {movieLogo && (
                  <div className="shrink-0 flex items-center justify-center w-[70px] sm:w-[90px] mr-1 pr-3 border-r border-white/10 h-[64px] sm:h-[74px]">
                    <img src={movieLogo || undefined} alt="Logo du film" className="max-h-[45px] max-w-full object-contain drop-shadow-md pointer-events-none opacity-90" />
                  </div>
                )}
                
                {actors.map((actor) => (
                  <ActorMini key={actor} name={actor} compact={!!selected} active={selected?.name === actor} onSelect={selectActor} />
                ))}
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#060608] to-transparent" />
            </div>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {selected && (
              <motion.div
                layout key={selected.name} initial={{ opacity: 0, x: 65, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 45, scale: 0.97 }} transition={smoothTransition}
                className="relative w-[54%] min-h-[140px] overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#0d0d12]/90"
              >
                {selected.photoUrl && (
                  <motion.img
                    key={selected.photoUrl} initial={{ opacity: 0, x: 50, scale: 1.1 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    src={selected.photoUrl || undefined} alt={selected.name} className="absolute right-0 top-0 h-full w-[52%] object-cover"
                  />
                )}
                <div className="pointer-events-none absolute right-0 top-0 h-full w-[52%] bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#101015] via-[#101015]/98 via-[52%] to-transparent" />
                
                <motion.div key={`${selected.name}-text`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07, ...smoothTransition }} className="relative z-10 max-w-[62%] p-4 sm:p-5">
                  <p className="text-[8px] uppercase tracking-[0.25em] text-[#d8ccff]/75">Distribution</p>
                  <h3 className="mt-0.5 text-base font-semibold tracking-tight sm:text-lg">{selected.name}</h3>
                  <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/50 sm:text-[11px]">{selected.bio}</p>
                </motion.div>

                <button type="button" onClick={() => setSelected(null)} className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/30 text-white/45 backdrop-blur-xl transition hover:bg-white/10 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* =========================================================
   PAGE PRINCIPALE
========================================================= */

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.movieId || params?.id) as string;

  const [playerMode, setPlayerMode] = useState<"none" | "movie" | "trailer">("none");
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["movie-info", id],
    queryFn: async () => {
      const fetch1 = fetch(`/api/movie-info?id=${id}&vod_id=${id}`).then((res) => { if (!res.ok) throw new Error(); return res.json(); });
      const fetch2 = fetch(`/api/xtream?action=get_vod_info&vod_id=${id}`).then((res) => { if (!res.ok) throw new Error(); return res.json(); });
      return await Promise.any([fetch1, fetch2]);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });

  const { favorites, toggleFav, progress } = useLibrary();

  const info = data?.info || {};
  const movieData = data?.movie_data || {};
  
  const rawTitle = movieData?.name || info?.name || info?.title || movieData?.title || "Film Inconnu";
  const title = cleanMovieTitle(rawTitle);
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releaseDate || info?.releasedate, rawTitle);
  const ext = info?.container_extension || movieData?.container_extension || "mp4";
  const youtubeTrailer = info?.youtube_trailer || movieData?.youtube_trailer;
  
  const directorName = info?.director ? String(info.director).split(',')[0].trim() : undefined;

  const fanart = useFanartMovie(rawTitle, info?.tmdb_id || movieData?.tmdb_id);

  const rawPoster = fanart?.poster || info?.cover || movieData?.movie_image || info?.poster_path || movieData?.poster_path;
  const backdrop = fanart?.backdrop || info?.backdrop_path?.[0] || info?.backdrop || rawPoster;
  const currentPoster = rawPoster;

  const favKey = `movies:${id}`;
  const isFavMovie = !!favorites[favKey];
  const resumePosition = progress[`movie:${id}`]?.position ?? 0;

  const castList = useMemo(() => {
    if (!info?.cast) return [];
    return String(info.cast).split(",").map((v) => v.trim()).filter(Boolean);
  }, [info?.cast]);

  const handleFullscreen = async () => {
    const element = playerContainerRef.current;
    if (!element) return;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      }
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        await (window.screen.orientation as any).lock("landscape").catch(() => {});
      }
    } catch {}
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) handleFullscreen();
    lastTapRef.current = now;
  };

  if (isLoading) return <MovieSkeleton />;
  if (isError || !data || !id) return <div className="min-h-screen grid place-items-center bg-[#060608] text-white/40">Impossible de charger le film.</div>;

  return (
    // NOUVEAU: Disposition 100% sans scroll vertical, parfaitement centrée
    <main className="h-[100dvh] w-full overflow-hidden bg-[#060608] text-white flex flex-col relative">
      
      {/* BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {backdrop && (
          <motion.img
            key={backdrop} initial={{ opacity: 0, scale: 1.025 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }}
            src={backdrop || undefined} alt="" className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/92 via-[40%] to-[#060608]/20" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-[#060608]/85 via-[85%] to-transparent" />
      </div>

      {/* BOUTON RETOUR */}
      <button
        type="button"
        onClick={() => { if (window.history.length > 1) { router.back(); } else { router.push("/movies"); } }}
        className="absolute left-6 top-6 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-black/30 px-4 text-xs font-medium text-white/75 backdrop-blur-2xl transition hover:bg-white/[0.15] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* CONTAINER PRINCIPAL : SYMBIOSIS (Centré verticalement) */}
      <div className="relative z-10 flex-1 w-full max-w-[1550px] mx-auto px-6 sm:px-10 flex flex-col items-center justify-center h-full">
        
        {/* Wrapper pour garder un espacement constant */}
        <div className="w-full flex flex-col gap-10 lg:gap-14">
          
          {/* LIGNE DU HAUT : Infos + Lecteur/Réalisateur */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center w-full">
            
            {/* COLONNE GAUCHE */}
            <div className="flex flex-col w-full">
              
              <div className="mb-5 lg:mb-6 flex items-end justify-start min-h-[90px]">
                {fanart?.logo ? (
                   <img src={fanart.logo || undefined} alt={title} className="max-h-[120px] max-w-full object-contain object-left drop-shadow-2xl" />
                ) : (
                   <h1 className="text-4xl lg:text-6xl font-bold leading-tight tracking-tight drop-shadow-lg text-white">
                     {title}
                   </h1>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs lg:text-sm text-white/75 font-medium mb-5">
                {rating > 0 && (
                  <span className="flex items-center gap-1.5 text-yellow-400">
                    <Star className="h-4 w-4 fill-current" /> {rating.toFixed(1)}
                  </span>
                )}
                {year && <span>• {year}</span>}
                {info?.genre && <span>• {info.genre}</span>}
                {info?.duration && <span>• {formatDuration(info.duration)}</span>}
              </div>

              {(info?.plot || info?.description) && (
                <p className="max-w-2xl line-clamp-4 text-sm lg:text-[15px] leading-relaxed text-white/70 mb-8">
                  {info.plot || info.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 items-center">
                <button
                  type="button"
                  onClick={() => setPlayerMode("movie")}
                  className="relative h-12 lg:h-[52px] overflow-hidden rounded-full border border-white/20 bg-white px-8 lg:px-10 shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-transform hover:scale-[1.04] hover:bg-gray-200 text-black"
                >
                  <span className="flex items-center gap-2.5 text-sm font-bold">
                    <Play className="h-4 w-4 fill-current" /> {resumePosition > 15 ? "Reprendre" : "Regarder le film"}
                  </span>
                </button>

                {youtubeTrailer && (
                  <button
                    onClick={() => setPlayerMode("trailer")}
                    className="flex h-12 lg:h-[52px] items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] px-6 lg:px-7 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/20"
                  >
                    <Film className="h-4 w-4" /> Bande-annonce
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => toggleFav("movies", { id: Number(id), name: title, poster: currentPoster })}
                  className="flex h-12 lg:h-[52px] items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] px-5 lg:px-6 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/20"
                >
                  {isFavMovie ? <Heart className="h-4 w-4 fill-red-500 text-red-500" /> : <Plus className="h-4 w-4" />}
                  Ma liste
                </button>
              </div>
            </div>

            {/* COLONNE DROITE : LECTEUR / DIRECTEUR */}
            <div className="relative w-full aspect-video rounded-[24px] overflow-hidden border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.6)] group bg-[#07070a]">
              <AnimatePresence mode="wait">
                
                {/* ETAT 1 : CARTE DU REALISATEUR */}
                {playerMode === "none" ? (
                  <motion.div
                    key="director-card"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                    transition={blurTransition}
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => setPlayerMode("movie")}
                  >
                    <DirectorShowcase name={directorName} backdrop={backdrop || currentPoster} />
                    
                    {/* Icône de Play au survol */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
                      <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        <Play className="h-10 w-10 text-white fill-white translate-x-1" />
                      </div>
                    </div>
                  </motion.div>

                ) : (

                  /* ETAT 2 : LECTEUR VIDEO (Film ou Trailer) */
                  <motion.div
                    key="video-player"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    transition={blurTransition}
                    className="absolute inset-0 flex flex-col bg-black z-20"
                  >
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/95 to-transparent z-30 flex items-center justify-between px-5 opacity-0 hover:opacity-100 transition-opacity duration-300">
                       <span className="text-sm text-white/90 font-medium truncate pr-4 drop-shadow-md">
                         {title} {playerMode === "trailer" ? "(Bande-annonce)" : ""}
                       </span>
                       <div className="flex gap-3">
                         {playerMode === "movie" && (
                           <button onClick={handleFullscreen} className="text-white/70 hover:text-white transition"><Maximize className="w-5 h-5" /></button>
                         )}
                         <button onClick={() => setPlayerMode("none")} className="text-white/70 hover:text-white transition"><X className="w-6 h-6" /></button>
                       </div>
                    </div>
                    <div className="w-full h-full relative z-20" ref={playerContainerRef} onClick={handleDoubleTap}>
                      {playerMode === "movie" ? (
                        <VideoPlayer
                          key={id}
                          sources={[ext === "mp4" ? `/api/stream-vod?type=movie&id=${id}&ext=mp4` : `/api/transcode?type=movie&id=${id}&ext=${ext}`]}
                          ext={ext}
                          isLive={false}
                          mediaType="movie"
                          title={title}
                          poster={backdrop}
                          startTime={resumePosition > 15 ? resumePosition : 0}
                        />
                      ) : (
                        <iframe src={`https://www.youtube.com/embed/${youtubeTrailer}?autoplay=1`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* LIGNE DU BAS : Casting */}
          <div className="w-full">
            {castList.length > 0 && <CastingShowcase actors={castList} movieLogo={fanart?.logo} />}
          </div>

        </div>
      </div>
    </main>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function MovieSkeleton() {
  return (
    <div className="h-screen w-screen bg-[#060608] flex flex-col px-10 py-20 overflow-hidden">
      <Skeleton className="h-[120px] w-1/3 rounded-[10px] bg-white/[0.05] mb-8" />
      <div className="flex w-full gap-10">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-1/2 rounded-[10px] bg-white/[0.05]" />
          <Skeleton className="h-24 w-full rounded-[10px] bg-white/[0.05]" />
          <div className="flex gap-4 pt-4">
             <Skeleton className="h-12 w-40 rounded-full bg-white/[0.05]" />
             <Skeleton className="h-12 w-40 rounded-full bg-white/[0.05]" />
          </div>
        </div>
        <Skeleton className="w-[600px] aspect-video rounded-[24px] bg-white/[0.05]" />
      </div>
      <Skeleton className="mt-14 h-[120px] w-full rounded-[20px] bg-white/[0.05]" />
    </div>
  );
}