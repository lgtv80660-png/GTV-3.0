"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Clapperboard,
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

import {
  AnimatePresence,
  motion,
  type Transition,
} from "framer-motion";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  Skeleton,
} from "@/components/ui/Skeleton";

import {
  VideoPlayer,
} from "@/components/player/VideoPlayer";

import {
  useLibrary,
} from "@/store/library";

import {
  cn,
  ratingNum,
  yearFrom,
} from "@/lib/utils";

/* =========================================================
   CONFIG
========================================================= */

const smoothTransition: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1],
};

const blurTransition: Transition = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1],
};

/* =========================================================
   TYPES
========================================================= */

type FanartData = {
  logo?: string | null;
  backdrop?: string | null;
  poster?: string | null;
};

type DirectorData = {
  photoUrl: string | null;
  bio: string;
  awards?: string | null;
  knownFor?: Array<{
    title: string;
    poster: string;
  }>;
};

type ActorMiniData = {
  name: string;
  photoUrl: string | null;
  bio: string;
};

type ProductionCompany = {
  id?: number;
  name: string;
  logo?: string | null;
  logoPath?: string | null;
  country?: string | null;
};

type ProducerData = {
  id?: number;
  name: string;
  job?: string;
  department?: string;
};

type ProductionData = {
  studio?: string | null;
  studioLogo?: string | null;
  studioLogoCompany?: string | null;
  companies?: ProductionCompany[];
  producers?: ProducerData[];
  productionCountries?: any[];
  tmdbId?: number;
  title?: string | null;
  originalTitle?: string | null;
  year?: string | null;
  error?: string | null;
};

/* =========================================================
   TITLE CLEANER
========================================================= */

