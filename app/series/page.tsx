"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tv, Play, Search, X } from "lucide-react";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/* =========================================================
   NETTOYAGE DES NOMS
========================================================= */

const formatCategoryName = (rawName: string) => {
  if (!rawName) return "";

  const cleanName = rawName
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(/[Ⓐ-Ⓩⓐ-ⓩ║]/g, "")
    .replace(/VOD-FR/gi, "")
    .replace(/FR\s*-/gi, "")
    .replace(/^[-_| \s]+|[-_| \s]+$/g, "")
    .trim();

  const customNames: Record<string, string> = {
    "SCIENCE FICTION": "Sci-Fi",
    "SOUS TITRÉS": "VOSTFR",
    "TÉLÉ-FILM": "Téléfilms",
    HORREUR: "Horreur",
  };

  return customNames[cleanName] || cleanName;
};

const cleanSeriesName = (rawName: string) => {
  if (!rawName) return "";

  return rawName
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(/[Ⓐ-Ⓩⓐ-ⓩ║]/g, "")
    .replace(
      /\b(4K|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFI|FR)\b/gi,
      ""
    )
    .replace(/\s*\(\d{4}\)/g, "")
    .replace(/\s*\[\d{4}\]/g, "")
    .replace(/[\/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const categoryImageCache = new Map<string, string | null>();

/* =========================================================
   CARTE CATÉGORIE
========================================================= */

type CategoryCardProps = {
  name: string;
  isActive: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const CategoryCard = React.memo(function CategoryCard({
  name,
  isActive,
  onClick,
}: CategoryCardProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [bgImage, setBgImage] = useState<string | null>(
    () => categoryImageCache.get(name) ?? null
  );

  useEffect(() => {
    const cached = categoryImageCache.get(name);

    if (cached !== undefined) {
      setBgImage(cached);
      return;
    }

    const element = buttonRef.current;

    if (!element) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const load = () => {
      controller = new AbortController();

      fetch(`/api/category-image?query=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;

          const value = data?.imageUrl || null;

          categoryImageCache.set(name, value);
          setBgImage(value);
        })
        .catch(() => {
          if (!cancelled) {
            categoryImageCache.set(name, null);
          }
        });
    };

    if (!("IntersectionObserver" in window)) {
      load();

      return () => {
        cancelled = true;

        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      {
        rootMargin: "180px",
      }
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();

      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    };
  }, [name]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={cn(
        `
        gtv-series-category
        group
        relative
        h-[44px]
        w-[112px]
        flex-shrink-0
        select-none
        overflow-hidden
        rounded-[11px]
        transition-all
        duration-300

        sm:h-[52px]
        sm:w-[130px]
        sm:rounded-[13px]

        lg:h-[64px]
        lg:w-[150px]
        lg:rounded-[16px]

        xl:h-[76px]
        xl:w-[170px]
        `,
        isActive
          ? `
            scale-[1.01]
            border
            border-[#d8ccff]/50
            bg-[#d8ccff]/10
            shadow-[0_8px_24px_rgba(170,145,255,.13)]
          `
          : `
            border
            border-white/10
            bg-white/[0.035]
            hover:border-white/20
            hover:bg-white/[0.06]
          `
      )}
    >
      {bgImage ? (
        <>
          <img
            src={bgImage}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="
              pointer-events-none
              absolute
              inset-0
              h-full
              w-full
              object-cover
              opacity-35
              transition-opacity
              duration-300
              group-hover:opacity-55
            "
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-gradient-to-t
              from-[#060608]/90
              via-[#060608]/55
              to-transparent
            "
          />
        </>
      ) : (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-gradient-to-br
            from-white/[0.05]
            to-transparent
          "
        />
      )}

      {isActive && (
        <motion.div
          layoutId="active-category-outline-series"
          className="
            pointer-events-none
            absolute
            inset-0
            rounded-[11px]
            ring-1
            ring-[#d8ccff]/60
            shadow-[inset_0_0_18px_rgba(216,204,255,.10)]

            sm:rounded-[13px]
            lg:rounded-[16px]
          "
        />
      )}

      <span
        className={cn(
          `
          absolute
          inset-0
          flex
          items-center
          justify-center
          px-2
          text-center
          text-[9px]
          font-bold
          leading-[1.05]
          tracking-wide
          drop-shadow-md
          transition-colors

          sm:text-[10px]

          lg:px-3
          lg:text-xs

          xl:text-[13px]
          `,
          isActive
            ? "text-white"
            : "text-white/70 group-hover:text-white"
        )}
      >
        {name}
      </span>
    </button>
  );
});

/* =========================================================
   GLISSEMENT HORIZONTAL
========================================================= */

function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);

  const pressedRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !ref.current) {
      return;
    }

    pressedRef.current = true;
    startXRef.current = event.clientX;
    startScrollRef.current = ref.current.scrollLeft;

    setIsDragging(false);
  };

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pressedRef.current || !ref.current) {
      return;
    }

    const delta = event.clientX - startXRef.current;

    if (Math.abs(delta) > 5) {
      setIsDragging(true);
      event.preventDefault();
    }

    ref.current.scrollLeft = startScrollRef.current - delta * 1.35;
  };

  const stop = () => {
    pressedRef.current = false;

    window.setTimeout(() => {
      setIsDragging(false);
    }, 60);
  };

  return {
    dragProps: {
      ref,
      onMouseDown,
      onMouseMove,
      onMouseUp: stop,
      onMouseLeave: stop,
    },
    isDragging,
  };
}

/* =========================================================
   GLISSEMENT VERTICAL
========================================================= */

function useVerticalScroll() {
  const ref = useRef<HTMLDivElement>(null);

  const pressedRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !ref.current) {
      return;
    }

    pressedRef.current = true;
    startYRef.current = event.clientY;
    startScrollRef.current = ref.current.scrollTop;

    setIsDragging(false);
  };

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pressedRef.current || !ref.current) {
      return;
    }

    const delta = event.clientY - startYRef.current;

    if (Math.abs(delta) > 5) {
      setIsDragging(true);
      event.preventDefault();
    }

    ref.current.scrollTop = startScrollRef.current - delta * 1.35;
  };

  const stop = () => {
    pressedRef.current = false;

    window.setTimeout(() => {
      setIsDragging(false);
    }, 60);
  };

  return {
    dragProps: {
      ref,
      onMouseDown,
      onMouseMove,
      onMouseUp: stop,
      onMouseLeave: stop,
    },
    isDragging,
  };
}

/* =========================================================
   PAGE SÉRIES
========================================================= */

export default function SeriesCatalogPage() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] =
    useState("recent");

  const [visibleLimit, setVisibleLimit] =
    useState(48);

  const [searchQuery, setSearchQuery] =
    useState("");

  const categoryDrag =
    useHorizontalScroll();

  const seriesDrag =
    useVerticalScroll();

  /* =======================================================
     CATÉGORIES
  ======================================================= */

  const {
    data: categories = [],
    isLoading: isLoadingCats,
  } = useQuery({
    queryKey: [
      "series-categories",
    ],

    queryFn: async () => {
      const res =
        await fetch(
          "/api/xtream?action=get_series_categories"
        );

      if (!res.ok) {
        throw new Error(
          "Impossible de charger les catégories"
        );
      }

      return res.json();
    },

    select: (
      data: any[]
    ) =>
      Array.isArray(data)
        ? data.map(
            (cat: any) => ({
              ...cat,

              category_name:
                formatCategoryName(
                  cat.category_name
                ),
            })
          )
        : [],

    staleTime:
      10 * 60 * 1000,
  });

  useEffect(() => {
    setVisibleLimit(48);
  }, [
    activeCategory,
    searchQuery,
  ]);

  /* =======================================================
     SÉRIES
  ======================================================= */

  const {
    data:
      seriesList = [],

    isLoading:
      isLoadingSeries,
  } = useQuery({
    queryKey: [
      "series",
      activeCategory,
    ],

    queryFn: async () => {
      const action =
        activeCategory ===
        "recent"
          ? "/api/xtream?action=get_series"
          : `/api/xtream?action=get_series&category_id=${encodeURIComponent(
              activeCategory
            )}`;

      const res =
        await fetch(action);

      if (!res.ok) {
        throw new Error(
          "Impossible de charger les séries"
        );
      }

      const data =
        await res.json();

      const list =
        Array.isArray(data)
          ? data
          : [];

      if (
        activeCategory !==
        "recent"
      ) {
        return list;
      }

      return list
        .map(
          (
            series: any,
            index: number
          ) => ({
            series,
            index,

            modified:
              Number.parseInt(
                String(
                  series?.last_modified ??
                    series?.added ??
                    series?.updated_at ??
                    0
                ),
                10
              ) || 0,
          })
        )
        .sort(
          (a, b) =>
            b.modified -
              a.modified ||
            a.index -
              b.index
        )
        .map(
          ({ series }) =>
            series
        );
    },

    enabled:
      activeCategory ===
        "recent" ||
      (
        categories.length >
          0 &&
        Boolean(
          activeCategory
        )
      ),

    staleTime:
      5 * 60 * 1000,

    placeholderData:
      (
        previousData: any
      ) => previousData,

    retry: 0,
  });

  /* =======================================================
     RECHERCHE GLOBALE
  ======================================================= */

  const {
    data:
      globalSeriesList = [],

    isLoading:
      isLoadingGlobalSearch,
  } = useQuery({
    queryKey: [
      "series",
      "global-search",
    ],

    queryFn: async () => {
      const res =
        await fetch(
          "/api/xtream?action=get_series"
        );

      if (!res.ok) {
        throw new Error(
          "Impossible de charger la recherche des séries"
        );
      }

      const data =
        await res.json();

      return Array.isArray(
        data
      )
        ? data
        : [];
    },

    enabled:
      searchQuery
        .trim()
        .length > 0,

    staleTime:
      10 * 60 * 1000,

    retry: 0,
  });

  /* =======================================================
     FILTRAGE
  ======================================================= */

  const filteredSeries =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      const source =
        query.length > 0
          ? globalSeriesList
          : seriesList;

      if (
        !Array.isArray(
          source
        )
      ) {
        return [];
      }

      if (!query) {
        return source.slice(
          0,
          visibleLimit
        );
      }

      return source
        .filter(
          (series: any) =>
            cleanSeriesName(
              series?.name ||
                ""
            )
              .toLowerCase()
              .includes(
                query
              )
        )
        .slice(
          0,
          visibleLimit
        );
    }, [
      seriesList,
      globalSeriesList,
      searchQuery,
      visibleLimit,
    ]);

  const showSeriesLoading =
    isLoadingSeries ||
    (
      searchQuery
        .trim()
        .length > 0 &&
      isLoadingGlobalSearch
    );

  /* =======================================================
     ANIMATIONS
  ======================================================= */

  const containerVariants:
    Variants = {
    hidden: {
      opacity: 0,
    },

    show: {
      opacity: 1,

      transition: {
        staggerChildren:
          0.008,
      },
    },
  };

  const itemVariants:
    Variants = {
    hidden: {
      opacity: 0,
      scale: 0.97,
      y: 12,
    },

    show: {
      opacity: 1,
      scale: 1,
      y: 0,

      transition: {
        duration: 0.2,

        ease: [
          0.16,
          1,
          0.3,
          1,
        ],
      },
    },
  };

  /* =======================================================
     SÉLECTION CATÉGORIE
  ======================================================= */

  const selectCategory = (
    event: React.MouseEvent<HTMLButtonElement>,
    categoryId: string
  ) => {
    if (
      categoryDrag.isDragging
    ) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    setActiveCategory(
      categoryId
    );

    setSearchQuery("");
  };

  /* =======================================================
     RETURN / HEADER / CATÉGORIES
  ======================================================= */

  return (
    <div
      className="
        gtv-series-page
        relative
        flex
        h-full
        min-h-0
        w-full
        flex-1
        flex-col
        overflow-hidden
        bg-[#060608]
        text-white
      "
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[38vh] bg-gradient-to-b from-[#d8ccff]/[0.025] to-transparent blur-3xl" />
      </div>

      {/* HEADER NORMAL */}
      <div
        className="
          gtv-series-standard-header
          relative
          z-10
          shrink-0

          px-3
          pb-1.5
          pt-3

          sm:px-6
          sm:pb-2
          sm:pt-5

          lg:px-8
          lg:pt-8
        "
      >
        <div
          className="
            mb-3
            flex
            items-center
            justify-between
            gap-3

            sm:mb-5
            lg:mb-8
          "
        >
          <h1
            className="
              flex
              min-w-0
              shrink-0
              items-center
              gap-2

              text-xl
              font-extrabold
              tracking-tight
              drop-shadow-md

              sm:gap-2.5
              sm:text-3xl

              lg:gap-3
              lg:text-4xl
            "
          >
            <div
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                border
                border-white/5
                bg-white/10
                backdrop-blur-md

                sm:h-10
                sm:w-10

                lg:h-12
                lg:w-12
              "
            >
              <Tv className="h-4 w-4 text-[#d8ccff] sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
            </div>

            <span>
              Séries
            </span>
          </h1>

          <div
            className="
              group
              relative
              min-w-0
              flex-1

              sm:max-w-[280px]
            "
          >
            <Search
              className="
                absolute
                left-3
                top-1/2
                h-3.5
                w-3.5
                -translate-y-1/2
                text-white/40
                transition-colors

                group-focus-within:text-[#d8ccff]

                sm:left-4
                sm:h-4
                sm:w-4
              "
            />

            <input
              type="search"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              className="
                h-9
                w-full
                appearance-none
                rounded-full
                border
                border-white/10
                bg-white/[0.04]
                pl-9
                pr-8
                text-[11px]
                text-white
                shadow-inner
                outline-none
                ring-0
                transition-all

                placeholder:text-white/35

                focus:bg-white/[0.08]
                focus:outline-none
                focus:ring-1
                focus:ring-[#d8ccff]/50

                sm:h-11
                sm:pl-11
                sm:pr-10
                sm:text-sm
              "
            />

            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  type="button"
                  initial={{
                    opacity: 0,
                    scale: 0.8,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                  }}
                  onClick={() =>
                    setSearchQuery("")
                  }
                  className="
                    absolute
                    right-2
                    top-1/2
                    -translate-y-1/2
                    rounded-full
                    p-1
                    transition-colors
                    hover:bg-white/10

                    sm:right-3
                    sm:p-1.5
                  "
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3.5 w-3.5 text-white/60 hover:text-white sm:h-4 sm:w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CATÉGORIES NORMALES */}
        <div className="relative mb-1 sm:mb-2">
          {isLoadingCats ? (
            <div className="flex gap-2 overflow-hidden sm:gap-3">
              {Array.from({
                length: 8,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="
                      h-[44px]
                      w-[112px]
                      shrink-0
                      animate-pulse
                      rounded-[11px]
                      border
                      border-white/5
                      bg-white/[0.03]

                      sm:h-[52px]
                      sm:w-[130px]
                      sm:rounded-[13px]

                      lg:h-[64px]
                      lg:w-[150px]
                      lg:rounded-[16px]

                      xl:h-[76px]
                      xl:w-[170px]
                    "
                  />
                )
              )}
            </div>
          ) : (
            <div
              {...categoryDrag.dragProps}
              style={{
                WebkitOverflowScrolling:
                  "touch",
                touchAction:
                  "pan-x",
              }}
              className={cn(
                `
                flex
                gap-2
                overflow-x-auto
                pb-2
                scrollbar-none
                select-none

                sm:gap-3
                sm:pb-3

                lg:pb-4
                `,
                categoryDrag.isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
              )}
            >
              <CategoryCard
                name="SÉRIES RÉCENTES"
                isActive={
                  activeCategory ===
                  "recent"
                }
                onClick={(event) =>
                  selectCategory(
                    event,
                    "recent"
                  )
                }
              />

              {categories
                .filter(
                  (cat: any) =>
                    String(
                      cat.category_id
                    ) !== "0"
                )
                .map(
                  (cat: any) => {
                    const categoryId =
                      String(
                        cat.category_id
                      );

                    return (
                      <CategoryCard
                        key={categoryId}
                        name={
                          cat.category_name
                        }
                        isActive={
                          activeCategory ===
                          categoryId
                        }
                        onClick={(event) =>
                          selectCategory(
                            event,
                            categoryId
                          )
                        }
                      />
                    );
                  }
                )}
            </div>
          )}
        </div>
      </div>

      <div
        className="
          gtv-series-standard-separator
          h-px
          w-full
          shrink-0
          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
          opacity-50
        "
      />

      {/* SUITE DANS LA PARTIE SUIVANTE */}

            {/* CONTENU PRINCIPAL */}
      <div
        className="
          gtv-series-content-shell
          relative
          z-10
          flex
          min-h-0
          flex-1
          overflow-hidden
        "
      >
        {/* GRILLE SÉRIES */}
        <div
          {...seriesDrag.dragProps}
          onScroll={(event) => {
            const el =
              event.currentTarget;

            if (
              el.scrollTop +
                el.clientHeight >=
              el.scrollHeight - 700
            ) {
              setVisibleLimit(
                (current) =>
                  Math.min(
                    current + 40,
                    160
                  )
              );
            }
          }}
          style={{
            WebkitOverflowScrolling:
              "touch",
            touchAction:
              "pan-y",
          }}
          className={cn(
            `
            gtv-series-grid-scroll
            relative
            z-10
            min-w-0
            flex-1
            overflow-y-auto
            scrollbar-none
            select-none

            px-3
            pb-24
            pt-3

            sm:px-6
            sm:pb-28
            sm:pt-5

            lg:p-8
            lg:pb-32
            lg:pt-6
            `,
            seriesDrag.isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
          )}
        >
          {showSeriesLoading ? (
            <div
              className="
                gtv-series-grid
                grid
                grid-cols-3
                gap-x-3
                gap-y-5

                sm:grid-cols-4
                sm:gap-x-4
                sm:gap-y-6

                md:grid-cols-5

                lg:grid-cols-6
                lg:gap-5

                xl:grid-cols-7

                2xl:grid-cols-8
              "
            >
              {Array.from({
                length: 24,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="
                      aspect-[2/3]
                      animate-pulse
                      rounded-[14px]
                      border
                      border-white/5
                      bg-white/[0.03]

                      sm:rounded-[16px]
                      lg:rounded-[20px]
                    "
                  />
                )
              )}
            </div>
          ) : filteredSeries.length ===
            0 ? (
            <div className="mt-8 flex h-full flex-col items-center justify-center opacity-60 sm:mt-10">
              <Search className="mb-3 h-10 w-10 text-white/40 sm:mb-4 sm:h-12 sm:w-12" />

              <p className="text-center text-base font-medium text-white/70 sm:text-lg">
                Aucun résultat pour &quot;
                {searchQuery}
                &quot;
              </p>

              <p className="mt-1 text-center text-xs text-white/40 sm:text-sm">
                Essayez avec un autre
                mot-clé ou changez de
                catégorie.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}:${searchQuery}`}
                variants={
                  containerVariants
                }
                initial="hidden"
                animate="show"
                exit="hidden"
                className="
                  gtv-series-grid
                  grid
                  grid-cols-3
                  gap-x-3
                  gap-y-5

                  sm:grid-cols-4
                  sm:gap-x-4
                  sm:gap-y-6

                  md:grid-cols-5

                  lg:grid-cols-6
                  lg:gap-5

                  xl:grid-cols-7

                  2xl:grid-cols-8
                "
              >
                {filteredSeries.map(
                  (
                    series: any
                  ) => {
                    const seriesImage =
                      series.cover ||
                      series.stream_icon ||
                      series.poster ||
                      null;

                    const seriesName =
                      cleanSeriesName(
                        series.name
                      ) ||
                      series.name ||
                      "Série";

                    const seriesId =
                      series.series_id ??
                      series.stream_id;

                    return (
                      <motion.div
                        variants={
                          itemVariants
                        }
                        key={
                          seriesId
                        }
                        onClick={(
                          event
                        ) => {
                          if (
                            seriesDrag.isDragging
                          ) {
                            event.preventDefault();
                            event.stopPropagation();

                            return;
                          }

                          router.push(
                            `/series/${seriesId}`
                          );
                        }}
                        className="
                          gtv-series-item
                          group
                          relative
                          flex
                          cursor-pointer
                          flex-col
                          [contain-intrinsic-size:300px]
                          [content-visibility:auto]
                        "
                      >
                        <div
                          className="
                            gtv-series-poster
                            relative
                            aspect-[2/3]
                            overflow-hidden
                            rounded-[14px]
                            border
                            border-white/10
                            bg-[#0d0d12]
                            shadow-[0_8px_24px_rgba(0,0,0,.35)]
                            transition-all
                            duration-300

                            group-hover:border-white/20
                            group-hover:shadow-[0_12px_34px_rgba(0,0,0,.55)]

                            sm:rounded-[16px]
                            lg:rounded-[20px]
                          "
                        >
                          {seriesImage ? (
                            <img
                              src={
                                seriesImage
                              }
                              alt={
                                seriesName
                              }
                              draggable={
                                false
                              }
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                              className="
                                pointer-events-none
                                h-full
                                w-full
                                object-cover
                                transition-transform
                                duration-500
                                ease-out
                                group-hover:scale-[1.06]
                              "
                              onError={(
                                event
                              ) => {
                                event.currentTarget.style.opacity =
                                  "0";
                              }}
                            />
                          ) : (
                            <div className="pointer-events-none flex h-full w-full items-center justify-center">
                              <Tv className="h-8 w-8 text-white/10 sm:h-10 sm:w-10" />
                            </div>
                          )}

                          <div
                            className="
                              pointer-events-none
                              absolute
                              inset-0
                              flex
                              items-center
                              justify-center
                              bg-black/0
                              transition-colors
                              duration-300
                              group-hover:bg-black/40
                            "
                          >
                            <div
                              className="
                                flex
                                h-10
                                w-10
                                scale-75
                                items-center
                                justify-center
                                rounded-full
                                border
                                border-white/30
                                bg-white/20
                                opacity-0
                                shadow-2xl
                                backdrop-blur-md
                                transition-all
                                duration-300
                                ease-out

                                group-hover:scale-100
                                group-hover:opacity-100

                                sm:h-12
                                sm:w-12
                              "
                            >
                              <Play className="h-4 w-4 translate-x-0.5 fill-white text-white sm:h-5 sm:w-5" />
                            </div>
                          </div>

                          <div
                            className="
                              pointer-events-none
                              absolute
                              inset-x-0
                              bottom-0
                              h-1/3
                              bg-gradient-to-t
                              from-black/60
                              to-transparent
                              opacity-0
                              transition-opacity
                              duration-300
                              group-hover:opacity-100
                            "
                          />
                        </div>

                        <h3
                          className="
                            gtv-series-title
                            mt-2
                            truncate
                            px-0.5
                            text-[9px]
                            font-semibold
                            text-white/70
                            transition-colors
                            group-hover:text-white

                            sm:mt-2.5
                            sm:px-1
                            sm:text-[11px]

                            lg:mt-3
                            lg:text-[13px]
                          "
                          title={
                            seriesName
                          }
                        >
                          {seriesName}
                        </h3>
                      </motion.div>
                    );
                  }
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* CATÉGORIES LANDSCAPE DROITE */}
        <aside
          className="
            gtv-series-landscape-categories
            hidden
          "
        >
          <div
            className="
              gtv-series-landscape-categories-inner
              h-full
              overflow-y-auto
              overscroll-contain
              scrollbar-none
            "
            style={{
              WebkitOverflowScrolling:
                "touch",
              touchAction:
                "pan-y",
            }}
          >
            {isLoadingCats ? (
              <div className="flex flex-col gap-2">
                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="
                        h-[44px]
                        w-full
                        shrink-0
                        animate-pulse
                        rounded-[12px]
                        border
                        border-white/5
                        bg-white/[0.03]
                      "
                    />
                  )
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(event) =>
                    selectCategory(
                      event,
                      "recent"
                    )
                  }
                  className={cn(
                    `
                    gtv-series-landscape-category-button
                    relative
                    flex
                    min-h-[42px]
                    w-full
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[12px]
                    border
                    px-2
                    py-2
                    text-center
                    text-[10px]
                    font-bold
                    uppercase
                    leading-[1.1]
                    tracking-[0.04em]
                    transition-all
                    duration-200
                    `,
                    activeCategory ===
                      "recent"
                      ? `
                        border-[#d8ccff]/55
                        bg-[#d8ccff]/12
                        text-white
                        shadow-[inset_0_0_18px_rgba(216,204,255,.10),0_6px_18px_rgba(170,145,255,.10)]
                      `
                      : `
                        border-white/[0.08]
                        bg-white/[0.035]
                        text-white/55
                        hover:border-white/15
                        hover:bg-white/[0.06]
                        hover:text-white
                      `
                  )}
                >
                  {activeCategory ===
                    "recent" && (
                    <span
                      className="
                        absolute
                        left-0
                        top-1/2
                        h-[55%]
                        w-[2px]
                        -translate-y-1/2
                        rounded-full
                        bg-[#d8ccff]
                        shadow-[0_0_10px_rgba(216,204,255,.65)]
                      "
                    />
                  )}

                  <span>
                    Récents
                  </span>
                </button>

                {categories
                  .filter(
                    (cat: any) =>
                      String(
                        cat.category_id
                      ) !== "0"
                  )
                  .map(
                    (cat: any) => {
                      const categoryId =
                        String(
                          cat.category_id
                        );

                      const isActive =
                        activeCategory ===
                        categoryId;

                      return (
                        <button
                          type="button"
                          key={
                            categoryId
                          }
                          onClick={(
                            event
                          ) =>
                            selectCategory(
                              event,
                              categoryId
                            )
                          }
                          className={cn(
                            `
                            gtv-series-landscape-category-button
                            relative
                            flex
                            min-h-[42px]
                            w-full
                            shrink-0
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[12px]
                            border
                            px-2
                            py-2
                            text-center
                            text-[10px]
                            font-bold
                            leading-[1.1]
                            tracking-[0.03em]
                            transition-all
                            duration-200
                            `,
                            isActive
                              ? `
                                border-[#d8ccff]/55
                                bg-[#d8ccff]/12
                                text-white
                                shadow-[inset_0_0_18px_rgba(216,204,255,.10),0_6px_18px_rgba(170,145,255,.10)]
                              `
                              : `
                                border-white/[0.08]
                                bg-white/[0.035]
                                text-white/55
                                hover:border-white/15
                                hover:bg-white/[0.06]
                                hover:text-white
                              `
                          )}
                        >
                          {isActive && (
                            <span
                              className="
                                absolute
                                left-0
                                top-1/2
                                h-[55%]
                                w-[2px]
                                -translate-y-1/2
                                rounded-full
                                bg-[#d8ccff]
                                shadow-[0_0_10px_rgba(216,204,255,.65)]
                              "
                            />
                          )}

                          <span>
                            {
                              cat.category_name
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* SUITE CSS DANS LA PARTIE SUIVANTE */}
      {/* LANDSCAPE MOBILE */}
      <style>{`
        @media (orientation: landscape) and (max-height: 600px) {
          .gtv-series-page {
            height: 100%;
            min-height: 0;
          }

          .gtv-series-standard-header,
          .gtv-series-standard-separator {
            display: none !important;
          }

          .gtv-series-content-shell {
            min-height: 0;
            flex: 1 1 auto;
            align-items: stretch;
          }

          .gtv-series-grid-scroll {
            min-width: 0 !important;
            height: 100% !important;

            padding:
              10px
              10px
              18px
              10px !important;

            overscroll-behavior:
              contain;
          }

          .gtv-series-grid {
            grid-template-columns:
              repeat(
                5,
                minmax(0, 1fr)
              ) !important;

            column-gap:
              8px !important;

            row-gap:
              10px !important;
          }

          .gtv-series-poster {
            border-radius:
              12px !important;
          }

          .gtv-series-title {
            margin-top:
              5px !important;

            padding-left:
              1px !important;

            padding-right:
              1px !important;

            font-size:
              9px !important;

            line-height:
              12px !important;
          }

          .gtv-series-landscape-categories {
            display:
              block !important;

            position:
              relative;

            z-index:
              30;

            width:
              118px;

            min-width:
              118px;

            max-width:
              118px;

            height:
              100%;

            min-height:
              0;

            flex:
              0 0 118px;

            border-left:
              1px solid
              rgba(
                255,
                255,
                255,
                0.07
              );

            background:
              linear-gradient(
                180deg,
                rgba(
                  16,
                  15,
                  22,
                  0.96
                ),
                rgba(
                  6,
                  6,
                  8,
                  0.985
                )
              );

            box-shadow:
              -12px 0 30px
              rgba(
                0,
                0,
                0,
                0.22
              );

            backdrop-filter:
              blur(18px);

            -webkit-backdrop-filter:
              blur(18px);
          }

          .gtv-series-landscape-categories-inner {
            padding:
              9px
              8px
              20px;
          }

          .gtv-series-landscape-category-button {
            min-height:
              42px !important;
          }
        }

        @media (orientation: landscape) and (max-height: 600px) and (min-width: 720px) {
          .gtv-series-grid {
            grid-template-columns:
              repeat(
                6,
                minmax(0, 1fr)
              ) !important;
          }

          .gtv-series-landscape-categories {
            width:
              124px;

            min-width:
              124px;

            max-width:
              124px;

            flex-basis:
              124px;
          }
        }

        @media (orientation: landscape) and (max-height: 600px) and (min-width: 900px) {
          .gtv-series-grid {
            grid-template-columns:
              repeat(
                7,
                minmax(0, 1fr)
              ) !important;
          }

          .gtv-series-grid-scroll {
            padding:
              12px
              12px
              20px
              12px !important;
          }

          .gtv-series-landscape-categories {
            width:
              128px;

            min-width:
              128px;

            max-width:
              128px;

            flex-basis:
              128px;
          }
        }

        .gtv-series-grid-scroll::-webkit-scrollbar,
        .gtv-series-landscape-categories-inner::-webkit-scrollbar {
          display: none;
        }

        .gtv-series-grid-scroll,
        .gtv-series-landscape-categories-inner {
          -ms-overflow-style:
            none;

          scrollbar-width:
            none;
        }

        input[type="search"] {
          -webkit-appearance:
            none;

          appearance:
            none;
        }

        input[type="search"]::-webkit-search-decoration,
        input[type="search"]::-webkit-search-cancel-button,
        input[type="search"]::-webkit-search-results-button,
        input[type="search"]::-webkit-search-results-decoration {
          -webkit-appearance:
            none;

          display:
            none;
        }
      `}</style>
    </div>
  );
}