"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  Clock,
  Film,
  Heart,
  Maximize,
  Play,
  Plus,
  Star,
  Trophy,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";

import { SmartImage } from "@/components/ui/SmartImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useSeriesInfo } from "@/lib/hooks";
import { useLibrary } from "@/store/library";
import { cleanName, cn, ratingNum, yearFrom } from "@/lib/utils";
import type { Episode } from "@/lib/xtream/types";

/* =========================================================
   CONFIG & TRANSITIONS
========================================================= */

const SERIES_CATEGORIES_ROUTE = "/series";
const SEASON_WHEEL_HEIGHT = 190;
const SEASON_ITEM_HEIGHT = 46;

const smoothTransition: Transition = {
  duration: 0.55,
  ease: [0.16, 1, 0.3, 1],
};

const blurTransition: Transition = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1],
};

/* =========================================================
   TYPES
========================================================= */

type SeasonArtwork = { poster: string | null; name: string; episodeCount?: number; };
type FanartData = { logo?: string | null; backdrop?: string | null; poster?: string | null; seasons?: Record<string, SeasonArtwork>; };
type DirectorData = { photoUrl: string | null; bio: string; awards?: string | null; knownFor?: Array<{ title: string; poster: string; }>; };
type ActorMiniData = { name: string; photoUrl: string | null; bio: string; };
type ProductionCompany = { id: number; name: string; logo: string | null };
type ProducerData = { id: number; name: string; job: string; };

type ProductionDetails = {
  studio: string | null;
  studioLogo: string | null;
  companies: ProductionCompany[];
  producers: ProducerData[];
  overview: string | null;
};

/* =========================================================
   HOOKS API (OPTIMISÉS ANTI-FLASH)
========================================================= */

function useTitleLogo(tmdbId?: string | number, title?: string, type: "movie" | "tv" = "tv") {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId && !title) return;
    let mounted = true;
    
    const query = new URLSearchParams();
    if (tmdbId && String(tmdbId) !== "0") query.append("tmdbId", String(tmdbId));
    if (title) query.append("title", title);
    query.append("type", type);

    fetch(`/api/title-logo?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => { if (mounted && data?.logoUrl) setLogoUrl(data.logoUrl); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [tmdbId, title, type]);

  return logoUrl;
}

function useProductionDetails(tmdbId?: string | number, title?: string, type: "movie" | "tv" = "tv") {
  const [details, setDetails] = useState<ProductionDetails | null>(null);
  const [loading, setLoading] = useState(true); // On commence en "chargement" pour bloquer le flash

  useEffect(() => {
    if ((!tmdbId || String(tmdbId) === "0") && !title) {
      setLoading(false);
      return;
    }
    
    let mounted = true;
    setLoading(true); // Début du fetch TMDB
    
    const query = new URLSearchParams();
    if (tmdbId && String(tmdbId) !== "0") query.append("tmdbId", String(tmdbId));
    if (title) query.append("title", title);
    query.append("type", type);

    fetch(`/api/tmdb/movie-production?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => { 
        if (mounted && !data.error) {
          setDetails({
            studio: data.studio,
            studioLogo: data.studioLogo,
            companies: data.companies || [],
            producers: data.producers || [],
            overview: data.overview || null,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false); // TMDB a fini, on peut libérer l'affichage de la bio
      });
      
    return () => { mounted = false; };
  }, [tmdbId, title, type]);

  return { details, loading };
}

