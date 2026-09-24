"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ChevronRight,
  Clock3,
  Info,
  Loader2,
  Play,
  Plus,
  Star,
} from "lucide-react";

import { cleanName, cn, ratingNum, yearFrom } from "@/lib/utils";
import { useLibrary } from "@/store/library";

/* =========================================================
   TYPES
========================================================= */

type XtreamMovie = {
  stream_id: number | string;
  name: string;
  stream_icon?: string;
  rating?: string | number;
  rating_5based?: string | number;
  added?: string | number;
  category_id?: string | number;
  container_extension?: string;
  tmdb?: string | number;
  tmdb_id?: string | number;
  releaseDate?: string;
  releasedate?: string;
  genre?: string;
  plot?: string;
  description?: string;
};

type XtreamSeries = {
  series_id: number | string;
  name: string;
  cover?: string;
  backdrop_path?: string[];
  rating?: string | number;
  last_modified?: string | number;
  category_id?: string | number;
  tmdb?: string | number;
  tmdb_id?: string | number;
  releaseDate?: string;
  releasedate?: string;
  genre?: string;
  plot?: string;
  description?: string;
};

type HeroSlide = {
  id: string | number;
  type: "movie" | "series";
  title: string;
  image: string;
  logo?: string | null;
  year?: string | number | null;
  rating?: number;
  genre?: string;
  synopsis?: string;
  link: string;
};

type ContinueItem = {
  type: "movie" | "series";
  id: string | number;
  title: string;
  image?: string | null;
  seriesId?: string | number | null;
  season?: number | string | null;
  episode?: number | string | null;
  ext?: string | null;
  position?: number;
  duration?: number;
  updatedAt?: number;
};

/* =========================================================
   ANIMATIONS
========================================================= */

const heroImageVariants: Variants = {
  enter: {
    opacity: 0,
    scale: 1.035,
  },
  center: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.95,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 1.01,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const heroContentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    filter: "blur(5px)",
  },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/* =========================================================
   HELPERS
========================================================= */

function getContinuePercent(item: ContinueItem) {
  if (
    !item?.duration ||
    !item?.position ||
    item.duration <= 0 ||
    item.position <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, (Number(item.position) / Number(item.duration)) * 100)
  );
}

function buildResumeHref(item: ContinueItem) {
  const ext = item.ext || "mp4";
  const resume = Math.max(0, Math.floor(item.position || 0));

  if (item.type === "series") {
    return (
      `/watch?type=series` +
      `&id=${item.id}` +
      `&ext=${encodeURIComponent(ext)}` +
      `&title=${encodeURIComponent(item.title)}` +
      `${item.seriesId ? `&series=${item.seriesId}` : ""}` +
      `${resume > 15 ? `&resume=${resume}` : ""}`
    );
  }

  return (
    `/watch?type=movie` +
    `&id=${item.id}` +
    `&ext=${encodeURIComponent(ext)}` +
    `&title=${encodeURIComponent(item.title)}` +
    `${resume > 15 ? `&resume=${resume}` : ""}`
  );
}

function secondsRemaining(item: ContinueItem) {
  const duration = Number(item.duration || 0);
  const position = Number(item.position || 0);

  if (duration <= 0) return "";

  const remaining = Math.max(0, duration - position);
  const minutes = Math.ceil(remaining / 60);

  if (minutes < 60) return `${minutes} min restantes`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours} h ${mins > 0 ? `${mins} min` : ""}`.trim();
}

function numericTimestamp(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function uniqueById<T extends { id: string | number }>(items: T[]) {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(String(item.id), item);
  }

  return Array.from(map.values());
}

/* =========================================================
   LOGO HOOK
========================================================= */

function useHeroLogo(
  tmdbId?: string | number,
  title?: string,
  type: "movie" | "tv" = "movie"
) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId && !title) {
      setLogoUrl(null);
      return;
    }

    let mounted = true;

    const query = new URLSearchParams();

    if (tmdbId && String(tmdbId) !== "0") {
      query.append("tmdbId", String(tmdbId));
    }

    if (title) {
      query.append("title", title);
    }

    query.append("type", type);

    fetch(`/api/title-logo?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setLogoUrl(data?.logoUrl || null);
        }
      })
      .catch(() => {
        if (mounted) setLogoUrl(null);
      });

    return () => {
      mounted = false;
    };
  }, [tmdbId, title, type]);

  return logoUrl;
}

