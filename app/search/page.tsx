"use client";

import React, {
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  Clapperboard,
  Film,
  Loader2,
  Play,
  Search,
  Star,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";


/* =========================================================
   TYPES
   ========================================================= */

type SearchFilter =
  | "all"
  | "movies"
  | "series";


type MovieItem = {
  stream_id: number | string;
  name?: string;

  stream_icon?: string | null;
  cover?: string | null;
  poster?: string | null;

  rating?: string | number | null;

  releaseDate?: string | null;
  releasedate?: string | null;

  year?: string | number | null;
};


type SeriesItem = {
  series_id: number | string;
  name?: string;

  cover?: string | null;
  stream_icon?: string | null;
  poster?: string | null;

  backdrop_path?: string[] | null;

  rating?: string | number | null;

  releaseDate?: string | null;
  releasedate?: string | null;

  year?: string | number | null;
};


/* =========================================================
   CLEAN MEDIA NAME
   ========================================================= */

function cleanMediaName(
  rawName: string
) {
  if (!rawName) {
    return "";
  }

  return rawName
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*?\|/g, "")
    .replace(
      /[ⓋⒹⒶ-Ⓩⓐ-ⓩ║]/g,
      ""
    )
    .replace(
      /\b(4K|2160p|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFI|FR)\b/gi,
      ""
    )
    .replace(
      /\s*\(\d{4}\)/g,
      ""
    )
    .replace(
      /\s*\[\d{4}\]/g,
      ""
    )
    .replace(
      /[\/\\|_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   NORMALIZE SEARCH
   ========================================================= */

function normalizeSearch(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


/* =========================================================
   YEAR
   ========================================================= */

function getYear(
  item: {
    releaseDate?: string | null;
    releasedate?: string | null;
    year?: string | number | null;
    name?: string;
  }
) {
  if (
    item.year !== undefined &&
    item.year !== null &&
    String(item.year).trim()
  ) {
    return String(
      item.year
    );
  }

  const release =
    item.releaseDate ||
    item.releasedate;

  if (release) {
    const match =
      String(release).match(
        /\b(19|20)\d{2}\b/
      );

    if (match) {
      return match[0];
    }
  }

  const nameMatch =
    String(
      item.name || ""
    ).match(
      /\b(19|20)\d{2}\b/
    );

  return nameMatch?.[0] ??
    null;
}


/* =========================================================
   RATING
   ========================================================= */

function getRating(
  value:
    | string
    | number
    | null
    | undefined
) {
  const rating =
    Number(value);

  if (
    !Number.isFinite(
      rating
    ) ||
    rating <= 0
  ) {
    return null;
  }

  return rating.toFixed(
    rating % 1 === 0
      ? 0
      : 1
  );
}


/* =========================================================
   MEDIA CARD
   ========================================================= */

type MediaCardProps = {
  id: string | number;

  type:
    | "movie"
    | "series";

  title: string;

  image:
    | string
    | null;

  year:
    | string
    | null;

  rating:
    | string
    | null;

  onOpen: () => void;
};


function MediaCard({
  type,
  title,
  image,
  year,
  rating,
  onOpen,
}: MediaCardProps) {
  const [
    imageError,
    setImageError,
  ] =
    useState(false);


  const showImage =
    Boolean(image) &&
    !imageError;


  return (
    <motion.button
      type="button"

      initial={{
        opacity: 0,
        y: 10,
        scale: 0.98,
      }}

      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}

      transition={{
        duration: 0.2,
      }}

      onClick={onOpen}

      className="
        group
        min-w-0
        select-none
        text-left
        outline-none
      "
    >
      {/* POSTER */}

      <div
        className="
          relative
          aspect-[2/3]
          overflow-hidden

          rounded-[14px]

          border
          border-white/[0.08]

          bg-[#0d0d12]

          shadow-[0_8px_25px_rgba(0,0,0,.32)]

          transition-all
          duration-300

          group-hover:-translate-y-1
          group-hover:border-[#d8ccff]/30
          group-hover:shadow-[0_16px_45px_rgba(0,0,0,.55)]

          sm:rounded-[17px]

          lg:rounded-[20px]
        "
      >
        {showImage ? (
          <img
            src={
              image ||
              undefined
            }

            alt={title}

            loading="lazy"

            decoding="async"

            draggable={
              false
            }

            onError={() =>
              setImageError(
                true
              )
            }

            className="
              h-full
              w-full
              object-cover

              transition-transform
              duration-500
              ease-out

              group-hover:scale-[1.055]
            "
          />
        ) : (
          <div
            className="
              flex
              h-full
              w-full
              items-center
              justify-center

              bg-gradient-to-br
              from-white/[0.05]
              to-transparent
            "
          >
            {type ===
            "movie" ? (
              <Film
                className="
                  h-8
                  w-8
                  text-white/10

                  sm:h-9
                  sm:w-9

                  lg:h-10
                  lg:w-10
                "
              />
            ) : (
              <Clapperboard
                className="
                  h-8
                  w-8
                  text-white/10

                  sm:h-9
                  sm:w-9

                  lg:h-10
                  lg:w-10
                "
              />
            )}
          </div>
        )}


        {/* DARK GRADIENT */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0

            bg-gradient-to-t
            from-black/75
            via-transparent
            to-black/5
          "
        />


        {/* TYPE */}

        <span
          className="
            absolute
            left-1.5
            top-1.5

            rounded-full

            border
            border-white/10

            bg-black/60

            px-1.5
            py-0.5

            text-[6px]
            font-bold
            uppercase
            tracking-[0.08em]
            text-white/75

            backdrop-blur-xl

            sm:left-2
            sm:top-2
            sm:px-2
            sm:py-1
            sm:text-[8px]

            lg:left-2.5
            lg:top-2.5
            lg:text-[9px]
          "
        >
          {type ===
          "movie"
            ? "Film"
            : "Série"}
        </span>


        {/* RATING */}

        {rating && (
          <span
            className="
              absolute
              bottom-1.5
              right-1.5

              flex
              items-center
              gap-1

              rounded-full

              border
              border-white/10

              bg-black/70

              px-1.5
              py-0.5

              text-[7px]
              font-bold
              text-white

              backdrop-blur-xl

              sm:bottom-2
              sm:right-2
              sm:px-2
              sm:py-1
              sm:text-[9px]
            "
          >
            <Star
              className="
                h-2
                w-2
                fill-[#d8ccff]
                text-[#d8ccff]

                sm:h-2.5
                sm:w-2.5
              "
            />

            {rating}
          </span>
        )}


        {/* HOVER */}

        <div
          className="
            pointer-events-none

            absolute
            inset-0

            flex
            items-center
            justify-center

            bg-black/0

            transition-all
            duration-300

            group-hover:bg-black/35
          "
        >
          <div
            className="
              flex
              h-9
              w-9

              scale-75
              items-center
              justify-center

              rounded-full

              border
              border-white/30

              bg-white/15

              opacity-0

              shadow-2xl

              backdrop-blur-xl

              transition-all
              duration-300

              group-hover:scale-100
              group-hover:opacity-100

              sm:h-10
              sm:w-10

              lg:h-11
              lg:w-11
            "
          >
            <Play
              className="
                h-3.5
                w-3.5

                translate-x-[1px]

                fill-white
                text-white

                sm:h-4
                sm:w-4
              "
            />
          </div>
        </div>
      </div>


      {/* INFO */}

      <div
        className="
          px-0.5
          pt-2

          sm:px-1
          sm:pt-2.5
        "
      >
        <h3
          title={title}

          className="
            truncate

            text-[9px]
            font-semibold

            text-white/75

            transition-colors

            group-hover:text-white

            sm:text-[11px]

            lg:text-[13px]
          "
        >
          {title}
        </h3>


        <div
          className="
            mt-0.5

            flex
            items-center
            gap-1

            text-[7px]
            text-white/30

            sm:mt-1
            sm:gap-1.5
            sm:text-[9px]

            lg:text-[10px]
          "
        >
          <span>
            {type ===
            "movie"
              ? "Film"
              : "Série"}
          </span>


          {year && (
            <>
              <span>
                •
              </span>

              <span>
                {year}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}


/* =========================================================
   PAGE
   ========================================================= */

export default function SearchPage() {
  const router =
    useRouter();


  const inputRef =
    useRef<HTMLInputElement>(
      null
    );


  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");


  const [
    filter,
    setFilter,
  ] =
    useState<SearchFilter>(
      "all"
    );


  /* =======================================================
     SEARCH STATE
     ======================================================= */

  const normalizedQuery =
    normalizeSearch(
      searchQuery
    );


  const searchEnabled =
    normalizedQuery.length >=
    2;


  /* =======================================================
     MOVIES QUERY
     ======================================================= */

  const {
    data: movies = [],
    isLoading:
      moviesLoading,
    isError:
      moviesError,
  } =
    useQuery({
      queryKey: [
        "search",
        "movies",
      ],

      queryFn:
        async () => {
          const response =
            await fetch(
              "/api/xtream?action=get_vod_streams"
            );


          if (
            !response.ok
          ) {
            throw new Error(
              "Impossible de charger les films"
            );
          }


          const data =
            await response.json();


          return Array.isArray(
            data
          )
            ? data
            : [];
        },

      enabled:
        searchEnabled,

      staleTime:
        10 *
        60 *
        1000,

      retry: 0,
    });


  /* =======================================================
     SERIES QUERY
     ======================================================= */

  const {
    data: series = [],
    isLoading:
      seriesLoading,
    isError:
      seriesError,
  } =
    useQuery({
      queryKey: [
        "search",
        "series",
      ],

      queryFn:
        async () => {
          const response =
            await fetch(
              "/api/xtream?action=get_series"
            );


          if (
            !response.ok
          ) {
            throw new Error(
              "Impossible de charger les séries"
            );
          }


          const data =
            await response.json();


          return Array.isArray(
            data
          )
            ? data
            : [];
        },

      enabled:
        searchEnabled,

      staleTime:
        10 *
        60 *
        1000,

      retry: 0,
    });


  /* =======================================================
     MOVIE RESULTS
     ======================================================= */

  const movieResults =
    useMemo(() => {
      if (
        !searchEnabled ||
        filter ===
          "series"
      ) {
        return [];
      }


      return (
        movies as MovieItem[]
      )
        .filter(
          (movie) => {
            const title =
              cleanMediaName(
                movie.name ||
                  ""
              );


            return normalizeSearch(
              title
            ).includes(
              normalizedQuery
            );
          }
        )
        .slice(
          0,
          filter === "all"
            ? 24
            : 80
        );
    }, [
      movies,
      normalizedQuery,
      searchEnabled,
      filter,
    ]);


  /* =======================================================
     SERIES RESULTS
     ======================================================= */

  const seriesResults =
    useMemo(() => {
      if (
        !searchEnabled ||
        filter ===
          "movies"
      ) {
        return [];
      }


      return (
        series as SeriesItem[]
      )
        .filter(
          (item) => {
            const title =
              cleanMediaName(
                item.name ||
                  ""
              );


            return normalizeSearch(
              title
            ).includes(
              normalizedQuery
            );
          }
        )
        .slice(
          0,
          filter === "all"
            ? 24
            : 80
        );
    }, [
      series,
      normalizedQuery,
      searchEnabled,
      filter,
    ]);


  /* =======================================================
     UI STATE
     ======================================================= */

  const loading =
    searchEnabled &&
    (
      moviesLoading ||
      seriesLoading
    );


  const hasError =
    moviesError &&
    seriesError;


  const totalResults =
    movieResults.length +
    seriesResults.length;


  /* =======================================================
     ACTIONS
     ======================================================= */

  const clearSearch =
    () => {
      setSearchQuery("");

      inputRef.current
        ?.focus();
    };


  const openMovie = (
    id: string | number
  ) => {
    router.push(
      `/movies/${id}`
    );
  };


  const openSeries = (
    id: string | number
  ) => {
    router.push(
      `/series/${id}`
    );
  };


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        relative

        flex
        h-[100dvh]
        min-h-0
        w-full
        flex-col

        overflow-hidden

        bg-[#060608]

        text-white
      "
    >
      {/* =================================================
          BACKGROUND
          ================================================= */}

      <div
        className="
          pointer-events-none

          absolute
          inset-0
          z-0

          overflow-hidden
        "
      >
        <div
          className="
            absolute
            inset-x-0
            top-0

            h-[42vh]

            bg-gradient-to-b
            from-[#d8ccff]/[0.035]
            to-transparent

            blur-3xl
          "
        />


        <div
          className="
            absolute

            left-1/2
            top-[-220px]

            h-[480px]
            w-[800px]

            -translate-x-1/2

            rounded-full

            bg-[#8d70ff]/[0.035]

            blur-[120px]
          "
        />
      </div>


      {/* =================================================
          HEADER
          ================================================= */}

      <header
        className="
          relative
          z-10
          shrink-0

          px-4
          pb-3
          pt-5

          sm:px-6
          sm:pb-4
          sm:pt-7

          lg:px-8
          lg:pb-5
          lg:pt-9

          landscape:px-4
          landscape:pb-2
          landscape:pt-2.5

          sm:landscape:px-5
          sm:landscape:pt-3

          lg:landscape:px-7
          lg:landscape:pt-4
        "
      >
        <div
          className="
            mx-auto
            max-w-[1500px]
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4

              landscape:flex-row
              landscape:items-center
              landscape:justify-between
              landscape:gap-5

              lg:gap-8
            "
          >
            {/* =========================================
                TITLE
                ========================================= */}

            <div
              className="
                min-w-0

                landscape:w-[30%]
                landscape:max-w-[270px]
                landscape:shrink-0

                lg:landscape:w-[32%]
                lg:landscape:max-w-[360px]
              "
            >
              <p
                className="
                  mb-1

                  text-[8px]
                  font-bold
                  uppercase
                  tracking-[0.26em]

                  text-[#d8ccff]/70

                  sm:mb-2
                  sm:text-[9px]

                  landscape:mb-0.5
                  landscape:text-[6px]

                  sm:landscape:text-[7px]

                  lg:landscape:text-[8px]
                "
              >
                GTV
              </p>


              <h1
                className="
                  text-2xl
                  font-extrabold
                  tracking-[-0.035em]

                  sm:text-3xl

                  lg:text-4xl

                  landscape:text-lg

                  sm:landscape:text-xl

                  lg:landscape:text-2xl
                "
              >
                Recherche
              </h1>


              <p
                className="
                  mt-1

                  text-[10px]
                  text-white/40

                  sm:mt-2
                  sm:text-xs

                  lg:text-sm

                  landscape:mt-0.5
                  landscape:truncate
                  landscape:text-[7px]

                  sm:landscape:text-[8px]

                  lg:landscape:text-[9px]
                "
              >
                Films et séries en
                un seul endroit.
              </p>
            </div>


            {/* =========================================
                SEARCH AREA
                ========================================= */}

            <div
              className="
                w-full
                min-w-0

                landscape:flex-1

                lg:max-w-[650px]
              "
            >
              {/* SEARCH BAR */}

              <div
                className="
                  group
                  relative

                  flex
                  h-11
                  items-center

                  rounded-full

                  border
                  border-white/10

                  bg-white/[0.045]

                  shadow-[0_12px_35px_rgba(0,0,0,.28)]

                  backdrop-blur-2xl

                  transition-all

                  focus-within:border-[#d8ccff]/40
                  focus-within:bg-white/[0.07]
                  focus-within:shadow-[0_12px_40px_rgba(170,145,255,.08)]

                  sm:h-12

                  landscape:h-8

                  sm:landscape:h-9

                  lg:landscape:h-10
                "
              >
                <Search
                  className="
                    ml-3.5

                    h-4
                    w-4

                    shrink-0

                    text-white/35

                    transition-colors

                    group-focus-within:text-[#d8ccff]

                    landscape:ml-3
                    landscape:h-3
                    landscape:w-3

                    sm:landscape:h-3.5
                    sm:landscape:w-3.5

                    lg:landscape:h-4
                    lg:landscape:w-4
                  "
                />


<input
  ref={inputRef}
  type="search"
  value={searchQuery}
  onChange={(event) =>
    setSearchQuery(event.target.value)
  }
  placeholder="Rechercher un film ou une série..."
  autoComplete="off"
  spellCheck={false}
  autoFocus
  className="
    h-full
    min-w-0
    flex-1

    appearance-none
    border-0
    bg-transparent
    shadow-none
    ring-0
    outline-none

    px-3

    text-xs
    font-medium
    text-white

    placeholder:text-white/30

    focus:border-0
    focus:ring-0
    focus:outline-none
    focus-visible:ring-0
    focus-visible:outline-none

    sm:text-sm

    landscape:text-[9px]
    sm:landscape:text-[10px]
    lg:landscape:text-xs
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

                      onClick={
                        clearSearch
                      }

                      aria-label="Effacer la recherche"

                      className="
                        mr-1.5

                        flex
                        h-7
                        w-7

                        shrink-0

                        items-center
                        justify-center

                        rounded-full

                        text-white/40

                        transition-colors

                        hover:bg-white/10
                        hover:text-white

                        landscape:h-6
                        landscape:w-6

                        sm:landscape:h-7
                        sm:landscape:w-7
                      "
                    >
                      <X
                        className="
                          h-3.5
                          w-3.5

                          landscape:h-3
                          landscape:w-3

                          sm:landscape:h-3.5
                          sm:landscape:w-3.5
                        "
                      />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>


              {/* FILTERS */}

              <div
                className="
                  mt-2.5

                  flex
                  items-center
                  gap-1.5

                  landscape:mt-1.5
                  landscape:gap-1
                "
              >
                {(
                  [
                    [
                      "all",
                      "Tout",
                    ],
                    [
                      "movies",
                      "Films",
                    ],
                    [
                      "series",
                      "Séries",
                    ],
                  ] as const
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <button
                      key={
                        value
                      }

                      type="button"

                      onClick={() =>
                        setFilter(
                          value
                        )
                      }

                      className={`
                        rounded-full

                        border

                        px-3
                        py-1.5

                        text-[9px]
                        font-bold

                        transition-all

                        sm:px-3.5
                        sm:text-[10px]

                        landscape:px-2.5
                        landscape:py-0.5
                        landscape:text-[7px]

                        sm:landscape:px-3
                        sm:landscape:py-1
                        sm:landscape:text-[8px]

                        ${
                          filter ===
                          value
                            ? `
                              border-[#d8ccff]/35
                              bg-[#d8ccff]/10
                              text-[#e7e0ff]

                              shadow-[0_5px_20px_rgba(170,145,255,.08)]
                            `
                            : `
                              border-white/[0.07]
                              bg-white/[0.025]
                              text-white/40

                              hover:border-white/15
                              hover:bg-white/[0.05]
                              hover:text-white/70
                            `
                        }
                      `}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* =================================================
          SEPARATOR
          ================================================= */}

      <div
        className="
          relative
          z-10

          h-px
          w-full
          shrink-0

          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
        "
      />


      {/* =================================================
          CONTENT / SCROLL
          ================================================= */}

      <div
        className="
          relative
          z-10

          min-h-0
          flex-1

          overflow-y-auto
          overscroll-contain

          px-4
          pb-28
          pt-5

          scrollbar-none

          sm:px-6
          sm:pb-32
          sm:pt-6

          lg:px-8
          lg:pt-8

          landscape:px-4
          landscape:pb-16
          landscape:pt-2.5

          sm:landscape:px-5
          sm:landscape:pt-3

          lg:landscape:px-7
        "
      >
        <div
          className="
            mx-auto
            max-w-[1500px]
          "
        >
          {/* ===========================================
              INITIAL STATE
              =========================================== */}

          {!searchEnabled && (
            <div
              className="
                flex
                min-h-[48vh]

                flex-col

                items-center
                justify-center

                text-center

                landscape:min-h-[36vh]
              "
            >
              <div
                className="
                  relative

                  flex
                  h-16
                  w-16

                  items-center
                  justify-center

                  rounded-[20px]

                  border
                  border-white/[0.07]

                  bg-white/[0.035]

                  shadow-[0_16px_50px_rgba(0,0,0,.35)]

                  backdrop-blur-xl

                  sm:h-20
                  sm:w-20
                  sm:rounded-[26px]

                  landscape:h-11
                  landscape:w-11
                  landscape:rounded-[14px]

                  sm:landscape:h-12
                  sm:landscape:w-12
                "
              >
                <div
                  className="
                    absolute
                    inset-0

                    rounded-[inherit]

                    bg-gradient-to-br
                    from-[#d8ccff]/10
                    to-transparent
                  "
                />

                <Search
                  className="
                    relative

                    h-6
                    w-6

                    text-[#d8ccff]/70

                    sm:h-8
                    sm:w-8

                    landscape:h-4
                    landscape:w-4

                    sm:landscape:h-5
                    sm:landscape:w-5
                  "
                />
              </div>


              <h2
                className="
                  mt-4

                  text-base
                  font-bold
                  tracking-tight

                  sm:mt-6
                  sm:text-xl

                  landscape:mt-2
                  landscape:text-xs

                  sm:landscape:text-sm
                "
              >
                Films & Séries
              </h2>


              <p
                className="
                  mt-1.5

                  max-w-md

                  text-[10px]
                  leading-5

                  text-white/35

                  sm:mt-2
                  sm:text-sm
                  sm:leading-6

                  landscape:mt-1
                  landscape:text-[7px]
                  landscape:leading-3

                  sm:landscape:text-[8px]
                "
              >
                Saisissez au moins
                deux caractères pour
                lancer la recherche.
              </p>
            </div>
          )}


          {/* ===========================================
              LOADING
              =========================================== */}

          {searchEnabled &&
            loading && (
              <div
                className="
                  flex
                  min-h-[45vh]

                  flex-col

                  items-center
                  justify-center

                  landscape:min-h-[35vh]
                "
              >
                <Loader2
                  className="
                    h-7
                    w-7

                    animate-spin

                    text-[#d8ccff]

                    landscape:h-5
                    landscape:w-5
                  "
                />

                <p
                  className="
                    mt-3

                    text-[10px]
                    text-white/40

                    sm:text-xs

                    landscape:mt-2
                    landscape:text-[7px]
                  "
                >
                  Recherche dans
                  votre catalogue…
                </p>
              </div>
            )}


          {/* ===========================================
              ERROR
              =========================================== */}

          {searchEnabled &&
            !loading &&
            hasError && (
              <div
                className="
                  flex
                  min-h-[45vh]

                  flex-col

                  items-center
                  justify-center

                  text-center

                  landscape:min-h-[35vh]
                "
              >
                <Search
                  className="
                    h-8
                    w-8
                    text-white/20

                    landscape:h-5
                    landscape:w-5
                  "
                />

                <h2
                  className="
                    mt-4
                    font-bold

                    landscape:mt-2
                    landscape:text-xs
                  "
                >
                  Recherche
                  indisponible
                </h2>

                <p
                  className="
                    mt-2

                    max-w-sm

                    text-xs
                    leading-5

                    text-white/35

                    landscape:mt-1
                    landscape:text-[7px]
                    landscape:leading-3
                  "
                >
                  Impossible de
                  récupérer les
                  catalogues Films
                  et Séries.
                </p>
              </div>
            )}


          {/* ===========================================
              RESULTS
              =========================================== */}

          {searchEnabled &&
            !loading &&
            !hasError && (
              <>
                {/* =====================================
                    RESULT HEADER
                    ===================================== */}

                <div
                  className="
                    mb-6

                    flex
                    items-end
                    justify-between
                    gap-4

                    landscape:mb-3
                  "
                >
                  <div
                    className="
                      min-w-0
                    "
                  >
                    <p
                      className="
                        text-[8px]
                        font-bold
                        uppercase
                        tracking-[0.18em]

                        text-white/30

                        landscape:text-[6px]
                      "
                    >
                      Résultats
                    </p>

                    <h2
                      className="
                        mt-1
                        truncate

                        text-base
                        font-bold
                        tracking-tight

                        sm:text-lg

                        landscape:mt-0.5
                        landscape:text-[11px]

                        sm:landscape:text-xs
                      "
                    >
                      “
                      {
                        searchQuery.trim()
                      }
                      ”
                    </h2>
                  </div>


                  <span
                    className="
                      shrink-0

                      text-[9px]
                      text-white/30

                      sm:text-[10px]

                      landscape:text-[6px]

                      sm:landscape:text-[7px]
                    "
                  >
                    {
                      totalResults
                    }{" "}
                    résultat
                    {totalResults !==
                    1
                      ? "s"
                      : ""}
                  </span>
                </div>


                {/* =====================================
                    MOVIES
                    ===================================== */}

                {movieResults.length >
                  0 && (
                    <section>
                      <div
                        className="
                          mb-3

                          flex
                          items-center
                          gap-2

                          sm:mb-4
                          sm:gap-2.5

                          landscape:mb-2
                        "
                      >
                        <div
                          className="
                            flex
                            h-6
                            w-6

                            items-center
                            justify-center

                            rounded-full

                            border
                            border-white/[0.07]

                            bg-white/[0.04]

                            sm:h-7
                            sm:w-7

                            landscape:h-5
                            landscape:w-5
                          "
                        >
                          <Film
                            className="
                              h-3
                              w-3

                              text-[#d8ccff]

                              sm:h-3.5
                              sm:w-3.5

                              landscape:h-2.5
                              landscape:w-2.5
                            "
                          />
                        </div>

                        <h2
                          className="
                            text-xs
                            font-bold

                            sm:text-sm

                            landscape:text-[9px]
                          "
                        >
                          Films
                        </h2>

                        <span
                          className="
                            text-[8px]
                            text-white/30

                            sm:text-[10px]

                            landscape:text-[6px]
                          "
                        >
                          {
                            movieResults.length
                          }
                        </span>
                      </div>


                      <div
                        className="
                          grid

                          grid-cols-3

                          gap-x-3
                          gap-y-5

                          sm:grid-cols-4
                          sm:gap-x-4
                          sm:gap-y-7

                          md:grid-cols-5

                          lg:grid-cols-6

                          xl:grid-cols-7

                          2xl:grid-cols-8

                          landscape:grid-cols-5
                          landscape:gap-x-3
                          landscape:gap-y-3

                          sm:landscape:grid-cols-6

                          md:landscape:grid-cols-7

                          lg:landscape:grid-cols-8

                          xl:landscape:grid-cols-9
                        "
                      >
                        {movieResults.map(
                          (
                            movie
                          ) => {
                            const title =
                              cleanMediaName(
                                movie.name ||
                                  ""
                              ) ||
                              movie.name ||
                              "Film";


                            const image =
                              movie.stream_icon ||
                              movie.cover ||
                              movie.poster ||
                              null;


                            return (
                              <MediaCard
                                key={
                                  `movie-${movie.stream_id}`
                                }

                                id={
                                  movie.stream_id
                                }

                                type="movie"

                                title={
                                  title
                                }

                                image={
                                  image
                                }

                                year={
                                  getYear(
                                    movie
                                  )
                                }

                                rating={
                                  getRating(
                                    movie.rating
                                  )
                                }

                                onOpen={() =>
                                  openMovie(
                                    movie.stream_id
                                  )
                                }
                              />
                            );
                          }
                        )}
                      </div>
                    </section>
                  )}


                {/* =====================================
                    SERIES
                    ===================================== */}

                {seriesResults.length >
                  0 && (
                    <section
                      className={
                        movieResults.length >
                        0
                          ? `
                            mt-10

                            landscape:mt-6
                          `
                          : ""
                      }
                    >
                      <div
                        className="
                          mb-3

                          flex
                          items-center
                          gap-2

                          sm:mb-4
                          sm:gap-2.5

                          landscape:mb-2
                        "
                      >
                        <div
                          className="
                            flex
                            h-6
                            w-6

                            items-center
                            justify-center

                            rounded-full

                            border
                            border-white/[0.07]

                            bg-white/[0.04]

                            sm:h-7
                            sm:w-7

                            landscape:h-5
                            landscape:w-5
                          "
                        >
                          <Clapperboard
                            className="
                              h-3
                              w-3

                              text-[#d8ccff]

                              sm:h-3.5
                              sm:w-3.5

                              landscape:h-2.5
                              landscape:w-2.5
                            "
                          />
                        </div>

                        <h2
                          className="
                            text-xs
                            font-bold

                            sm:text-sm

                            landscape:text-[9px]
                          "
                        >
                          Séries
                        </h2>

                        <span
                          className="
                            text-[8px]
                            text-white/30

                            sm:text-[10px]

                            landscape:text-[6px]
                          "
                        >
                          {
                            seriesResults.length
                          }
                        </span>
                      </div>


                      <div
                        className="
                          grid

                          grid-cols-3

                          gap-x-3
                          gap-y-5

                          sm:grid-cols-4
                          sm:gap-x-4
                          sm:gap-y-7

                          md:grid-cols-5

                          lg:grid-cols-6

                          xl:grid-cols-7

                          2xl:grid-cols-8

                          landscape:grid-cols-5
                          landscape:gap-x-3
                          landscape:gap-y-3

                          sm:landscape:grid-cols-6

                          md:landscape:grid-cols-7

                          lg:landscape:grid-cols-8

                          xl:landscape:grid-cols-9
                        "
                      >
                        {seriesResults.map(
                          (
                            item
                          ) => {
                            const title =
                              cleanMediaName(
                                item.name ||
                                  ""
                              ) ||
                              item.name ||
                              "Série";


                            const image =
                              item.cover ||
                              item.stream_icon ||
                              item.poster ||
                              item
                                .backdrop_path?.[
                                0
                              ] ||
                              null;


                            return (
                              <MediaCard
                                key={
                                  `series-${item.series_id}`
                                }

                                id={
                                  item.series_id
                                }

                                type="series"

                                title={
                                  title
                                }

                                image={
                                  image
                                }

                                year={
                                  getYear(
                                    item
                                  )
                                }

                                rating={
                                  getRating(
                                    item.rating
                                  )
                                }

                                onOpen={() =>
                                  openSeries(
                                    item.series_id
                                  )
                                }
                              />
                            );
                          }
                        )}
                      </div>
                    </section>
                  )}


                {/* =====================================
                    EMPTY
                    ===================================== */}

                {totalResults ===
                  0 && (
                    <div
                      className="
                        flex
                        min-h-[40vh]

                        flex-col

                        items-center
                        justify-center

                        text-center

                        landscape:min-h-[30vh]
                      "
                    >
                      <div
                        className="
                          flex
                          h-14
                          w-14

                          items-center
                          justify-center

                          rounded-[18px]

                          border
                          border-white/[0.07]

                          bg-white/[0.03]

                          landscape:h-10
                          landscape:w-10
                          landscape:rounded-[12px]
                        "
                      >
                        <Search
                          className="
                            h-5
                            w-5

                            text-white/20

                            landscape:h-4
                            landscape:w-4
                          "
                        />
                      </div>


                      <h3
                        className="
                          mt-4

                          text-sm
                          font-bold

                          landscape:mt-2
                          landscape:text-[10px]
                        "
                      >
                        Aucun résultat
                      </h3>


                      <p
                        className="
                          mt-1.5

                          max-w-sm

                          text-[10px]
                          leading-5

                          text-white/35

                          sm:text-xs

                          landscape:mt-1
                          landscape:text-[7px]
                          landscape:leading-3
                        "
                      >
                        Aucun film ou
                        série ne
                        correspond à
                        “
                        {
                          searchQuery.trim()
                        }
                        ”.
                      </p>
                    </div>
                  )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}