function useFanartSeries(tmdbId?: string | number) {
  const [data, setData] = useState<FanartData>({});

  useEffect(() => {
    if (!tmdbId || String(tmdbId) === "0") return;
    let mounted = true;
    fetch(`/api/fanart/series?tmdbId=${tmdbId}`)
      .then((res) => res.json())
      .then((json) => { if (mounted) setData(json || {}); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [tmdbId]);

  return data;
}

/* =========================================================
   HELPERS & COMPOSANTS ENFANTS
========================================================= */

function parseDurationToSeconds(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) { const val = Number(text); return Number.isFinite(val) ? val : 0; }
  const parts = text.split(":").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
  return 0;
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

// Composant de Biographie (Corrigé avec loader élégant)
function DirectorShowcase({ name, backdrop, isTmdbLoading }: { name?: string; backdrop?: string | null; isTmdbLoading?: boolean; }) {
  const [data, setData] = useState<DirectorData | null>(null);

  useEffect(() => {
    if (!name) { setData(null); return; }
    let mounted = true;
    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        let parsedKnownFor: DirectorData["knownFor"] = [];
        if (Array.isArray(json?.knownFor)) parsedKnownFor = json.knownFor;
        else if (Array.isArray(json?.movies)) parsedKnownFor = json.movies;

        setData({
          photoUrl: json?.photoUrl || null,
          bio: json?.bio || "",
          awards: json?.awards || null,
          knownFor: parsedKnownFor,
        });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [name]);

  // Si on attend encore la réponse TMDB, on affiche un design Premium de chargement
  if (isTmdbLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#07070a]">
        {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-10 blur-[30px] saturate-50" />}
        <div className="relative z-10 w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col justify-center overflow-hidden bg-[#07070a] transition-colors duration-500">
      {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-15 blur-[25px] saturate-50" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/80 to-transparent" />

      {name ? (
        <div className="relative z-10 flex h-full w-full max-w-full flex-col justify-center p-6 lg:p-8">
          <div className="flex items-center gap-6">
            <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/5 shadow-2xl sm:h-[110px] sm:w-[110px]">
              {data?.photoUrl ? (
                <img src={data.photoUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><User className="h-8 w-8 text-white/20" /></div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#d8ccff]/70">Créateur / Réalisateur</p>
              <h3 className="truncate text-2xl font-bold tracking-tight text-white drop-shadow-md sm:text-3xl">{name}</h3>
              {data?.awards && (
                <div className="mt-2.5 flex w-fit items-start gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-white/65">
                  <Trophy className="h-4 w-4 shrink-0 text-yellow-500/90" />
                  <p className="line-clamp-1 text-[11px] font-medium leading-snug sm:text-xs">{data.awards}</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6">
            <p className="line-clamp-3 text-[13px] leading-relaxed text-white/60 sm:text-sm">{data?.bio || "Biographie indisponible."}</p>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center opacity-40">
          <Film className="mb-4 h-12 w-12 text-white/30" />
          <p className="text-sm font-medium text-center">Sélectionnez une saison pour<br/>voir les épisodes.</p>
        </div>
      )}
    </div>
  );
}

function ActorMini({ name, active, compact, onSelect }: { name: string; active: boolean; compact: boolean; onSelect: (data: ActorMiniData) => void; }) {
  const [data, setData] = useState<ActorMiniData>({ name, photoUrl: null, bio: "" });

  useEffect(() => {
    let mounted = true;
    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((json) => { if (mounted) setData({ name, photoUrl: json?.photoUrl || null, bio: json?.bio || "" }); }).catch(() => {});
    return () => { mounted = false; };
  }, [name]);

  return (
    <motion.button layout transition={smoothTransition} type="button" draggable={false} onClick={() => onSelect(data)} className={cn("group relative shrink-0 overflow-hidden rounded-[14px] border select-none backdrop-blur-xl transition-colors duration-300", compact ? "w-[54px] sm:w-[60px] aspect-[3/4]" : "w-[64px] sm:w-[74px] aspect-[3/4]", active ? "border-[#d8ccff]/50 bg-[#d8ccff]/10 shadow-[0_12px_35px_rgba(170,145,255,.16)]" : "border-white/10 bg-white/[0.035] hover:border-white/20")}>
      {data.photoUrl ? <img src={data.photoUrl} alt={name} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" /> : <div className="absolute inset-0 grid place-items-center"><User className="h-5 w-5 text-white/20" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity group-hover:opacity-80" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.11] to-transparent" />
      {active && <motion.div layoutId="active-actor-outline" className="absolute inset-0 rounded-[14px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]" />}
      <p className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate text-[8.5px] font-medium text-white/85 sm:text-[9.5px]">{name}</p>
    </motion.button>
  );
}

function CastingShowcase({ actors, movieLogo, studio, studioLogo, companies, producers }: { actors: string[]; movieLogo?: string | null; studio?: string | null; studioLogo?: string | null; companies?: ProductionCompany[]; producers?: ProducerData[]; }) {
  const [selected, setSelected] = useState<ActorMiniData | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const mouseDown = useRef(false);
  const dragged = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => { if (!railRef.current) return; mouseDown.current = true; dragged.current = false; startX.current = e.clientX; startScroll.current = railRef.current.scrollLeft; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!railRef.current || !mouseDown.current) return; const delta = e.clientX - startX.current; if (Math.abs(delta) > 5) dragged.current = true; if (dragged.current) { e.preventDefault(); railRef.current.scrollLeft = startScroll.current - delta * 1.15; } };
  const stopMouseDrag = () => { mouseDown.current = false; setTimeout(() => { dragged.current = false; }, 70); };
  const selectActor = (actor: ActorMiniData) => { if (dragged.current) return; if (selected?.name === actor.name) { setSelected(null); return; } setSelected(actor); };

  const companyNames = Array.isArray(companies) ? companies.map((c) => c?.name).filter(Boolean).slice(0, 4) : [];
  const producerNames = Array.isArray(producers) ? producers.filter(p => ["Producer", "Executive Producer"].includes(p.job)).map((p) => p?.name).filter(Boolean).slice(0, 2) : [];

  return (
    <div className="border-t border-white/[0.07] pt-5 mt-10 w-full">
      <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_14px_rgba(216,204,255,.8)]" /><p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">Casting / Acteurs</p></div>
      <motion.div layout transition={smoothTransition} className="relative flex flex-col lg:flex-row items-stretch overflow-hidden rounded-[20px] border border-white/[0.10] bg-white/[0.02] p-2.5 backdrop-blur-xl sm:p-3">
        <motion.div layout transition={smoothTransition} className={cn("relative flex min-w-0 items-center overflow-hidden", selected ? "w-full lg:w-[46%]" : "w-full lg:w-[65%]")}>
          <div className="relative flex min-w-0 w-full items-center overflow-hidden">
            {movieLogo && (<div className="sticky left-0 z-30 mr-2 flex h-[64px] w-[75px] shrink-0 items-center justify-center border-r border-white/10 bg-[#0d0d12]/95 pr-3 shadow-[15px_0_20px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md sm:h-[74px] sm:w-[95px]"><img src={movieLogo} alt="Logo" className="pointer-events-none max-h-[45px] max-w-full object-contain opacity-90 drop-shadow-md" /></div>)}
            <div ref={railRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={stopMouseDrag} onMouseLeave={stopMouseDrag} style={{ WebkitOverflowScrolling: "touch" }} className="relative z-10 flex min-w-0 w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none select-none cursor-grab active:cursor-grabbing">
              {actors.map((actor) => <ActorMini key={actor} name={actor} compact={!!selected} active={selected?.name === actor} onSelect={selectActor} />)}
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-10 bg-gradient-to-l from-[#060608] to-transparent" />
          </div>
        </motion.div>
        <AnimatePresence mode="popLayout">
          {selected ? (
            <motion.div layout key="bio" initial={{ opacity: 0, x: 20, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: 20, filter: "blur(4px)" }} transition={smoothTransition} className="relative mt-4 lg:mt-0 lg:ml-4 min-h-[140px] w-full lg:w-[54%] overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#0d0d12]/90">
              {selected.photoUrl && <motion.img key={selected.photoUrl} initial={{ opacity: 0, x: 50, scale: 1.1 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }} src={selected.photoUrl} alt={selected.name} className="absolute right-0 top-0 h-full w-[52%] object-cover" />}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-[52%] bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#101015] via-[#101015]/98 via-[52%] to-transparent" />
              <motion.div key={`${selected.name}-text`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07, ...smoothTransition }} className="relative z-10 max-w-[70%] lg:max-w-[62%] p-4 sm:p-5">
                <p className="text-[8px] uppercase tracking-[0.25em] text-[#d8ccff]/75">Distribution</p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight sm:text-lg">{selected.name}</h3>
                <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/50 sm:text-[11px]">{selected.bio || "Biographie indisponible."}</p>
              </motion.div>
              <button type="button" onClick={() => setSelected(null)} className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/30 text-white/45 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"><X className="h-3 w-3" /></button>
            </motion.div>
          ) : (
            <motion.div layout key="production" initial={{ opacity: 0, filter: "blur(5px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(5px)" }} transition={smoothTransition} className="hidden w-[35%] flex-col justify-center border-l border-white/5 pl-4 pr-6 lg:flex">
              <div className="flex items-center justify-end gap-4">
                <div className="min-w-0 flex-1 text-right">
                  <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.3em] text-[#d8ccff]/70">Production & Studios</p>
                  <h4 className="truncate text-sm font-bold text-white">{studio || "Production non renseignée"}</h4>
                  {companyNames.length > 1 && <p className="mt-1 line-clamp-1 text-[9px] text-white/35">{companyNames.slice(1).join(" · ")}</p>}
                  {producerNames.length > 0 && <p className="mt-1 line-clamp-1 text-[9px] text-white/25">Prod. {producerNames.join(", ")}</p>}
                </div>
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/15 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
                  {studioLogo ? <img src={studioLogo} alt={studio || "Studio"} className="h-full w-full object-contain filter brightness-0 opacity-80" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Film className="h-6 w-6 text-black/40" />}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function SeasonWheel({ seasons, activeSeasonKey, onSelect }: { seasons: string[]; activeSeasonKey: string | null; onSelect: (season: string) => void; }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseDown = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const initialized = useRef(false);

  const padding = (SEASON_WHEEL_HEIGHT - SEASON_ITEM_HEIGHT) / 2;
  const normalizeSeason = (season: string) => season.replace(/\D/g, "") || season;

  const centerSeason = (season: string, behavior: ScrollBehavior = "smooth") => {
    const wheel = wheelRef.current;
    const item = itemRefs.current[season];
    if (!wheel || !item) return;
    const top = item.offsetTop - wheel.clientHeight / 2 + item.clientHeight / 2;
    wheel.scrollTo({ top, behavior });
  };

  const findCenteredSeason = () => {
    const wheel = wheelRef.current;
    if (!wheel) return null;
    const center = wheel.scrollTop + wheel.clientHeight / 2;
    let result: string | null = null;
    let distance = Infinity;
    for (const season of seasons) {
      const item = itemRefs.current[season];
      if (!item) continue;
      const itemCenter = item.offsetTop + item.clientHeight / 2;
      const currentDistance = Math.abs(itemCenter - center);
      if (currentDistance < distance) { distance = currentDistance; result = season; }
    }
    return result;
  };

  const settleWheel = () => {
    const season = findCenteredSeason();
    if (!season) return;
    centerSeason(season);
    if (season !== activeSeasonKey) onSelect(season);
  };

  useEffect(() => {
    if (initialized.current || !activeSeasonKey) return;
    const timer = setTimeout(() => { centerSeason(activeSeasonKey, "auto"); initialized.current = true; }, 80);
    return () => clearTimeout(timer);
  }, [activeSeasonKey]);

  const handleScroll = () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); scrollTimer.current = setTimeout(() => { if (!mouseDown.current) settleWheel(); }, 130); };
  const handleMouseDown = (e: React.MouseEvent) => { if (!wheelRef.current) return; mouseDown.current = true; didDrag.current = false; startY.current = e.clientY; startScroll.current = wheelRef.current.scrollTop; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!wheelRef.current || !mouseDown.current) return; const delta = e.clientY - startY.current; if (Math.abs(delta) > 3) didDrag.current = true; if (didDrag.current) { e.preventDefault(); wheelRef.current.scrollTop = startScroll.current - delta * 1.15; } };
  const stopDrag = () => { if (!mouseDown.current) return; mouseDown.current = false; if (didDrag.current) setTimeout(settleWheel, 30); setTimeout(() => { didDrag.current = false; }, 90); };

  return (
    <div style={{ height: SEASON_WHEEL_HEIGHT }} className="relative w-full shrink-0 overflow-hidden rounded-[22px] border border-white/[0.10] bg-white/[0.035] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.11)]">
      <div style={{ height: SEASON_ITEM_HEIGHT }} className="pointer-events-none absolute left-3 right-3 top-1/2 z-10 -translate-y-1/2 rounded-[14px] border border-[#d8ccff]/25 bg-[#d8ccff]/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,.10)]" />
      <div ref={wheelRef} onScroll={handleScroll} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={stopDrag} onMouseLeave={stopDrag} style={{ paddingTop: padding, paddingBottom: padding, WebkitOverflowScrolling: "touch" }} className="relative z-20 h-full overflow-y-auto overscroll-y-contain snap-y snap-mandatory scrollbar-none select-none cursor-grab active:cursor-grabbing">
        {seasons.map((season) => {
          const active = activeSeasonKey === season;
          return (
            <button ref={(node) => { itemRefs.current[season] = node; }} key={season} type="button" style={{ height: SEASON_ITEM_HEIGHT }} onClick={() => { if (didDrag.current) return; onSelect(season); centerSeason(season); }} className={cn("snap-center flex w-full shrink-0 items-center justify-center text-sm transition-all duration-300", active ? "scale-[1.08] font-semibold text-white opacity-100" : "scale-[0.92] font-medium text-white/30 opacity-60 hover:text-white/60")}>
              Saison {normalizeSeason(season)}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-12 bg-gradient-to-b from-[#0a0a0d] via-[#0a0a0d]/85 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-12 bg-gradient-to-t from-[#0a0a0d] via-[#0a0a0d]/85 to-transparent" />
    </div>
  );
}

function EpisodeImage({ ep, seriesTitle, tmdbId, seasonKey, fallbackCover }: { ep: any; seriesTitle: string; tmdbId?: string | number; seasonKey: string; fallbackCover?: string; }) {
  const [imgSrc, setImgSrc] = useState<string | null>(ep.info?.movie_image || null);

  useEffect(() => {
    if (ep.info?.movie_image) { setImgSrc(ep.info.movie_image); return; }
    let mounted = true;
    const season = seasonKey.replace(/\D/g, "") || "1";
    fetch(`/api/episode-image?tmdbId=${tmdbId || ""}&show=${encodeURIComponent(seriesTitle)}&season=${season}&episode=${ep.episode_num || ep.episode}`)
      .then((res) => res.json())
      .then((json) => { if (mounted && json?.imageUrl) setImgSrc(json.imageUrl); }).catch(() => {});
    return () => { mounted = false; };
  }, [ep, seriesTitle, tmdbId, seasonKey]);

  return <SmartImage src={imgSrc || fallbackCover} alt={ep.title || "Épisode"} rounded="rounded-none" className="h-full w-full object-cover pointer-events-none" />;
}

/* =========================================================
   PAGE SÉRIE (Principale)
========================================================= */

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.seriesId || params?.id) as string;

  const { data, isLoading, isError } = useSeriesInfo(id);
  const { isFav, toggleFav, progress } = useLibrary();

  const [playerMode, setPlayerMode] = useState<"director" | "episodes" | "playing">("director");
  const playerSectionRef = useRef<HTMLDivElement>(null);
  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [activeEpisodeDuration, setActiveEpisodeDuration] = useState(0);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const epListRef = useRef<HTMLDivElement>(null);
  const epDrag = useRef({ isDown: false, startY: 0, scrollTop: 0, didDrag: false });

  /* =======================================================
     SERIES DATA
  ======================================================= */
  const info = data?.info || data?.series_info || (data && !data.episodes ? data : {}) || {};
  const episodesBySeason = data?.episodes ?? {};
  
  const rawTitle = info?.name || info?.title || "Série";
  const cleanTitle = cleanName(rawTitle).replace(/\s*\(\d{4}\)/g, "").replace(/\s*\[\d{4}\]/g, "").trim();
  
  const tmdbId = info?.tmdb_id || info?.tmdbId;
  const safeTitle = !isLoading && cleanTitle !== "Série" ? cleanTitle : undefined;

  // HOOKS
  const logoUrl = useTitleLogo(tmdbId, safeTitle, "tv");
  
  // Utilisation de notre nouveau paramètre "isTmdbLoading"
  const { details: productionDetails, loading: isTmdbLoading } = useProductionDetails(tmdbId, safeTitle, "tv");
  const fanart = useFanartSeries(tmdbId);
  
  const productionLogoUrl = productionDetails?.studioLogo || null;
  const studioName = productionDetails?.studio || info?.studio || info?.network || "Studio Inconnu";
  const companies = productionDetails?.companies || [];
  const producers = productionDetails?.producers || [];
  const finalSynopsis = info?.plot || info?.description || info?.overview || productionDetails?.overview || "Aucun synopsis détaillé n'est disponible pour cette série.";

  // LA LOGIQUE DE SÉLECTION INFAILLIBLE DU DIRECTEUR (1. TMDB Créateur > 2. IPTV > 3. TMDB Autre)
  const tmdbCreator = producers.find(p => p.job === "Creator" || p.job === "Showrunner")?.name;
  const xtreamDirector = info?.director ? String(info.director).split(",")[0].trim() : undefined;
  const tmdbFallback = producers.find(p => ["Director", "Series Director", "Executive Producer"].includes(p.job))?.name;
  
  // Le nom final ne sera assigné que lorsque TMDB aura répondu (grâce au "undefined") pour empêcher le double flash
  const bestDirectorName = tmdbCreator || xtreamDirector || tmdbFallback;
  const finalDirectorName = isTmdbLoading ? undefined : bestDirectorName;

  /* =======================================================
     SEASONS & META
  ======================================================= */
  const seasons = useMemo(() => Object.keys(episodesBySeason).filter((season) => (episodesBySeason[season] || []).length > 0).sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0)), [episodesBySeason]);
  const activeSeasonKey = seasonKey ?? seasons[0] ?? null;
  const episodes = activeSeasonKey ? episodesBySeason[activeSeasonKey] || [] : [];
  const castList = useMemo(() => info?.cast ? String(info.cast).split(",").map((v) => v.trim()).filter(Boolean) : [], [info?.cast]);
  const rating = ratingNum(info?.rating);
  const year = yearFrom(info?.releaseDate || info?.releasedate, cleanTitle);
  const backdrop = fanart?.backdrop || info?.backdrop_path?.[0] || info?.backdrop || info?.cover;
  const basePoster = fanart?.poster || info?.cover;
  const selectedSeasonNumber = activeSeasonKey?.replace(/\D/g, "") || "";
  const selectedSeasonPoster = selectedSeasonNumber ? fanart?.seasons?.[selectedSeasonNumber]?.poster : null;
  const currentPoster = selectedSeasonPoster || basePoster;
  const fav = isFav("series", Number(id));

  /* =======================================================
     DURATION API & OTHERS
  ======================================================= */
  useEffect(() => {
    if (!activeEpisode) { setActiveEpisodeDuration(0); return; }
    const localDuration = parseDurationToSeconds((activeEpisode as any)?.info?.duration_secs) || parseDurationToSeconds((activeEpisode as any)?.info?.duration) || parseDurationToSeconds((activeEpisode as any)?.duration_secs);
    if (localDuration > 0) { setActiveEpisodeDuration(localDuration); return; }
    const episodeId = (activeEpisode as any)?.id ?? (activeEpisode as any)?.stream_id;
    if (!episodeId || !id) { setActiveEpisodeDuration(0); return; }

    let mounted = true;
    setActiveEpisodeDuration(0);
    fetch(`/api/media-info?type=series&seriesId=${encodeURIComponent(id)}&episodeId=${encodeURIComponent(String(episodeId))}`, { cache: "no-store" })
      .then(async (res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (!mounted) return; const value = Number(json?.duration || 0); setActiveEpisodeDuration(Number.isFinite(value) && value > 0 ? value : 0); })
      .catch(() => { if (mounted) setActiveEpisodeDuration(0); });
    return () => { mounted = false; };
  }, [activeEpisode, id]);

  const resumeEpisode = useMemo(() => {
    for (const season of seasons) {
      for (const ep of episodesBySeason[season] || []) {
        if ((progress[`series:${ep.id}`]?.position ?? 0) > 15) return { episode: ep, season };
      }
    }
    return null;
  }, [seasons, episodesBySeason, progress]);

  const scrollToPlayer = () => { if (window.innerWidth < 1024) setTimeout(() => playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); };
  const handleFullscreen = async () => { const element = playerContainerRef.current; if (!element) return; try { await element.requestFullscreen?.(); if (window.screen?.orientation && "lock" in window.screen.orientation) await (window.screen.orientation as any).lock("landscape").catch(() => {}); } catch {} };
  const handleDoubleTap = () => { const now = Date.now(); if (now - lastTapRef.current < 300) handleFullscreen(); lastTapRef.current = now; };

  const handleEpMouseDown = (e: React.MouseEvent) => { epDrag.current.isDown = true; epDrag.current.didDrag = false; epDrag.current.startY = e.clientY; epDrag.current.scrollTop = epListRef.current?.scrollTop || 0; };
  const handleEpMouseMove = (e: React.MouseEvent) => { if (!epDrag.current.isDown || !epListRef.current) return; const delta = e.clientY - epDrag.current.startY; if (Math.abs(delta) > 5) epDrag.current.didDrag = true; epListRef.current.scrollTop = epDrag.current.scrollTop - delta; };
  const handleEpMouseUp = () => { epDrag.current.isDown = false; };

  if (isLoading) return <SeriesSkeleton />;
  if (isError || !data || !id) return <div className="min-h-screen grid place-items-center bg-[#060608] text-white/40">Impossible de charger la série.</div>;

  const activeResumePosition = activeEpisode ? progress[`series:${activeEpisode.id}`]?.position ?? 0 : 0;

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#060608] text-white pb-20">
      
      {/* BACKGROUND FULL SCREEN */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {backdrop && <motion.img key={backdrop} initial={{ opacity: 0, scale: 1.025 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/92 via-[43%] to-[#060608]/20" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent via-[68%] to-transparent" />
      </div>

      <button type="button" onClick={() => { if (window.history.length > 1) router.back(); else router.push(SERIES_CATEGORIES_ROUTE); }} className="absolute left-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-black/30 px-4 text-xs font-medium text-white/70 backdrop-blur-2xl transition hover:bg-white/[0.10] hover:text-white sm:left-7 lg:left-12 lg:top-8">
        <ArrowLeft className="h-4 w-4" /> Retour aux catégories
      </button>

      {/* =================================================
          GRILLE HAUT : 3 COLONNES
      ================================================= */}
      <div className="relative z-10 mx-auto max-w-[1900px] px-4 pt-24 sm:px-7 lg:px-12 lg:pt-[110px]">
        <div className="flex flex-col lg:flex-row items-stretch gap-8 lg:gap-12">
          
          <div className="hidden lg:flex lg:flex-col w-[185px] xl:w-[210px] shrink-0">
            <div className="relative aspect-[2/3] w-full shrink-0">
              <AnimatePresence mode="wait">
                {currentPoster && (
                  <motion.div key={currentPoster} initial={{ opacity: 0, scale: 1.025 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.4 }} className="absolute inset-0 overflow-hidden rounded-[24px] border border-white/[0.14] bg-white/[0.03] shadow-[0_25px_70px_rgba(0,0,0,.48)]">
                    <img src={currentPoster} alt={cleanTitle} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.10] to-transparent" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="min-h-6 flex-1" />
            {seasons.length > 0 && <SeasonWheel seasons={seasons} activeSeasonKey={activeSeasonKey} onSelect={(season) => { setSeasonKey(season); setPlayerMode("episodes"); scrollToPlayer(); }} />}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            {logoUrl ? <img src={logoUrl} alt={cleanTitle} className="max-h-[130px] max-w-[80vw] object-contain object-left drop-shadow-[0_16px_30px_rgba(0,0,0,.65)] sm:max-h-[150px] sm:max-w-[450px] mb-2" /> : <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-5xl xl:text-6xl mb-2">{cleanTitle}</h1>}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60 sm:text-sm font-medium">
              {rating > 0 && <span className="flex items-center gap-1.5 text-[#d8ccff]"><Star className="h-4 w-4 fill-current" />{rating.toFixed(1)}</span>}
              {year && <span>• {year}</span>}
              {seasons.length > 0 && <span>• {seasons.length} saison{seasons.length > 1 ? "s" : ""}</span>}
              {info?.genre && <span>• {info.genre}</span>}
            </div>

            {finalSynopsis && <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/80 xl:text-[15px]">{finalSynopsis}</p>}

            {/* DESIGN ERGONOMIQUE POUR LA GRILLE DE L'EQUIPE */}
            {producers.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 max-w-2xl border-t border-white/10 pt-5">
                {producers.slice(0, 3).map((person, index) => (
                  <div key={`${person.id}-${index}`} className="flex flex-col">
                    <span className="text-[13px] font-bold text-white tracking-tight">{person.name}</span>
                    <span className="text-[10px] text-[#d8ccff]/70 uppercase tracking-widest font-semibold">{person.job}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-4">
              <button type="button" onClick={() => { if (resumeEpisode) { setSeasonKey(resumeEpisode.season); setPlayerMode("episodes"); scrollToPlayer(); } else if (episodes[0]) { setPlayerMode("episodes"); scrollToPlayer(); } }} className="relative h-12 overflow-hidden rounded-full bg-white px-8 text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition hover:scale-[1.03] hover:bg-gray-200">
                <span className="flex items-center gap-2.5 text-sm font-bold"><Play className="h-4 w-4 fill-current" />{resumeEpisode ? "Reprendre" : "Regarder"}</span>
              </button>
              <button type="button" onClick={() => toggleFav("series", { id: Number(id), name: cleanTitle, poster: basePoster })} className="flex h-12 items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-6 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/15">
                {fav ? <Heart className="h-4 w-4 fill-[#d8ccff] text-[#d8ccff]" /> : <Plus className="h-4 w-4" />} Ma liste
              </button>
            </div>
          </div>

          <div ref={playerSectionRef} className="w-full lg:w-[45%] xl:w-[650px] 2xl:w-[750px] shrink-0 sticky top-24 h-fit mt-8 lg:mt-0">
            <div className="group relative aspect-video w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#07070a] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
              <AnimatePresence mode="wait">
                
                {/* BIO DU DIRECTEUR - LE NOM ATTEND QUE TMDB SOIT PRÊT */}
                {playerMode === "director" && (
                  <motion.div key="director-view" initial={{ opacity: 0, filter: "blur(10px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(10px)" }} transition={blurTransition} className="absolute inset-0">
                    <DirectorShowcase name={finalDirectorName} backdrop={backdrop || currentPoster} isTmdbLoading={isTmdbLoading} />
                  </motion.div>
                )}
                
                {playerMode === "episodes" && (
                  <motion.div key="episodes-view" initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }} transition={blurTransition} className="absolute inset-0 flex flex-col bg-[#07070a]">
                    <img src={selectedSeasonPoster || backdrop || currentPoster} className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-screen saturate-50 blur-xl" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/90 to-[#07070a]/80" />
                    <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/[0.08]">
                      <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#d8ccff]/70">Sélectionnez un épisode</p><h2 className="text-lg font-bold text-white mt-0.5">Saison {selectedSeasonNumber}</h2></div>
                      <button onClick={() => setPlayerMode("director")} className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/15 transition border border-white/10"><X className="h-4 w-4 text-white/70" /></button>
                    </div>
                    <div ref={epListRef} onMouseDown={handleEpMouseDown} onMouseMove={handleEpMouseMove} onMouseUp={handleEpMouseUp} onMouseLeave={handleEpMouseUp} className="relative z-10 flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-none cursor-grab active:cursor-grabbing" style={{ WebkitOverflowScrolling: "touch" }}>
                      {episodes.map((ep: Episode) => {
                        const num = ep.episode_num || (ep as any).episode;
                        const episodeTitle = cleanName(ep.title || `Épisode ${num}`).replace(/\s*\(\d{4}\)/g, "").replace(/\s*\[\d{4}\]/g, "").trim();
                        const resume = progress[`series:${ep.id}`]?.position ?? 0;
                        const durSecs = parseDurationToSeconds((ep.info as any)?.duration_secs) || parseDurationToSeconds((ep.info as any)?.duration);
                        const percent = durSecs > 0 ? Math.min(100, (resume / durSecs) * 100) : 0;
                        const synopsis = (ep.info as any)?.plot || (ep.info as any)?.overview || (ep.info as any)?.description || "Synopsis non renseigné.";

                        return (
                          <div key={ep.id} onClick={() => { if (epDrag.current.didDrag) return; setActiveEpisode(ep); setPlayerMode("playing"); }} className="group flex gap-3.5 p-2.5 rounded-[16px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/15 cursor-pointer transition-all">
                            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-[10px] bg-black">
                              <EpisodeImage ep={ep} seriesTitle={cleanTitle} tmdbId={tmdbId} seasonKey={activeSeasonKey || "1"} fallbackCover={backdrop || currentPoster} />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent flex items-center justify-center transition-all"><Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg" /></div>
                              {percent > 0 && <div className="absolute left-0 right-0 bottom-0 h-1 bg-white/20"><div style={{ width: `${percent}%` }} className="h-full bg-gradient-to-r from-[#aa95ff] to-white" /></div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="text-sm font-semibold text-white/90 truncate pointer-events-none"><span className="text-white/40 mr-1.5">{num}.</span>{episodeTitle}</h4>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40 pointer-events-none">
                                {durSecs > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(durSecs)}</span>}
                                {resume > 15 && <><span className="text-white/20">•</span><span className="text-[#d8ccff]/80">En cours</span></>}
                              </div>
                              <p className="mt-1.5 text-[11px] leading-snug text-white/40 line-clamp-2 pointer-events-none">{synopsis}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
                {playerMode === "playing" && activeEpisode && (
                  <motion.div key="video-player" initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} transition={blurTransition} className="absolute inset-0 z-20 flex flex-col bg-black">
                    <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-gradient-to-b from-black/95 to-transparent px-5 opacity-0 transition-opacity duration-300 hover:opacity-100">
                      <span className="truncate pr-4 text-sm font-medium text-white/90 drop-shadow-md">{cleanTitle} - S{selectedSeasonNumber}E{activeEpisode.episode_num || (activeEpisode as any).episode}</span>
                      <div className="flex gap-3">
                        <button type="button" onClick={handleFullscreen} className="text-white/70 transition hover:text-white"><Maximize className="h-5 w-5" /></button>
                        <button type="button" onClick={() => setPlayerMode("episodes")} className="text-white/70 transition hover:text-white"><X className="h-6 w-6" /></button>
                      </div>
                    </div>
                    <div className="relative z-20 h-full w-full" ref={playerContainerRef} onClick={handleDoubleTap}>
                      <VideoPlayer key={activeEpisode.id} sources={[`/api/stream-vod?type=series&id=${activeEpisode.id}&ext=${activeEpisode.container_extension || "mkv"}`]} ext={activeEpisode.container_extension || "mkv"} isLive={false} mediaType="series" title={cleanName(activeEpisode.title || `${cleanTitle} · S${selectedSeasonNumber}E${activeEpisode.episode_num || (activeEpisode as any).episode}`)} poster={activeEpisode.info?.movie_image || backdrop || currentPoster} knownDuration={activeEpisodeDuration} startTime={activeResumePosition > 15 ? activeResumePosition : 0} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* =================================================
            BANDE CASTING & PRODUCTION EN BAS
        ================================================= */}
        {castList.length > 0 && (
          <CastingShowcase actors={castList} movieLogo={logoUrl || currentPoster} studio={studioName} studioLogo={productionLogoUrl} companies={companies} producers={producers} />
        )}

      </div>

      {seasons.length > 0 && (
        <section className="mx-auto px-4 mt-8 sm:px-7 lg:hidden">
          <div className="grid grid-cols-[112px_minmax(0,1fr)] items-end gap-4">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[20px] border border-white/[0.12] bg-white/[0.03]">
              {currentPoster && <motion.img key={currentPoster} src={currentPoster} alt={cleanTitle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 h-full w-full object-cover" />}
            </div>
            <SeasonWheel seasons={seasons} activeSeasonKey={activeSeasonKey} onSelect={(season) => { setSeasonKey(season); setPlayerMode("episodes"); scrollToPlayer(); }} />
          </div>
        </section>
      )}
    </main>
  );
}

function SeriesSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#060608] px-4 pt-24 lg:px-12">
      <div className="flex flex-col lg:flex-row gap-12 max-w-[1900px] mx-auto">
        <Skeleton className="hidden lg:block h-[300px] w-[185px] shrink-0 rounded-[24px] bg-white/[0.05]" />
        <div className="flex-1 space-y-6">
          <Skeleton className="h-16 w-[300px] rounded-[10px] bg-white/[0.05]" />
          <Skeleton className="h-32 w-full rounded-[10px] bg-white/[0.05]" />
          <Skeleton className="h-12 w-[180px] rounded-full bg-white/[0.05]" />
        </div>
        <Skeleton className="w-full lg:w-[45%] aspect-video shrink-0 rounded-[24px] bg-white/[0.05]" />
      </div>
      <div className="mt-12 max-w-[1900px] mx-auto">
        <Skeleton className="h-24 w-full rounded-[24px] bg-white/[0.05]" />
      </div>
    </div>
  );
}