const cleanMovieTitle = (rawTitle: string) => {
  if (!rawTitle) {
    return "";
  }

  return rawTitle
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(/[ⓋⒹ║]/g, "")
    .replace(
      /\b(4K|202[0-9]|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR)\b/gi,
      ""
    )
    .replace(/\(\s*\)/g, "")
    .replace(/[\/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* =========================================================
   DURATION
========================================================= */

function formatDuration(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (text.includes(":")) {
      const parts = text.split(":").map(Number);

      if (parts.length === 3 && parts.every(Number.isFinite)) {
        const hours = parts[0];
        const minutes = parts[1];

        if (hours > 0) {
          return `${hours} h ${minutes} min`;
        }

        return `${minutes} min`;
      }
    }
  }

  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  if (hours > 0) {
    return `${hours} h ${mins} min`;
  }

  return `${mins} min`;
}

function durationToSeconds(value: unknown) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  const parts = text.split(":").map(Number);

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

/* =========================================================
   FANART
========================================================= */

function useFanartMovie(title: string, tmdbId?: string | number) {
  const [data, setData] = useState<FanartData>({});

  useEffect(() => {
    if (!title) {
      setData({});
      return;
    }

    let mounted = true;
    const cleanedTitle = cleanMovieTitle(title);

    const fetchImages = async () => {
      try {
        let logoUrl = `/api/title-logo?title=${encodeURIComponent(
          cleanedTitle
        )}&type=movie`;

        if (tmdbId) {
          logoUrl += `&tmdbId=${encodeURIComponent(String(tmdbId))}`;
        }

        const [logoRes, fanartRes] = await Promise.all([
          fetch(logoUrl).catch(() => null),
          tmdbId
            ? fetch(
                `/api/fanart/movie?tmdbId=${encodeURIComponent(String(tmdbId))}`
              ).catch(() => null)
            : Promise.resolve(null),
        ]);

        const logoData = logoRes ? await logoRes.json().catch(() => ({})) : {};
        const fanartData = fanartRes
          ? await fanartRes.json().catch(() => ({}))
          : {};

        if (mounted) {
          setData({
            logo: logoData?.logoUrl || fanartData?.logo || null,
            poster: fanartData?.poster || null,
            backdrop: fanartData?.backdrop || null,
          });
        }
      } catch (error) {
        console.error("[FANART MOVIE]", error);
      }
    };

    fetchImages();

    return () => {
      mounted = false;
    };
  }, [title, tmdbId]);

  return data;
}

/* =========================================================
   DIRECTOR (OPTIMISÉ ANTI-FLASH)
========================================================= */

function DirectorShowcase({
  name,
  backdrop,
  isTmdbLoading,
}: {
  name?: string;
  backdrop?: string | undefined;
  isTmdbLoading?: boolean;
}) {
  const [data, setData] = useState<DirectorData | null>(null);

  useEffect(() => {
    if (!name) {
      setData(null);
      return;
    }

    let mounted = true;

    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((response) => response.json())
      .then((json) => {
        if (!mounted) {
          return;
        }

        let parsedKnownFor: DirectorData["knownFor"] = [];

        if (Array.isArray(json?.knownFor)) {
          parsedKnownFor = json.knownFor;
        } else if (Array.isArray(json?.movies)) {
          parsedKnownFor = json.movies;
        }

        setData({
          photoUrl: json?.photoUrl || null,
          bio: json?.bio || "",
          awards: json?.awards || null,
          knownFor: parsedKnownFor,
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [name]);

  if (isTmdbLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#07070a]">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-10 blur-[30px] saturate-50"
          />
        )}
        <div className="relative z-10 w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col justify-center overflow-hidden bg-[#07070a] transition-colors duration-500 group-hover:bg-[#040406]">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-15 blur-[25px] saturate-50"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/80 to-transparent" />

      {name ? (
        <div className="relative z-10 flex h-full w-full max-w-full flex-col justify-center p-6 lg:p-8">
          <div className="flex items-center gap-6">
            <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/5 shadow-2xl sm:h-[110px] sm:w-[110px]">
              {data?.photoUrl ? (
                <img
                  src={data.photoUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-8 w-8 text-white/20" />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#d8ccff]/70">
                Réalisateur & Producteur
              </p>
              <h3 className="truncate text-2xl font-bold tracking-tight text-white drop-shadow-md sm:text-3xl">
                {name}
              </h3>

              {data?.awards && (
                <div className="mt-2.5 flex w-fit items-start gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-white/65">
                  <Trophy className="h-4 w-4 shrink-0 text-yellow-500/90" />
                  <p className="line-clamp-1 text-[11px] font-medium leading-snug sm:text-xs">
                    {data.awards}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="line-clamp-3 text-[13px] leading-relaxed text-white/60 sm:text-sm">
              {data?.bio || "Biographie indisponible."}
            </p>
          </div>

          {Array.isArray(data?.knownFor) && data.knownFor.length > 0 && (
            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-[#d8ccff]/80" />
                <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/80">
                  Autres œuvres
                </h4>
              </div>

              <div className="flex gap-3">
                {data.knownFor.slice(0, 5).map((work, index) => (
                  <div
                    key={`${work?.title || "work"}-${index}`}
                    className="h-[75px] w-[50px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-white/5 opacity-70 transition-opacity hover:opacity-100 sm:h-[85px] sm:w-[60px]"
                  >
                    {work?.poster && (
                      <img
                        src={work.poster}
                        alt={work?.title || "Film"}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center opacity-40">
          <Film className="mb-4 h-12 w-12 text-white/30" />
          <p className="text-sm font-medium">
            Cliquez sur Regarder ou Bande-annonce
          </p>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ACTOR
========================================================= */

function ActorMini({
  name,
  active,
  compact,
  onSelect,
}: {
  name: string;
  active: boolean;
  compact: boolean;
  onSelect: (actor: ActorMiniData) => void;
}) {
  const [data, setData] = useState<ActorMiniData>({
    name,
    photoUrl: null,
    bio: "",
  });

  useEffect(() => {
    let mounted = true;

    fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
      .then((response) => response.json())
      .then((json) => {
        if (!mounted) return;
        setData({
          name,
          photoUrl: json?.photoUrl || null,
          bio: json?.bio || "",
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [name]);

  return (
    <motion.button
      layout
      type="button"
      draggable={false}
      onClick={() => onSelect(data)}
      transition={smoothTransition}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-[14px] border select-none backdrop-blur-xl transition-colors duration-300",
        compact
          ? "aspect-[3/4] w-[54px] sm:w-[60px]"
          : "aspect-[3/4] w-[64px] sm:w-[74px]",
        active
          ? "border-[#d8ccff]/50 bg-[#d8ccff]/10 shadow-[0_12px_35px_rgba(170,145,255,.16)]"
          : "border-white/10 bg-white/[0.035] hover:border-white/20"
      )}
    >
      {data.photoUrl ? (
        <img
          src={data.photoUrl}
          alt={name}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <User className="h-5 w-5 text-white/20" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.11] to-transparent" />

      {active && (
        <motion.div
          layoutId="active-actor-outline"
          className="absolute inset-0 rounded-[14px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]"
        />
      )}

      <p className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate text-[8.5px] font-medium text-white/85 sm:text-[9.5px]">
        {name}
      </p>
    </motion.button>
  );
}

/* =========================================================
   CASTING + PRODUCTION
========================================================= */

function CastingShowcase({
  actors,
  movieLogo,
  studio,
  studioLogo,
  studioLogoCompany,
  companies,
  producers,
}: {
  actors: string[];
  movieLogo?: string | null;
  studio?: string | null;
  studioLogo?: string | null;
  studioLogoCompany?: string | null;
  companies?: ProductionCompany[];
  producers?: ProducerData[];
}) {
  const [selected, setSelected] = useState<ActorMiniData | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const mouseDown = useRef(false);
  const dragged = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current) return;
    mouseDown.current = true;
    dragged.current = false;
    startX.current = event.clientX;
    startScroll.current = railRef.current.scrollLeft;
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current || !mouseDown.current) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    if (dragged.current) {
      event.preventDefault();
      railRef.current.scrollLeft = startScroll.current - delta * 1.15;
    }
  };

  const stopMouseDrag = () => {
    mouseDown.current = false;
    setTimeout(() => {
      dragged.current = false;
    }, 70);
  };

  const selectActor = (actor: ActorMiniData) => {
    if (dragged.current) return;
    if (selected?.name === actor.name) {
      setSelected(null);
      return;
    }
    setSelected(actor);
  };

  const companyNames = Array.isArray(companies)
    ? companies.map((company) => company?.name).filter(Boolean).slice(0, 4)
    : [];

  const producerNames = Array.isArray(producers)
    ? producers.map((producer) => producer?.name).filter(Boolean).slice(0, 2)
    : [];

  return (
    <div className="border-t border-white/[0.07] pt-5 w-full">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_14px_rgba(216,204,255,.8)]" />
        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">
          Casting / Acteurs
        </p>
      </div>

      <motion.div
        layout
        transition={smoothTransition}
        className="relative flex flex-col lg:flex-row items-stretch overflow-hidden rounded-[20px] border border-white/[0.10] bg-white/[0.02] p-2.5 backdrop-blur-xl sm:p-3"
      >
        {/* ACTORS */}
        <motion.div
          layout
          transition={smoothTransition}
          className={cn(
            "relative flex min-w-0 items-center overflow-hidden",
            selected ? "w-full lg:w-[46%]" : "w-full lg:w-[65%]"
          )}
        >
          <div className="relative flex min-w-0 w-full items-center overflow-hidden">
            {movieLogo && (
              <div className="sticky left-0 z-30 mr-2 flex h-[64px] w-[75px] shrink-0 items-center justify-center border-r border-white/10 bg-[#0d0d12]/95 pr-3 shadow-[15px_0_20px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md sm:h-[74px] sm:w-[95px]">
                <img
                  src={movieLogo}
                  alt="Logo du film"
                  className="pointer-events-none max-h-[45px] max-w-full object-contain opacity-90 drop-shadow-md"
                />
              </div>
            )}

            <div
              ref={railRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopMouseDrag}
              onMouseLeave={stopMouseDrag}
              style={{ WebkitOverflowScrolling: "touch" }}
              className="relative z-10 flex min-w-0 w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none select-none cursor-grab active:cursor-grabbing"
            >
              {actors.map((actor) => (
                <ActorMini
                  key={actor}
                  name={actor}
                  compact={!!selected}
                  active={selected?.name === actor}
                  onSelect={selectActor}
                />
              ))}
            </div>

            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-10 bg-gradient-to-l from-[#060608] to-transparent" />
          </div>
        </motion.div>

        {/* RIGHT - INFO OU BIO */}
        <AnimatePresence mode="popLayout">
          {selected ? (
            <motion.div
              layout
              key="bio"
              initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              transition={smoothTransition}
              className="relative mt-4 lg:mt-0 lg:ml-4 min-h-[140px] w-full lg:w-[54%] overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#0d0d12]/90"
            >
              {selected.photoUrl && (
                <motion.img
                  key={selected.photoUrl}
                  initial={{ opacity: 0, x: 50, scale: 1.1 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  src={selected.photoUrl}
                  alt={selected.name}
                  className="absolute right-0 top-0 h-full w-[52%] object-cover"
                />
              )}

              <div className="pointer-events-none absolute right-0 top-0 h-full w-[52%] bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#101015] via-[#101015]/98 via-[52%] to-transparent" />

              <motion.div
                key={`${selected.name}-text`}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.07, ...smoothTransition }}
                className="relative z-10 max-w-[70%] lg:max-w-[62%] p-4 sm:p-5"
              >
                <p className="text-[8px] uppercase tracking-[0.25em] text-[#d8ccff]/75">
                  Distribution
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight sm:text-lg">
                  {selected.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/50 sm:text-[11px]">
                  {selected.bio}
                </p>
              </motion.div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/30 text-white/45 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              key="production"
              initial={{ opacity: 0, filter: "blur(5px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(5px)" }}
              transition={smoothTransition}
              className="hidden w-[35%] flex-col justify-center border-l border-white/5 pl-4 pr-6 lg:flex"
            >
              <div className="flex items-center justify-end gap-4">
                <div className="min-w-0 flex-1 text-right">
                  <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.3em] text-[#d8ccff]/70">
                    Production & Studios
                  </p>
                  <h4 className="truncate text-sm font-bold text-white">
                    {studio || "Production non renseignée"}
                  </h4>
                  {companyNames.length > 1 && (
                    <p className="mt-1 line-clamp-1 text-[9px] text-white/35">
                      {companyNames.slice(1).join(" · ")}
                    </p>
                  )}
                  {producerNames.length > 0 && (
                    <p className="mt-1 line-clamp-1 text-[9px] text-white/25">
                      Prod. {producerNames.join(", ")}
                    </p>
                  )}
                </div>

                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/15 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
                  {studioLogo ? (
                    <img
                      src={studioLogo}
                      alt={studioLogoCompany || studio || "Studio"}
                      className="h-full w-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <Film className="h-6 w-6 text-black/40" />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.movieId || params?.id) as string;

  const [playerMode, setPlayerMode] = useState<"none" | "movie" | "trailer">(
    "none"
  );
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  /* =======================================================
     MOVIE INFO
  ======================================================= */
  const { data, isLoading, isError } = useQuery({
    queryKey: ["movie-info", id],
    queryFn: async () => {
      const results = await Promise.allSettled([
        fetch(
          `/api/movie-info?id=${encodeURIComponent(
            id
          )}&vod_id=${encodeURIComponent(id)}`
        ).then(async (response) => {
          if (!response.ok) throw new Error("movie-info");
          return response.json();
        }),
        fetch(
          `/api/xtream?action=get_vod_info&vod_id=${encodeURIComponent(id)}`
        ).then(async (response) => {
          if (!response.ok) throw new Error("xtream");
          return response.json();
        }),
      ]);

      const successful = results
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);

      if (successful.length === 0) {
        throw new Error("Aucune source movie-info disponible");
      }

      let mergedInfo: any = {};
      let mergedMovieData: any = {};

      for (const result of successful) {
        if (result?.info) {
          mergedInfo = { ...mergedInfo, ...result.info };
        }
        if (result?.movie_data) {
          mergedMovieData = { ...mergedMovieData, ...result.movie_data };
        }
      }

      return {
        ...successful[0],
        info: mergedInfo,
        movie_data: mergedMovieData,
      };
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });

  const { favorites, toggleFav, progress } = useLibrary();

  const info = data?.info || {};
  const movieData = data?.movie_data || {};

  /* =======================================================
     MOVIE VALUES
  ======================================================= */
  const rawTitle =
    movieData?.name ||
    info?.name ||
    info?.title ||
    movieData?.title ||
    "Film Inconnu";
  const title = cleanMovieTitle(rawTitle);
  const rating = ratingNum(info?.rating);
  const year = yearFrom(
    info?.releaseDate || info?.releasedate || info?.release_date,
    rawTitle
  );
  const ext =
    info?.container_extension || movieData?.container_extension || "mp4";
  const youtubeTrailer = info?.youtube_trailer || movieData?.youtube_trailer;

  /* =======================================================
     TMDB ID
  ======================================================= */
  const tmdbId =
    info?.tmdb_id || movieData?.tmdb_id || info?.tmdbId || movieData?.tmdbId || null;

  /* =======================================================
     FANART
  ======================================================= */
  const fanart = useFanartMovie(rawTitle, tmdbId || undefined);

  /* =======================================================
     PRODUCTION API (AVEC ETAT DE CHARGEMENT)
  ======================================================= */
  const { data: productionData, isLoading: isTmdbLoading } = useQuery<ProductionData>({
    queryKey: ["movie-production", tmdbId, title, year],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (tmdbId) search.set("tmdbId", String(tmdbId));
      if (title) search.set("title", title);
      if (year) search.set("year", String(year));
      
      search.set("type", "movie");

      const endpoint = `/api/tmdb/movie-production?${search.toString()}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error || `movie-production ${response.status}`);
      }
      return json;
    },
    enabled: !!title,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  /* =======================================================
     PRODUCTION VALUES
  ======================================================= */
  const productionCompanies = Array.isArray(productionData?.companies)
    ? productionData.companies
    : [];
  const movieProducers = Array.isArray(productionData?.producers)
    ? productionData.producers
    : [];
  const companyWithLogo =
    productionCompanies.find((company) => !!company?.logo) || null;
  const companyWithLogoPath =
    productionCompanies.find((company) => !!company?.logoPath) || null;

  const rawStudio =
    productionData?.studio ||
    productionCompanies?.[0]?.name ||
    info?.production_companies?.[0]?.name ||
    info?.production ||
    info?.studio ||
    movieData?.production ||
    movieData?.studio ||
    null;

  const studioName = rawStudio ? String(rawStudio).trim() : null;

  const studioLogo =
    productionData?.studioLogo ||
    companyWithLogo?.logo ||
    (companyWithLogoPath?.logoPath
      ? `https://image.tmdb.org/t/p/w500${companyWithLogoPath.logoPath}`
      : null);

  const studioLogoCompany =
    productionData?.studioLogoCompany ||
    companyWithLogo?.name ||
    companyWithLogoPath?.name ||
    studioName ||
    null;

  const tmdbDirector = movieProducers.find((p) => p.job === "Director")?.name;
  const xtreamDirector = info?.director ? String(info.director).split(",")[0].trim() : undefined;
  const tmdbFallback = movieProducers.find((p) => p.job === "Producer" || p.job === "Executive Producer")?.name;

  const bestDirectorName = tmdbDirector || xtreamDirector || tmdbFallback;
  const finalDirectorName = isTmdbLoading ? undefined : bestDirectorName;

  /* =======================================================
     🛡️ NOUVELLE GESTION DES IMAGES (INFAILLIBLE)
  ======================================================= */
  const formatImgUrl = (url: string | null | undefined): string | undefined => {
    if (!url || typeof url !== "string") return undefined;
    
    const trimmed = url.trim();
    // Certains fournisseurs IPTV renvoient litéralement le mot "null" ou "undefined" en texte !
    if (trimmed === "null" || trimmed === "undefined" || trimmed === "") return undefined;
    
    // Si l'image vient de TMDB mais qu'il manque le nom de domaine
    if (trimmed.startsWith("/")) return `https://image.tmdb.org/t/p/w500${trimmed}`;
    
    return trimmed;
  };

  // On fouille PARTOUT où le fournisseur aurait pu cacher l'affiche !
  const rawPoster = formatImgUrl(
    fanart?.poster ||
    info?.cover ||
    info?.movie_image ||
    info?.cover_big || // 👈 Utilisé par certains panels
    movieData?.stream_icon || // 👈 Très courant sur Xtream Codes !
    info?.poster_path
  );

  const backdrop = formatImgUrl(
    fanart?.backdrop || info?.backdrop_path?.[0] || info?.backdrop
  ) || rawPoster;

  const currentPoster = rawPoster;

  /* =======================================================
     FAVORITES / RESUME
  ======================================================= */
  const favKey = `movies:${id}`;
  const isFavMovie = !!favorites[favKey];
  const resumePosition = progress[`movie:${id}`]?.position ?? 0;

  /* =======================================================
     KNOWN DURATION
  ======================================================= */
  const knownDuration =
    Number(info?.duration_secs || movieData?.duration_secs || 0) ||
    durationToSeconds(info?.duration);

  /* =======================================================
     CAST
  ======================================================= */
  const castList = useMemo(() => {
    if (!info?.cast) return [];
    return String(info.cast)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [info?.cast]);

  /* =======================================================
     FULLSCREEN
  ======================================================= */
  const handleFullscreen = async () => {
    const element = playerContainerRef.current;
    if (!element) return;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      }
      if (
        window.screen?.orientation &&
        "lock" in window.screen.orientation
      ) {
        await (window.screen.orientation as any)
          .lock("landscape")
          .catch(() => {});
      }
    } catch {}
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleFullscreen();
    }
    lastTapRef.current = now;
  };

  /* =======================================================
     LOADING & ERROR
  ======================================================= */
  if (isLoading) return <MovieSkeleton />;
  if (isError || !data || !id) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#060608] text-white/40">
        Impossible de charger le film.
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#060608] text-white pb-20">
      
      {/* =================================================
         BACKGROUND
      ================================================= */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {backdrop && (
          <motion.img
            key={backdrop}
            initial={{ opacity: 0, scale: 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9 }}
            src={backdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/92 via-[43%] to-[#060608]/20" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent via-[68%] to-transparent" />
      </div>

      {/* =================================================
         BACK
      ================================================= */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/movies");
          }
        }}
        className="absolute left-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-black/30 px-4 text-xs font-medium text-white/70 backdrop-blur-2xl transition hover:bg-white/[0.10] hover:text-white sm:left-7 lg:left-12 lg:top-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux catégories
      </button>

      {/* =================================================
         GRILLE HAUT : 3 COLONNES
      ================================================= */}
      <div className="relative z-10 mx-auto max-w-[1900px] px-4 pt-24 sm:px-7 lg:px-12 lg:pt-[110px]">
        <div className="flex flex-col lg:flex-row items-stretch gap-8 lg:gap-12">
          
          {/* =================================================
              GAUCHE : L'AFFICHE DU FILM (SUPER ROBUSTE) 
          ================================================= */}
          <div className="hidden lg:flex lg:flex-col w-[185px] xl:w-[210px] shrink-0">
            <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-[24px] border border-white/[0.14] bg-[#0d0d12] shadow-[0_25px_70px_rgba(0,0,0,.48)] flex items-center justify-center">
              
              {/* Icône de secours s'il n'y a VRAIMENT aucune image ou lien mort */}
              <Film className="absolute h-10 w-10 text-white/10" />

              <AnimatePresence mode="wait">
                {currentPoster && (
                  <motion.img
                    key={currentPoster}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    src={currentPoster}
                    alt={title}
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover z-10"
                    onError={(e) => {
                      // Si l'image crashe (Erreur 404), on la rend invisible pour voir l'icône de secours !
                      (e.currentTarget as HTMLImageElement).style.opacity = '0';
                    }}
                  />
                )}
              </AnimatePresence>
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.10] to-transparent pointer-events-none z-20" />
            </div>
          </div>

          {/* CENTRE : INFOS DU FILM */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="mb-5 flex min-h-[90px] items-end justify-start lg:mb-6">
              {fanart?.logo ? (
                <img
                  src={fanart.logo}
                  alt={title}
                  className="max-h-[100px] lg:max-h-[120px] max-w-full object-contain object-left drop-shadow-[0_16px_30px_rgba(0,0,0,.65)]"
                />
              ) : (
                <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-5xl xl:text-6xl mb-2">
                  {title}
                </h1>
              )}
            </div>

            {/* META */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60 sm:text-sm font-medium">
              {rating > 0 && (
                <span className="flex items-center gap-1.5 text-[#d8ccff]">
                  <Star className="h-4 w-4 fill-current" />
                  {rating.toFixed(1)}
                </span>
              )}
              {year && <span>• {year}</span>}
              {info?.genre && <span>• {info.genre}</span>}
              {info?.duration && (
                <span>• {formatDuration(info.duration)}</span>
              )}
            </div>

            {/* DESCRIPTION */}
            {(info?.plot || info?.description) && (
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/80 xl:text-[15px]">
                {info.plot || info.description}
              </p>
            )}

            {/* GRILLE ERGONOMIQUE CREW / PRODUCTEURS */}
            {movieProducers.length > 0 && (
              <div className="mt-6 mb-2 flex flex-wrap items-center gap-x-8 gap-y-3 max-w-2xl border-t border-white/10 pt-5">
                {movieProducers.slice(0, 3).map((person, index) => (
                  <div key={`${person.id || person.name}-${index}`} className="flex flex-col">
                    <span className="text-[13px] font-bold text-white tracking-tight">{person.name}</span>
                    <span className="text-[10px] text-[#d8ccff]/70 uppercase tracking-widest font-semibold">{person.job || "Production"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* BUTTONS */}
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => setPlayerMode("movie")}
                className="relative h-12 overflow-hidden rounded-full bg-white px-8 text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition hover:scale-[1.03] hover:bg-gray-200"
              >
                <span className="flex items-center gap-2.5 text-sm font-bold">
                  <Play className="h-4 w-4 fill-current" />
                  {resumePosition > 15 ? "Reprendre" : "Regarder"}
                </span>
              </button>

              {youtubeTrailer && (
                <button
                  type="button"
                  onClick={() => setPlayerMode("trailer")}
                  className="flex h-12 items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-6 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <Film className="h-4 w-4" />
                  Bande-annonce
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  toggleFav("movies", {
                    id: Number(id),
                    name: title,
                    poster: currentPoster || undefined,
                  })
                }
                className="flex h-12 items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-6 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/15"
              >
                {isFavMovie ? (
                  <Heart className="h-4 w-4 fill-[#d8ccff] text-[#d8ccff]" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Ma liste
              </button>
            </div>
          </div>

          {/* DROITE : PLAYER */}
          <div className="w-full lg:w-[45%] xl:w-[650px] 2xl:w-[750px] shrink-0 sticky top-24 h-fit mt-8 lg:mt-0">
            <div className="group relative aspect-video w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#07070a] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
              <AnimatePresence mode="wait">
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
                    <DirectorShowcase
                      name={finalDirectorName}
                      backdrop={backdrop || currentPoster || undefined}
                      isTmdbLoading={isTmdbLoading}
                    />
                    <div className="absolute inset-0 z-50 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/20 shadow-[0_0_50px_rgba(255,255,255,0.2)] backdrop-blur-md">
                        <Play className="h-10 w-10 translate-x-1 fill-white text-white" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="video-player"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    transition={blurTransition}
                    className="absolute inset-0 z-20 flex flex-col bg-black"
                  >
                    <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-gradient-to-b from-black/95 to-transparent px-5 opacity-0 transition-opacity duration-300 hover:opacity-100">
                      <span className="truncate pr-4 text-sm font-medium text-white/90 drop-shadow-md">
                        {title}{" "}
                        {playerMode === "trailer" ? "(Bande-annonce)" : ""}
                      </span>
                      <div className="flex gap-3">
                        {playerMode === "movie" && (
                          <button
                            type="button"
                            onClick={handleFullscreen}
                            className="text-white/70 transition hover:text-white"
                          >
                            <Maximize className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPlayerMode("none")}
                          className="text-white/70 transition hover:text-white"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>

                    <div
                      className="relative z-20 h-full w-full"
                      ref={playerContainerRef}
                      onClick={handleDoubleTap}
                    >
                      {playerMode === "movie" ? (
                        <VideoPlayer
                          key={id}
                          sources={[
                            `/api/stream-vod?type=movie&id=${encodeURIComponent(
                              id
                            )}&ext=${encodeURIComponent(ext)}`,
                          ]}
                          ext={ext}
                          isLive={false}
                          mediaType="movie"
                          title={title}
                          poster={backdrop || currentPoster || undefined}
                          startTime={resumePosition > 15 ? resumePosition : 0}
                          knownDuration={knownDuration}
                        />
                      ) : (
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeTrailer}?autoplay=1`}
                          className="h-full w-full border-0"
                          allow="autoplay; encrypted-media; fullscreen"
                          allowFullScreen
                        />
                      )}
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
        <div className="w-full mt-10">
          {castList.length > 0 ? (
            <CastingShowcase
              actors={castList}
              movieLogo={fanart?.logo}
              studio={studioName}
              studioLogo={studioLogo}
              studioLogoCompany={studioLogoCompany}
              companies={productionCompanies}
              producers={movieProducers}
            />
          ) : (
            <div className="border-t border-white/[0.07] pt-5">
              <div className="relative overflow-hidden rounded-[20px] border border-white/[0.10] bg-white/[0.02] p-4 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                  <div className="min-w-0">
                    <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.3em] text-[#d8ccff]/70">
                      Production & Studios
                    </p>
                    <h4 className="truncate text-sm font-bold text-white">
                      {studioName || "Production non renseignée"}
                    </h4>
                    {productionCompanies.length > 1 && (
                      <p className="mt-1 line-clamp-1 text-[10px] text-white/35">
                        {productionCompanies
                          .slice(1, 4)
                          .map((company) => company.name)
                          .join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-white/15 bg-white p-3 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
                    {studioLogo ? (
                      <img
                        src={studioLogo}
                        alt={studioLogoCompany || studioName || "Studio"}
                        className="h-full w-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    ) : (
                      <Film className="h-7 w-7 text-black/45" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
    <div className="min-h-[100dvh] bg-[#060608] px-4 pt-24 lg:px-12">
      <div className="flex flex-col lg:flex-row gap-12 max-w-[1900px] mx-auto">
        {/* L'affiche */}
        <Skeleton className="hidden lg:block h-[300px] w-[185px] shrink-0 rounded-[24px] bg-white/[0.05]" />
        
        <div className="flex-1 space-y-6">
          <Skeleton className="h-16 w-[300px] rounded-[10px] bg-white/[0.05]" />
          <Skeleton className="h-32 w-full rounded-[10px] bg-white/[0.05]" />
          <Skeleton className="h-12 w-[180px] rounded-full bg-white/[0.05]" />
        </div>
        
        {/* Player */}
        <Skeleton className="w-full lg:w-[45%] aspect-video shrink-0 rounded-[24px] bg-white/[0.05]" />
      </div>
      <div className="mt-12 max-w-[1900px] mx-auto">
        <Skeleton className="h-24 w-full rounded-[24px] bg-white/[0.05]" />
      </div>
    </div>
  );
}