/* =========================================================
   CARD - CONTINUE
========================================================= */

function ContinueCard({ item }: { item: ContinueItem }) {
  const router = useRouter();
  const percent = getContinuePercent(item);

  return (
    <button
      type="button"
      onClick={() => router.push(buildResumeHref(item))}
      className="
        group
        relative
        w-[285px]
        sm:w-[320px]
        lg:w-[350px]
        shrink-0
        overflow-hidden
        rounded-[18px]
        border
        border-white/[0.08]
        bg-[#0d0d12]
        text-left
        shadow-[0_18px_50px_rgba(0,0,0,.28)]
        transition-all
        duration-500
        hover:-translate-y-1
        hover:border-white/[0.18]
        hover:shadow-[0_24px_70px_rgba(0,0,0,.40)]
      "
    >
      <div className="relative aspect-[16/8.7] w-full overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            draggable={false}
            className="
              absolute
              inset-0
              h-full
              w-full
              object-cover
              transition-transform
              duration-700
              group-hover:scale-[1.045]
            "
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#17171d] to-[#08080b]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/10" />

        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            bg-black/10
            opacity-0
            transition
            duration-300
            group-hover:opacity-100
          "
        >
          <div
            className="
              grid
              h-12
              w-12
              place-items-center
              rounded-full
              border
              border-white/25
              bg-black/35
              backdrop-blur-xl
            "
          >
            <Play className="h-4 w-4 translate-x-[1px] fill-white text-white" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-white/95">
                {cleanName(item.title)}
              </p>

              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/45">
                {item.type === "series" && item.season != null && (
                  <span>
                    S{String(item.season).padStart(2, "0")}
                  </span>
                )}

                {item.type === "series" && item.episode != null && (
                  <>
                    <span>·</span>
                    <span>
                      E{String(item.episode).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {secondsRemaining(item) && (
              <p className="shrink-0 text-[8px] text-white/35">
                {secondsRemaining(item)}
              </p>
            )}
          </div>

          {percent > 0 && (
            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
              <div
                style={{ width: `${percent}%` }}
                className="
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-[#aa93ff]
                  to-[#ebe5ff]
                  shadow-[0_0_10px_rgba(216,204,255,.6)]
                "
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   CARD - MEDIA
========================================================= */

function MediaCard({
  id,
  title,
  image,
  type,
  rating,
  year,
}: {
  id: string | number;
  title: string;
  image?: string | null;
  type: "movie" | "series";
  rating?: number;
  year?: string | number | null;
}) {
  const router = useRouter();

  const href = type === "movie" ? `/movies/${id}` : `/series/${id}`;

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="
        group
        relative
        w-[145px]
        sm:w-[165px]
        md:w-[180px]
        xl:w-[190px]
        shrink-0
        text-left
      "
    >
      <div
        className="
          relative
          aspect-[2/3]
          overflow-hidden
          rounded-[18px]
          bg-[#101014]
          shadow-[0_16px_40px_rgba(0,0,0,.25)]
          ring-1
          ring-white/[0.055]
          transition-all
          duration-500
          group-hover:-translate-y-1.5
          group-hover:scale-[1.025]
          group-hover:ring-white/[0.16]
          group-hover:shadow-[0_24px_65px_rgba(0,0,0,.40)]
        "
      >
        {image ? (
          <img
            src={image}
            alt={title}
            draggable={false}
            className="
              absolute
              inset-0
              h-full
              w-full
              object-cover
              transition-transform
              duration-700
              group-hover:scale-[1.055]
            "
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#19191f] to-[#08080a]" />
        )}

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-t
            from-black/95
            via-black/5
            to-transparent
            opacity-55
            transition-opacity
            duration-300
            group-hover:opacity-90
          "
        />

        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            bg-black/5
            opacity-0
            transition
            duration-300
            group-hover:opacity-100
          "
        >
          <div
            className="
              grid
              h-11
              w-11
              place-items-center
              rounded-full
              border
              border-white/25
              bg-black/30
              backdrop-blur-xl
            "
          >
            <Play className="h-4 w-4 translate-x-[1px] fill-white text-white" />
          </div>
        </div>

        <div
          className="
            absolute
            inset-x-0
            bottom-0
            translate-y-2
            px-3
            pb-3
            opacity-0
            transition-all
            duration-300
            group-hover:translate-y-0
            group-hover:opacity-100
          "
        >
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
            {cleanName(title)}
          </p>

          <div className="mt-1.5 flex items-center gap-2 text-[8px] text-white/45">
            {year && <span>{year}</span>}

            {rating && rating > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-[#d8ccff] text-[#d8ccff]" />
                  {rating.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   SECTION RAIL
========================================================= */

function RailSection({
  title,
  children,
  onMore,
}: {
  title: string;
  children: React.ReactNode;
  onMore?: () => void;
}) {
  return (
    <section className="relative">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onMore}
          className="
            group/title
            flex
            items-center
            gap-2
            text-left
          "
        >
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white sm:text-[19px]">
            {title}
          </h2>

          <ChevronRight
            className="
              h-4
              w-4
              text-white/30
              transition-all
              duration-300
              group-hover/title:translate-x-1
              group-hover/title:text-white
            "
          />
        </button>
      </div>

      <div
        className="
          flex
          gap-3
          overflow-x-auto
          overscroll-x-contain
          pb-4
          pr-6
          scrollbar-none
          sm:gap-4
        "
      >
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   HOME
========================================================= */

export default function HomePage() {
  const router = useRouter();
  const { favorites } = useLibrary();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);

  /* =======================================================
     MOVIES
  ======================================================= */

  const {
    data: moviesRaw,
    isLoading: moviesLoading,
  } = useQuery({
    queryKey: ["home-movies"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_vod_streams");

      if (!res.ok) {
        throw new Error("Impossible de charger les films");
      }

      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  /* =======================================================
     SERIES
  ======================================================= */

  const {
    data: seriesRaw,
    isLoading: seriesLoading,
  } = useQuery({
    queryKey: ["home-series"],
    queryFn: async () => {
      const res = await fetch("/api/xtream?action=get_series");

      if (!res.ok) {
        throw new Error("Impossible de charger les séries");
      }

      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const movies: XtreamMovie[] = Array.isArray(moviesRaw) ? moviesRaw : [];
  const series: XtreamSeries[] = Array.isArray(seriesRaw) ? seriesRaw : [];

  /* =======================================================
     HERO
  ======================================================= */

  const heroSlides: HeroSlide[] = useMemo(() => {
    const movieCandidates = movies
      .filter((movie) => {
        return (
          movie?.stream_id &&
          movie?.stream_icon &&
          String(movie.stream_icon).startsWith("http")
        );
      })
      .slice(0, 8)
      .map((movie) => ({
        id: movie.stream_id,
        type: "movie" as const,
        title: cleanName(movie.name || "Film"),
        image: movie.stream_icon || "",
        year:
          yearFrom(
            movie.releaseDate || movie.releasedate,
            movie.name || ""
          ) || null,
        rating: ratingNum(movie.rating),
        genre: movie.genre || "",
        synopsis:
          movie.plot ||
          movie.description ||
          "Découvrez ce film dans votre catalogue ROYA.",
        link: `/movies/${movie.stream_id}`,
        tmdbId: movie.tmdb_id || movie.tmdb,
      }));

    const seriesCandidates = series
      .filter((item) => {
        const image =
          item?.backdrop_path?.[0] ||
          item?.cover;

        return (
          item?.series_id &&
          image &&
          String(image).startsWith("http")
        );
      })
      .slice(0, 6)
      .map((item) => ({
        id: item.series_id,
        type: "series" as const,
        title: cleanName(item.name || "Série"),
        image:
          item.backdrop_path?.[0] ||
          item.cover ||
          "",
        year:
          yearFrom(
            item.releaseDate || item.releasedate,
            item.name || ""
          ) || null,
        rating: ratingNum(item.rating),
        genre: item.genre || "",
        synopsis:
          item.plot ||
          item.description ||
          "Découvrez cette série dans votre catalogue ROYA.",
        link: `/series/${item.series_id}`,
        tmdbId: item.tmdb_id || item.tmdb,
      }));

    const mixed = [
      ...movieCandidates.slice(0, 4),
      ...seriesCandidates.slice(0, 3),
    ];

    return mixed.slice(0, 6);
  }, [movies, series]);

  const activeSlide = heroSlides[currentSlide];

  const activeTmdbId = useMemo(() => {
    if (!activeSlide) return undefined;

    if (activeSlide.type === "movie") {
      const movie = movies.find(
        (item) => String(item.stream_id) === String(activeSlide.id)
      );

      return movie?.tmdb_id || movie?.tmdb;
    }

    const serie = series.find(
      (item) => String(item.series_id) === String(activeSlide.id)
    );

    return serie?.tmdb_id || serie?.tmdb;
  }, [activeSlide, movies, series]);

  const heroLogo = useHeroLogo(
    activeTmdbId,
    activeSlide?.title,
    activeSlide?.type === "series" ? "tv" : "movie"
  );

  /* =======================================================
     HERO ROTATION
  ======================================================= */

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => {
        return (prev + 1) % heroSlides.length;
      });
    }, 11000);

    return () => {
      window.clearInterval(timer);
    };
  }, [heroSlides.length]);

  useEffect(() => {
    if (currentSlide >= heroSlides.length && heroSlides.length > 0) {
      setCurrentSlide(0);
    }
  }, [heroSlides.length, currentSlide]);

  /* =======================================================
     CONTINUE
  ======================================================= */

  useEffect(() => {
    const readContinueItems = () => {
      const collected: ContinueItem[] = [];

      try {
        const lastPlayedRaw = localStorage.getItem("gtv_last_played");

        if (lastPlayedRaw) {
          const parsed = JSON.parse(lastPlayedRaw);

          if (parsed?.id && parsed?.title) {
            collected.push(parsed);
          }
        }
      } catch {}

      try {
        const historyRaw = localStorage.getItem("gtv_continue_history");

        if (historyRaw) {
          const parsed = JSON.parse(historyRaw);

          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.id && item?.title) {
                collected.push(item);
              }
            }
          }
        }
      } catch {}

      try {
        const oldRaw = localStorage.getItem("gtv_last_watched");

        if (oldRaw) {
          const old = JSON.parse(oldRaw);

          if (old?.id && old?.title) {
            collected.push({
              type:
                old.type === "series"
                  ? "series"
                  : "movie",
              id: old.id,
              title: old.title,
              image: old.poster || old.image || null,
              position:
                old.position ||
                (old.progress && old.duration
                  ? (old.progress / 100) * old.duration
                  : 0),
              duration: old.duration || 0,
              updatedAt: old.updatedAt || Date.now(),
            });
          }
        }
      } catch {}

      const sorted = uniqueById(
        collected.map((item) => ({
          ...item,
          id: item.id,
        }))
      )
        .sort(
          (a, b) =>
            numericTimestamp(b.updatedAt) -
            numericTimestamp(a.updatedAt)
        )
        .slice(0, 8);

      setContinueItems(sorted);
    };

    readContinueItems();

    window.addEventListener("storage", readContinueItems);
    window.addEventListener(
      "gtv-continue-updated",
      readContinueItems as EventListener
    );

    return () => {
      window.removeEventListener("storage", readContinueItems);
      window.removeEventListener(
        "gtv-continue-updated",
        readContinueItems as EventListener
      );
    };
  }, []);

  /* =======================================================
     RAIL DATA
  ======================================================= */

  const trendingMovies = useMemo(() => {
    return [...movies]
      .filter(
        (movie) =>
          movie.stream_icon &&
          String(movie.stream_icon).startsWith("http")
      )
      .sort((a, b) => ratingNum(b.rating) - ratingNum(a.rating))
      .slice(0, 18);
  }, [movies]);

  const newestMovies = useMemo(() => {
    return [...movies]
      .filter(
        (movie) =>
          movie.stream_icon &&
          String(movie.stream_icon).startsWith("http")
      )
      .sort(
        (a, b) =>
          numericTimestamp(b.added) -
          numericTimestamp(a.added)
      )
      .slice(0, 18);
  }, [movies]);

  const discoverySeries = useMemo(() => {
    return [...series]
      .filter((item) => {
        const image =
          item.cover ||
          item.backdrop_path?.[0];

        return image && String(image).startsWith("http");
      })
      .sort(
        (a, b) =>
          ratingNum(b.rating) -
          ratingNum(a.rating)
      )
      .slice(0, 18);
  }, [series]);

  /* =======================================================
     FAVORITES
  ======================================================= */

  const favoriteItems = useMemo(() => {
    return Object.values(favorites || {}).slice(0, 18);
  }, [favorites]);

  /* =======================================================
     RENDER
  ======================================================= */

  const loading = moviesLoading && seriesLoading;

  return (
    <main
      className="
        relative
        min-h-[100dvh]
        overflow-x-hidden
        bg-[#060608]
        pb-28
        text-white
        md:pb-20
      "
    >
      {/* ===================================================
          HERO
      =================================================== */}

      <section
        className="
          relative
          h-[70vh]
          min-h-[600px]
          w-full
          overflow-hidden
          bg-[#0a0a0d]
          sm:h-[76vh]
          lg:h-[82vh]
          lg:min-h-[680px]
        "
      >
        {loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="h-9 w-9 animate-spin text-white/15" />
          </div>
        ) : activeSlide ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeSlide.type}-${activeSlide.id}`}
                variants={heroImageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <img
                  src={activeSlide.image}
                  alt={activeSlide.title}
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                    object-center
                  "
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-black/10" />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-r
                from-[#060608]
                via-[#060608]/88
                via-[38%]
                to-[#060608]/5
              "
            />

            <div
              className="
                absolute
                inset-x-0
                top-0
                h-36
                bg-gradient-to-b
                from-black/65
                to-transparent
              "
            />

            <div
              className="
                absolute
                inset-x-0
                bottom-0
                h-[52%]
                bg-gradient-to-t
                from-[#060608]
                via-[#060608]/78
                to-transparent
              "
            />

            <div
              className="
                absolute
                inset-y-0
                right-0
                w-[40%]
                bg-gradient-to-l
                from-black/15
                to-transparent
              "
            />

            <div
              className="
                relative
                z-10
                flex
                h-full
                max-w-[1900px]
                items-end
                px-4
                pb-[150px]
                sm:px-7
                sm:pb-[170px]
                lg:px-12
                lg:pb-[190px]
                xl:px-14
              "
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`hero-content-${activeSlide.type}-${activeSlide.id}`}
                  variants={heroContentVariants}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                  className="max-w-[720px]"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <span
                      className="
                        h-1.5
                        w-1.5
                        rounded-full
                        bg-[#d8ccff]
                        shadow-[0_0_14px_rgba(216,204,255,.9)]
                      "
                    />

                    <p className="text-[9px] font-semibold uppercase tracking-[0.30em] text-[#d8ccff]/75">
                      À la une sur ROYA
                    </p>
                  </div>

                  {heroLogo ? (
                    <div className="mb-5 flex min-h-[85px] items-end">
                      <img
                        src={heroLogo}
                        alt={activeSlide.title}
                        className="
                          max-h-[110px]
                          max-w-[320px]
                          object-contain
                          object-left
                          drop-shadow-[0_14px_30px_rgba(0,0,0,.55)]
                          sm:max-w-[420px]
                          lg:max-h-[135px]
                          lg:max-w-[500px]
                        "
                      />
                    </div>
                  ) : (
                    <h1
                      className="
                        mb-4
                        max-w-[700px]
                        text-4xl
                        font-semibold
                        leading-[0.95]
                        tracking-[-0.045em]
                        text-white
                        drop-shadow-2xl
                        sm:text-5xl
                        lg:text-6xl
                        xl:text-7xl
                      "
                    >
                      {activeSlide.title}
                    </h1>
                  )}

                  <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[11px] font-medium text-white/65 sm:text-xs">
                    {activeSlide.year && (
                      <span>{activeSlide.year}</span>
                    )}

{typeof activeSlide.rating === "number" && activeSlide.rating > 0 && (
  <>
    <span className="text-white/25">•</span>

    <span className="flex items-center gap-1 text-white/75">
      <Star className="h-3 w-3 fill-[#d8ccff] text-[#d8ccff]" />
      {activeSlide.rating.toFixed(1)}
    </span>
  </>
)}

                    <span className="text-white/25">•</span>

                    <span className="rounded-[5px] border border-white/15 bg-white/[0.07] px-1.5 py-[2px] text-[9px] text-white/65">
                      {activeSlide.type === "series" ? "SÉRIE" : "FILM"}
                    </span>

                    {activeSlide.genre && (
                      <>
                        <span className="text-white/25">•</span>

                        <span className="line-clamp-1 max-w-[350px]">
                          {activeSlide.genre}
                        </span>
                      </>
                    )}
                  </div>

                  <p
                    className="
                      mb-7
                      line-clamp-3
                      max-w-[650px]
                      text-[12px]
                      leading-6
                      text-white/54
                      sm:text-[13px]
                      lg:text-[14px]
                    "
                  >
                    {activeSlide.synopsis}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => router.push(activeSlide.link)}
                      className="
                        inline-flex
                        h-11
                        items-center
                        gap-2.5
                        rounded-[14px]
                        bg-[#d8ccff]
                        px-5
                        text-[12px]
                        font-semibold
                        text-[#151119]
                        shadow-[0_12px_35px_rgba(216,204,255,.22)]
                        transition-all
                        duration-300
                        hover:scale-[1.025]
                        hover:bg-[#e5dcff]
                        active:scale-[.98]
                        sm:h-12
                        sm:px-6
                        sm:text-[13px]
                      "
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Regarder
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push(activeSlide.link)}
                      className="
                        inline-flex
                        h-11
                        items-center
                        gap-2
                        rounded-[14px]
                        border
                        border-white/[0.13]
                        bg-white/[0.045]
                        px-5
                        text-[12px]
                        font-medium
                        text-white/80
                        backdrop-blur-xl
                        transition-all
                        duration-300
                        hover:border-white/[0.22]
                        hover:bg-white/[0.08]
                        hover:text-white
                        sm:h-12
                      "
                    >
                      <Plus className="h-4 w-4" />
                      Ma liste
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push(activeSlide.link)}
                      className="
                        inline-flex
                        h-11
                        items-center
                        gap-2
                        rounded-[14px]
                        px-3
                        text-[11px]
                        font-medium
                        text-white/50
                        transition-colors
                        hover:text-white
                      "
                    >
                      <Info className="h-4 w-4" />
                      Plus d&apos;infos
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {heroSlides.length > 1 && (
              <div
                className="
                  absolute
                  bottom-[118px]
                  right-4
                  z-20
                  hidden
                  items-center
                  gap-2
                  sm:flex
                  sm:right-7
                  lg:bottom-[145px]
                  lg:right-12
                "
              >
                {heroSlides.map((slide, index) => {
                  const active = index === currentSlide;

                  return (
                    <button
                      key={`${slide.type}-${slide.id}`}
                      type="button"
                      aria-label={`Afficher ${slide.title}`}
                      onClick={() => setCurrentSlide(index)}
                      className={cn(
                        "h-[3px] rounded-full transition-all duration-500",
                        active
                          ? "w-9 bg-[#d8ccff] shadow-[0_0_9px_rgba(216,204,255,.6)]"
                          : "w-4 bg-white/20 hover:bg-white/40"
                      )}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <div
        className="
          relative
          z-20
          -mt-[115px]
          space-y-10
          px-4
          sm:px-7
          lg:-mt-[138px]
          lg:px-12
          xl:px-14
        "
      >
        {/* =================================================
            CONTINUE
        ================================================= */}

        {continueItems.length > 0 && (
          <RailSection title="Reprendre la lecture">
            {continueItems.map((item) => (
              <ContinueCard
                key={`${item.type}-${item.id}`}
                item={item}
              />
            ))}
          </RailSection>
        )}

        {/* =================================================
            TRENDING
        ================================================= */}

        {trendingMovies.length > 0 && (
          <RailSection
            title="Tendances"
            onMore={() => router.push("/movies")}
          >
            {trendingMovies.map((movie) => (
              <MediaCard
                key={`trend-${movie.stream_id}`}
                id={movie.stream_id}
                type="movie"
                title={movie.name}
                image={movie.stream_icon}
                rating={ratingNum(movie.rating)}
                year={
                  yearFrom(
                    movie.releaseDate || movie.releasedate,
                    movie.name
                  ) || null
                }
              />
            ))}
          </RailSection>
        )}

        {/* =================================================
            NEW MOVIES
        ================================================= */}

        {newestMovies.length > 0 && (
          <RailSection
            title="Nouveautés"
            onMore={() => router.push("/movies")}
          >
            {newestMovies.map((movie) => (
              <MediaCard
                key={`new-${movie.stream_id}`}
                id={movie.stream_id}
                type="movie"
                title={movie.name}
                image={movie.stream_icon}
                rating={ratingNum(movie.rating)}
                year={
                  yearFrom(
                    movie.releaseDate || movie.releasedate,
                    movie.name
                  ) || null
                }
              />
            ))}
          </RailSection>
        )}

        {/* =================================================
            SERIES
        ================================================= */}

        {discoverySeries.length > 0 && (
          <RailSection
            title="Séries à découvrir"
            onMore={() => router.push("/series")}
          >
            {discoverySeries.map((item) => (
              <MediaCard
                key={`series-${item.series_id}`}
                id={item.series_id}
                type="series"
                title={item.name}
                image={item.cover || item.backdrop_path?.[0]}
                rating={ratingNum(item.rating)}
                year={
                  yearFrom(
                    item.releaseDate || item.releasedate,
                    item.name
                  ) || null
                }
              />
            ))}
          </RailSection>
        )}

        {/* =================================================
            FAVORITES
        ================================================= */}

        {favoriteItems.length > 0 && (
          <RailSection
            title="Ma liste"
            onMore={() => router.push("/favorites")}
          >
            {favoriteItems.map((fav: any) => (
              <MediaCard
                key={`fav-${fav.type || "movie"}-${fav.id}`}
                id={fav.id}
                type={
                  fav.type === "series"
                    ? "series"
                    : "movie"
                }
                title={fav.name || fav.title || "Contenu"}
                image={fav.poster || fav.image || fav.cover}
                rating={
                  typeof fav.rating !== "undefined"
                    ? ratingNum(fav.rating)
                    : undefined
                }
                year={fav.year || null}
              />
            ))}
          </RailSection>
        )}

        {/* =================================================
            FOOT SPACER
        ================================================= */}

        <div className="h-4" />
      </div>
    </main>
  );
}