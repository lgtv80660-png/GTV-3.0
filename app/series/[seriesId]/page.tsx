"use client";

import dynamic from "next/dynamic";

import React, {
  useCallback,
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
  Film,
  Heart,
  Play,
  Star,
  User,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import { SmartImage } from "@/components/ui/SmartImage";
import { Skeleton } from "@/components/ui/Skeleton";

import { useSeriesInfo } from "@/lib/hooks";
import { useLibrary } from "@/store/library";

import {
  cleanName,
  cn,
  ratingNum,
  yearFrom,
} from "@/lib/utils";

import type { Episode } from "@/lib/xtream/types";

const VideoPlayer = dynamic(
  () =>
    import(
      "@/components/player/VideoPlayer"
    ).then(
      (mod) =>
        mod.VideoPlayer
    ),
  {
    ssr: false,
  }
);

/* =========================================================
   TYPES
========================================================= */

type ScreenMode =
  | "desktop"
  | "portrait"
  | "landscape";

type SeasonArtwork = {
  poster: string | null;
  name: string;
  episodeCount?: number;
};

type FanartData = {
  logo?: string | null;
  backdrop?: string | null;
  poster?: string | null;

  seasons?: Record<
    string,
    SeasonArtwork
  >;
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
};

type ProducerData = {
  id?: number;
  name: string;
  job?: string;
  department?: string;
};

type ProductionDetails = {
  studio?: string | null;
  studioLogo?: string | null;
  companies?: ProductionCompany[];
  producers?: ProducerData[];
  overview?: string | null;
};

/* =========================================================
   ANIMATIONS
========================================================= */

const smoothTransition = {
  duration: 0.34,

  ease: [
    0.16,
    1,
    0.3,
    1,
  ] as [
    number,
    number,
    number,
    number,
  ],
};

const appleTransition = {
  duration: 0.18,

  ease: [
    0.22,
    1,
    0.36,
    1,
  ] as [
    number,
    number,
    number,
    number,
  ],
};

/* =========================================================
   PERSON CACHE
========================================================= */

const personCache =
  new Map<
    string,
    ActorMiniData
  >();

const personPending =
  new Map<
    string,
    Promise<ActorMiniData>
  >();

/* =========================================================
   EPISODE IMAGE CACHE
========================================================= */

const episodeImageCache =
  new Map<
    string,
    string | null
  >();

const episodeImagePending =
  new Map<
    string,
    Promise<string | null>
  >();

/* =========================================================
   GENERIC HELPERS
========================================================= */

function safeImage(
  value?: string | null
): string | undefined {
  if (
    !value ||
    typeof value !==
      "string"
  ) {
    return undefined;
  }

  const clean =
    value.trim();

  if (
    !clean ||
    clean === "null" ||
    clean ===
      "undefined"
  ) {
    return undefined;
  }

  if (
    clean.startsWith("/")
  ) {
    return `https://image.tmdb.org/t/p/original${clean}`;
  }

  return clean;
}

function durationToSeconds(
  value: unknown
) {
  if (
    value == null
  ) {
    return 0;
  }

  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value
    )
      ? Math.max(
          0,
          value
        )
      : 0;
  }

  const text =
    String(
      value
    ).trim();

  if (!text) {
    return 0;
  }

  if (
    /^\d+(\.\d+)?$/.test(
      text
    )
  ) {
    const number =
      Number(text);

    return Number.isFinite(
      number
    )
      ? number
      : 0;
  }

  const parts =
    text
      .split(":")
      .map(Number);

  if (
    parts.length === 3 &&
    parts.every(
      Number.isFinite
    )
  ) {
    return (
      parts[0] *
        3600 +
      parts[1] *
        60 +
      parts[2]
    );
  }

  if (
    parts.length === 2 &&
    parts.every(
      Number.isFinite
    )
  ) {
    return (
      parts[0] *
        60 +
      parts[1]
    );
  }

  return 0;
}

/* =========================================================
   SCREEN MODE
   EXACT LOGIC FROM MOVIES
========================================================= */

function useScreenMode(
  fullscreen: boolean
) {
  const [
    mode,
    setMode,
  ] =
    useState<
      ScreenMode | null
    >(null);

  useEffect(() => {
    const desktop =
      window.matchMedia(
        "(min-width: 1180px)"
      );

    const portrait =
      window.matchMedia(
        "(orientation: portrait)"
      );

    const update =
      () => {
        /*
         * IMPORTANT :
         * on ne change pas
         * le layout pendant
         * le fullscreen player.
         */
        if (
          fullscreen ||
          document.fullscreenElement
        ) {
          return;
        }

        if (
          desktop.matches
        ) {
          setMode(
            "desktop"
          );

          return;
        }

        setMode(
          portrait.matches
            ? "portrait"
            : "landscape"
        );
      };

    update();

    document.addEventListener(
      "fullscreenchange",
      update
    );

    desktop.addEventListener(
      "change",
      update
    );

    portrait.addEventListener(
      "change",
      update
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        update
      );

      desktop.removeEventListener(
        "change",
        update
      );

      portrait.removeEventListener(
        "change",
        update
      );
    };
  }, [
    fullscreen,
  ]);

  return mode;
}

/* =========================================================
   APPLE / SAFARI LITE
   MOVIES
========================================================= */

function useAppleSafariLiteMode() {
  const [
    liteMode,
    setLiteMode,
  ] =
    useState(false);

  useEffect(() => {
    const ua =
      navigator.userAgent;

    const platform =
      navigator.platform;

    const isIOS =
      /iPhone|iPad|iPod/i.test(
        ua
      ) ||
      (
        platform ===
          "MacIntel" &&
        navigator.maxTouchPoints >
          1
      );

    const isSafari =
      /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
        ua
      );

    setLiteMode(
      isIOS ||
        isSafari
    );
  }, []);

  return liteMode;
}

/* =========================================================
   PERSON LOADER
========================================================= */

async function loadPerson(
  name: string
): Promise<ActorMiniData> {
  const cleanPersonName =
    name.trim();

  const cached =
    personCache.get(
      cleanPersonName
    );

  if (cached) {
    return cached;
  }

  const pending =
    personPending.get(
      cleanPersonName
    );

  if (pending) {
    return pending;
  }

  const request =
    fetch(
      `/api/actor-photo?name=${encodeURIComponent(
        cleanPersonName
      )}`
    )
      .then(
        async (
          response
        ) => {
          const json =
            await response
              .json()
              .catch(
                () =>
                  ({})
              );

          const result:
            ActorMiniData =
            {
              name:
                cleanPersonName,

              photoUrl:
                safeImage(
                  json?.photoUrl
                ) ||
                null,

              bio:
                String(
                  json?.bio ||
                    json?.biography ||
                    ""
                ),
            };

          personCache.set(
            cleanPersonName,
            result
          );

          return result;
        }
      )
      .catch(
        () => {
          const result:
            ActorMiniData =
            {
              name:
                cleanPersonName,

              photoUrl:
                null,

              bio:
                "",
            };

          personCache.set(
            cleanPersonName,
            result
          );

          return result;
        }
      )
      .finally(
        () => {
          personPending.delete(
            cleanPersonName
          );
        }
      );

  personPending.set(
    cleanPersonName,
    request
  );

  return request;
}

/* =========================================================
   SERIES TITLE LOGO
========================================================= */

function useTitleLogo(
  tmdbId?:
    | string
    | number,
  title?: string
) {
  const [
    logoUrl,
    setLogoUrl,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    if (
      !tmdbId &&
      !title
    ) {
      return;
    }

    let mounted =
      true;

    const query =
      new URLSearchParams();

    if (
      tmdbId &&
      String(
        tmdbId
      ) !== "0"
    ) {
      query.append(
        "tmdbId",
        String(
          tmdbId
        )
      );
    }

    if (title) {
      query.append(
        "title",
        title
      );
    }

    query.append(
      "type",
      "tv"
    );

    fetch(
      `/api/title-logo?${query.toString()}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (
          data
        ) => {
          if (
            mounted &&
            data?.logoUrl
          ) {
            setLogoUrl(
              data.logoUrl
            );
          }
        }
      )
      .catch(
        () => {}
      );

    return () => {
      mounted =
        false;
    };
  }, [
    tmdbId,
    title,
  ]);

  return logoUrl;
}

/* =========================================================
   SERIES FANART
========================================================= */

function useFanartSeries(
  tmdbId?:
    | string
    | number
) {
  const [
    data,
    setData,
  ] =
    useState<FanartData>(
      {}
    );

  useEffect(() => {
    if (
      !tmdbId ||
      String(
        tmdbId
      ) === "0"
    ) {
      return;
    }

    let mounted =
      true;

    fetch(
      `/api/fanart/series?tmdbId=${encodeURIComponent(
        String(
          tmdbId
        )
      )}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (
          json
        ) => {
          if (
            mounted
          ) {
            setData(
              json ||
                {}
            );
          }
        }
      )
      .catch(
        () => {}
      );

    return () => {
      mounted =
        false;
    };
  }, [
    tmdbId,
  ]);

  return data;
}

/* =========================================================
   PRODUCTION DETAILS
========================================================= */

function useProductionDetails(
  tmdbId?:
    | string
    | number,
  title?: string
) {
  const [
    details,
    setDetails,
  ] =
    useState<
      ProductionDetails | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    if (
      (
        !tmdbId ||
        String(
          tmdbId
        ) === "0"
      ) &&
      !title
    ) {
      setLoading(
        false
      );

      return;
    }

    let mounted =
      true;

    setLoading(
      true
    );

    const query =
      new URLSearchParams();

    if (
      tmdbId &&
      String(
        tmdbId
      ) !== "0"
    ) {
      query.append(
        "tmdbId",
        String(
          tmdbId
        )
      );
    }

    if (title) {
      query.append(
        "title",
        title
      );
    }

    query.append(
      "type",
      "tv"
    );

    fetch(
      `/api/tmdb/movie-production?${query.toString()}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (
          data
        ) => {
          if (
            mounted &&
            !data?.error
          ) {
            setDetails({
              studio:
                data.studio ||
                null,

              studioLogo:
                data.studioLogo ||
                null,

              companies:
                data.companies ||
                [],

              producers:
                data.producers ||
                [],

              overview:
                data.overview ||
                null,
            });
          }
        }
      )
      .catch(
        () => {}
      )
      .finally(
        () => {
          if (
            mounted
          ) {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      mounted =
        false;
    };
  }, [
    tmdbId,
    title,
  ]);

  return {
    details,
    loading,
  };
}

/* =========================================================
   EPISODE ARTWORK
========================================================= */

function makeEpisodeImageKey({
  tmdbId,
  seriesTitle,
  season,
  episode,
}: {
  tmdbId?:
    | string
    | number;

  seriesTitle:
    string;

  season:
    string;

  episode:
    | string
    | number;
}) {
  return [
    tmdbId ||
      "",
    seriesTitle,
    season,
    episode,
  ].join(
    "::"
  );
}

async function loadEpisodeImage({
  tmdbId,
  seriesTitle,
  season,
  episode,
}: {
  tmdbId?:
    | string
    | number;

  seriesTitle:
    string;

  season:
    string;

  episode:
    | string
    | number;
}) {
  const key =
    makeEpisodeImageKey({
      tmdbId,
      seriesTitle,
      season,
      episode,
    });

  if (
    episodeImageCache.has(
      key
    )
  ) {
    return (
      episodeImageCache.get(
        key
      ) ||
      null
    );
  }

  const pending =
    episodeImagePending.get(
      key
    );

  if (pending) {
    return pending;
  }

  const request =
    fetch(
      `/api/episode-image?tmdbId=${encodeURIComponent(
        String(
          tmdbId ||
            ""
        )
      )}&show=${encodeURIComponent(
        seriesTitle
      )}&season=${encodeURIComponent(
        season
      )}&episode=${encodeURIComponent(
        String(
          episode
        )
      )}`
    )
      .then(
        async (
          response
        ) => {
          const json =
            await response
              .json()
              .catch(
                () =>
                  ({})
              );

          const imageUrl =
            typeof json?.imageUrl ===
              "string" &&
            json.imageUrl.trim()
              ? json.imageUrl
              : null;

          episodeImageCache.set(
            key,
            imageUrl
          );

          return imageUrl;
        }
      )
      .catch(
        () => {
          episodeImageCache.set(
            key,
            null
          );

          return null;
        }
      )
      .finally(
        () => {
          episodeImagePending.delete(
            key
          );
        }
      );

  episodeImagePending.set(
    key,
    request
  );

  return request;
}

/* =========================================================
   EPISODE IMAGE
   REAL SERIES SIGNATURE
========================================================= */

function EpisodeImage({
  ep,
  seriesTitle,
  tmdbId,
  seasonKey,
  fallbackCover,
}: {
  ep: any;

  seriesTitle:
    string;

  tmdbId?:
    | string
    | number;

  seasonKey:
    string;

  fallbackCover?:
    | string;
}) {
  const directImage =
    ep.info
      ?.movie_image ||
    null;

  const season =
    seasonKey.replace(
      /\D/g,
      ""
    ) ||
    "1";

  const episodeNumber =
    ep.episode_num ||
    ep.episode ||
    "";

  const cacheKey =
    makeEpisodeImageKey({
      tmdbId,
      seriesTitle,
      season,
      episode:
        episodeNumber,
    });

  const [
    imgSrc,
    setImgSrc,
  ] =
    useState<
      string | null
    >(
      directImage ||
        episodeImageCache.get(
          cacheKey
        ) ||
        null
    );

  useEffect(() => {
    if (
      directImage
    ) {
      setImgSrc(
        directImage
      );

      return;
    }

    const cached =
      episodeImageCache.get(
        cacheKey
      );

    if (cached) {
      setImgSrc(
        cached
      );

      return;
    }

    let mounted =
      true;

    loadEpisodeImage({
      tmdbId,
      seriesTitle,
      season,
      episode:
        episodeNumber,
    }).then(
      (
        imageUrl
      ) => {
        if (
          mounted &&
          imageUrl
        ) {
          setImgSrc(
            imageUrl
          );
        }
      }
    );

    return () => {
      mounted =
        false;
    };
  }, [
    cacheKey,
    directImage,
    episodeNumber,
    season,
    seriesTitle,
    tmdbId,
  ]);

  return (
    <SmartImage
      src={
        imgSrc ||
        fallbackCover
      }
      alt={
        ep.title ||
        "Épisode"
      }
      rounded="rounded-none"
      className="pointer-events-none h-full w-full object-cover"
    />
  );
}

/* =========================================================
   DIRECTOR SHOWCASE
   MOVIES — INCHANGÉ
========================================================= */

function DirectorShowcase({
  portrait = false,
  name,
  backdrop,
  onPlay,
}: {
  name?: string;
  backdrop?: string;
  onPlay: () => void;
  portrait?: boolean;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      ActorMiniData | null
    >(null);

  useEffect(() => {
    if (!name) {
      setData(
        null
      );

      return;
    }

    let mounted =
      true;

    loadPerson(
      name
    ).then(
      (
        person
      ) => {
        if (
          mounted
        ) {
          setData(
            person
          );
        }
      }
    );

    return () => {
      mounted =
        false;
    };
  }, [
    name,
  ]);

  return (
    <button
      type="button"
      onClick={
        onPlay
      }
      className="
        group
        absolute
        inset-0
        overflow-hidden
        bg-[#08080c]/88
        text-left
      "
    >
      {backdrop && (
        <img
          src={
            backdrop
          }
          alt=""
          draggable={
            false
          }
          className="
            absolute
            inset-0
            h-full
            w-full
            scale-[1.04]
            object-cover
            opacity-[0.24]
          "
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/98 via-black/90 to-black/45" />

      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />

      <div className="absolute inset-0 flex items-center px-[clamp(12px,3vw,38px)]">
        <div className="flex min-w-0 flex-1 items-center gap-[clamp(10px,2vw,22px)]">
          <div
            className="
              aspect-square
              w-[clamp(48px,8vw,100px)]
              shrink-0
              overflow-hidden
              rounded-[17px]
              border
              border-white/12
              bg-[#111118]
              shadow-[0_15px_45px_rgba(0,0,0,.45)]
            "
          >
            {data?.photoUrl ? (
              <img
                src={
                  data.photoUrl
                }
                alt={
                  name ||
                  ""
                }
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <User className="h-[34%] w-[34%] text-white/20" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold uppercase tracking-[0.2em] text-[#d8ccff]/90",

                portrait
                  ? "text-[10px]"
                  : "text-[clamp(5px,.7vw,9px)]"
              )}
            >
              Réalisation
            </p>

            <h3 className="mt-1 truncate text-[clamp(14px,2vw,29px)] font-semibold tracking-[-0.03em] text-white">
              {name ||
                "Découvrir la série"}
            </h3>

<div className="mt-2 max-h-[92px] max-w-[500px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
  <p
    className={cn(
      "leading-[1.55]",
      portrait
        ? "text-[12px] text-white/90"
        : "text-[clamp(6px,.8vw,11px)] text-white/72"
    )}
  >
    {data?.bio || "Biographie indisponible."}
  </p>
</div>
          </div>
        </div>

        <div
          className="
            ml-3
            grid
            aspect-square
            w-[clamp(40px,5vw,68px)]
            shrink-0
            place-items-center
            rounded-full
            border
            border-white/30
            bg-white/[0.13]
            transition
            duration-300
            group-hover:scale-105
          "
        >
          <Play className="ml-1 h-[42%] w-[42%] fill-white" />
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   ACTOR MINI
   MOVIES
========================================================= */

function ActorMini({
  name,
  active,
  compact,
  portraitCompact = false,
  landscapeCompact = false,
  onSelect,
}: {
  name: string;

  active: boolean;

  compact: boolean;

  portraitCompact?:
    boolean;

  landscapeCompact?:
    boolean;

  onSelect: (
    actor:
      ActorMiniData
  ) => void;
}) {
  const [
    data,
    setData,
  ] =
    useState<ActorMiniData>(
      () =>
        personCache.get(
          name
        ) || {
          name,
          photoUrl:
            null,
          bio:
            "",
        }
    );

  useEffect(() => {
    let mounted =
      true;

    loadPerson(
      name
    ).then(
      (
        person
      ) => {
        if (
          mounted
        ) {
          setData(
            person
          );
        }
      }
    );

    return () => {
      mounted =
        false;
    };
  }, [
    name,
  ]);

  return (
    <motion.button
      layout={
        !portraitCompact
      }
      transition={
        smoothTransition
      }
      type="button"
      draggable={
        false
      }
      onClick={() =>
        onSelect(
          data
        )
      }
      className={cn(
        `
        group
        relative
        shrink-0
        overflow-hidden
        border
        select-none
        transition-colors
        duration-300
        `,

        landscapeCompact
          ? "h-[54px] w-[42px] rounded-[9px]"
          : portraitCompact
            ? "aspect-[3/4] w-[48px] rounded-[11px]"
            : compact
              ? "aspect-[3/4] w-[54px] rounded-[14px] sm:w-[60px]"
              : "aspect-[3/4] w-[64px] rounded-[14px] sm:w-[74px]",

        active
          ? `
            border-[#d8ccff]/50
            bg-[#d8ccff]/10
            shadow-[0_12px_35px_rgba(170,145,255,.16)]
          `
          : `
            border-white/10
            bg-white/[0.035]
            hover:border-white/20
          `
      )}
    >
      {data.photoUrl ? (
        <img
          src={
            data.photoUrl
          }
          alt={
            name
          }
          draggable={
            false
          }
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-[center_18%]"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[#111118]">
          <User className="h-5 w-5 text-white/20" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent px-1.5 pb-1.5 pt-5">
        <p
          className={cn(
            "truncate text-center font-medium text-white",

            landscapeCompact
              ? "text-[5px]"
              : portraitCompact
                ? "text-[6px]"
                : "text-[7px]"
          )}
        >
          {name}
        </p>
      </div>
    </motion.button>
  );
}

/* =========================================================
   CASTING SHOWCASE
   MOVIES UI — NE PAS REDESSINER
========================================================= */

function CastingShowcase({
  actors,
  movieLogo,
  studio,
  studioLogo,
  companies,
  producers,

  portraitCompact = false,
  compactLandscape = false,

  appleLiteMode = false,

  onActorOpenChange,
}: {
  actors: string[];

  movieLogo?:
    | string
    | null;

  studio?:
    | string
    | null;

  studioLogo?:
    | string
    | null;

  companies?:
    ProductionCompany[];

  producers?:
    ProducerData[];

  portraitCompact?:
    boolean;

  compactLandscape?:
    boolean;

  appleLiteMode?:
    boolean;

  onActorOpenChange?: (
    open: boolean
  ) => void;
}) {
  const [
    selected,
    setSelected,
  ] =
    useState<ActorMiniData | null>(
      null
    );

  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState(-1);

  const [
    swipeDirection,
    setSwipeDirection,
  ] =
    useState<
      -1 | 0 | 1
    >(0);

  const actorRequest =
    useRef(0);

  useEffect(
    () => () => {
      actorRequest.current +=
        1;
    },
    []
  );

  const railRef =
    useRef<HTMLDivElement>(
      null
    );

  const mouseDown =
    useRef(false);

  const dragged =
    useRef(false);

  const startX =
    useRef(0);

  const startScroll =
    useRef(0);

  const bioTouchStartX =
    useRef(0);

  const bioTouchStartY =
    useRef(0);

  const bioTouchDragging =
    useRef(false);

  /* =======================================================
     DESKTOP DRAG
  ======================================================= */

  const handleMouseDown = (
    event:
      React.MouseEvent<HTMLDivElement>
  ) => {
    if (!railRef.current) {
      return;
    }

    mouseDown.current =
      true;

    dragged.current =
      false;

    startX.current =
      event.clientX;

    startScroll.current =
      railRef.current.scrollLeft;
  };

  const handleMouseMove = (
    event:
      React.MouseEvent<HTMLDivElement>
  ) => {
    if (
      !railRef.current ||
      !mouseDown.current
    ) {
      return;
    }

    const delta =
      event.clientX -
      startX.current;

    if (
      Math.abs(delta) >
      6
    ) {
      dragged.current =
        true;
    }

    if (
      dragged.current
    ) {
      event.preventDefault();

      railRef.current.scrollLeft =
        startScroll.current -
        delta * 1.1;
    }
  };

  const stopMouseDrag =
    () => {
      mouseDown.current =
        false;

      window.setTimeout(
        () => {
          dragged.current =
            false;
        },
        70
      );
    };

  /* =======================================================
     ACTOR SELECTION
  ======================================================= */

  const closeActor =
    () => {
      actorRequest.current +=
        1;

      setSelected(null);
      setSelectedIndex(-1);
      setSwipeDirection(0);

      onActorOpenChange?.(
        false
      );
    };

  const selectActor = (
    actor:
      ActorMiniData
  ) => {
    if (
      dragged.current
    ) {
      return;
    }

    const request =
      ++actorRequest.current;

    const index =
      actors.findIndex(
        (name) =>
          name ===
          actor.name
      );

    setSelected(actor);
    setSelectedIndex(
      index
    );
    setSwipeDirection(0);

    onActorOpenChange?.(
      true
    );

    void loadPerson(
      actors[index] ||
        actor.name
    ).then((person) => {
      if (
        actorRequest.current ===
        request
      ) {
        setSelected(
          person
        );
      }
    });
  };

  const showActorByIndex =
    useCallback(
      async (
        requestedIndex:
          number,
        direction:
          -1 | 1
      ) => {
        if (
          actors.length ===
          0
        ) {
          return;
        }

        let index =
          requestedIndex;

        if (index < 0) {
          index =
            actors.length -
            1;
        }

        if (
          index >=
          actors.length
        ) {
          index = 0;
        }

        setSwipeDirection(
          direction
        );

        const request =
          ++actorRequest.current;

        const name =
          actors[index];

        setSelectedIndex(
          index
        );

        setSelected(
          personCache.get(
            name
          ) || {
            name,
            photoUrl:
              null,
            bio:
              "Chargement de la biographie…",
          }
        );

        const actor =
          await loadPerson(
            name
          );

        if (
          actorRequest.current ===
          request
        ) {
          setSelected(
            actor
          );
        }
      },
      [actors]
    );

  /* =======================================================
     BIO SWIPE
  ======================================================= */

  const handleBioTouchStart = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    const touch =
      event.touches[0];

    bioTouchStartX.current =
      touch.clientX;

    bioTouchStartY.current =
      touch.clientY;

    bioTouchDragging.current =
      false;
  };

  const handleBioTouchMove = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    const touch =
      event.touches[0];

    const deltaX =
      touch.clientX -
      bioTouchStartX.current;

    const deltaY =
      touch.clientY -
      bioTouchStartY.current;

    if (
      Math.abs(deltaX) >
        10 &&
      Math.abs(deltaX) >
        Math.abs(deltaY)
    ) {
      bioTouchDragging.current =
        true;
    }
  };

  const handleBioTouchEnd = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    if (
      !bioTouchDragging.current
    ) {
      return;
    }

    const touch =
      event.changedTouches[0];

    const deltaX =
      touch.clientX -
      bioTouchStartX.current;

    bioTouchDragging.current =
      false;

    if (
      deltaX < -42
    ) {
      void showActorByIndex(
        selectedIndex + 1,
        1
      );

      return;
    }

    if (
      deltaX > 42
    ) {
      void showActorByIndex(
        selectedIndex - 1,
        -1
      );
    }
  };

  /* =======================================================
     PRODUCTION
  ======================================================= */

  const companyNames =
    Array.isArray(
      companies
    )
      ? companies
          .map(
            (company) =>
              company?.name
          )
          .filter(Boolean)
          .slice(0, 4)
      : [];

  const producerNames =
    Array.isArray(
      producers
    )
      ? producers
          .filter(
            (producer) =>
              [
                "Producer",
                "Executive Producer",
              ].includes(
                producer.job ||
                  ""
              )
          )
          .map(
            (producer) =>
              producer?.name
          )
          .filter(Boolean)
          .slice(0, 2)
      : [];

  /* =======================================================
     PORTRAIT — MOVIES
  ======================================================= */

  if (
    portraitCompact
  ) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col">
        <div className="mb-2 flex h-[16px] shrink-0 items-center gap-2 px-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_10px_rgba(216,204,255,.8)]" />

          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/95">
            Casting / Acteurs
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence
            initial={false}
            mode="wait"
          >
            {!selected ? (
              <motion.div
                key="portrait-casting-rail"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={
                  appleLiteMode
                    ? appleTransition
                    : smoothTransition
                }
                className="
                  absolute
                  inset-0
                  flex
                  items-center
                  overflow-hidden
                  rounded-[16px]
                  border
                  border-white/[0.13]
                  bg-transparent
                  px-2
                "
              >
                {movieLogo && (
                  <div
                    className="
                      relative
                      z-30
                      mr-2
                      flex
                      h-[68px]
                      w-[58px]
                      shrink-0
                      items-center
                      justify-center
                      border-r
                      border-white/[0.10]
                      pr-2
                    "
                  >
                    <img
                      src={
                        movieLogo
                      }
                      alt="Logo"
                      draggable={
                        false
                      }
                      className="
                        pointer-events-none
                        max-h-[42px]
                        max-w-full
                        object-contain
                        opacity-100
                        drop-shadow-md
                      "
                    />
                  </div>
                )}

                <div
                  ref={railRef}
                  style={{
                    WebkitOverflowScrolling:
                      "touch",

                    touchAction:
                      "pan-x",

                    overscrollBehaviorX:
                      "contain",
                  }}
                  className="
                    flex
                    min-w-0
                    flex-1
                    items-center
                    gap-2
                    overflow-x-auto
                    overflow-y-hidden
                    py-1
                    select-none
                    [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                  "
                >
                  {actors.map(
                    (actor) => (
                      <ActorMini
                        key={
                          actor
                        }
                        name={
                          actor
                        }
                        active={
                          false
                        }
                        compact
                        portraitCompact
                        onSelect={
                          selectActor
                        }
                      />
                    )
                  )}
                </div>

                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-7 bg-gradient-to-l from-black/10 to-transparent" />
              </motion.div>
            ) : (
              <motion.div
                key="portrait-bio"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={
                  appleLiteMode
                    ? {
                        duration:
                          0.14,
                      }
                    : {
                        duration:
                          0.2,
                      }
                }
                onTouchStart={
                  handleBioTouchStart
                }
                onTouchMove={
                  handleBioTouchMove
                }
                onTouchEnd={
                  handleBioTouchEnd
                }
                onTouchCancel={() => {
                  bioTouchDragging.current =
                    false;
                }}
                style={{
                  touchAction:
                    "pan-y",
                }}
                className="
                  absolute
                  inset-0
                  overflow-hidden
                  rounded-[16px]
                  border
                  border-[#d8ccff]/18
                  bg-[#0c0c10]/[0.98]
                  shadow-[0_16px_50px_rgba(0,0,0,.38)]
                "
              >
                {selected.photoUrl && (
                  <img
                    src={
                      selected.photoUrl
                    }
                    alt=""
                    draggable={
                      false
                    }
                    className="
                      absolute
                      right-0
                      top-0
                      h-full
                      w-[55%]
                      object-cover
                      object-top
                    "
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/98 via-[58%] to-transparent" />

                <div className="relative z-10 flex h-full max-w-[72%] flex-col justify-center px-4 py-3">
                  <button
                    type="button"
                    onClick={
                      closeActor
                    }
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/35 text-white/70"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d8ccff]">
                    Casting
                  </p>

                  <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-white">
                    {
                      selected.name
                    }
                  </h3>

<div className="mt-2 max-h-[82px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
  <p className="text-[10px] leading-[1.55] text-white/70">
    {selected.bio || "Biographie indisponible."}
  </p>
</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* =======================================================
     LANDSCAPE + DESKTOP — MOVIES
  ======================================================= */

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full items-center overflow-hidden",

        compactLandscape
          ? "rounded-[13px] border border-white/[0.12] bg-black/15 px-2"
          : "rounded-[18px] border border-white/[0.10] bg-black/10 px-3"
      )}
    >
      <AnimatePresence
        initial={false}
        mode="wait"
      >
        {!selected ? (
          <motion.div
            key="casting-main"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={
              appleLiteMode
                ? appleTransition
                : smoothTransition
            }
            className="absolute inset-0 flex items-center"
          >
            {/* TITLE LOGO */}

            {movieLogo && (
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center border-r border-white/[0.08]",

                  compactLandscape
                    ? "h-[48px] w-[62px] px-2"
                    : "h-[70px] w-[92px] px-3"
                )}
              >
                <img
                  src={
                    movieLogo
                  }
                  alt=""
                  draggable={
                    false
                  }
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            {/* ACTORS */}

            <div
              ref={railRef}
              onMouseDown={
                handleMouseDown
              }
              onMouseMove={
                handleMouseMove
              }
              onMouseUp={
                stopMouseDrag
              }
              onMouseLeave={
                stopMouseDrag
              }
              style={{
                WebkitOverflowScrolling:
                  "touch",

                touchAction:
                  "pan-x",

                overscrollBehaviorX:
                  "contain",
              }}
              className={cn(
                `
                flex
                min-w-0
                items-center
                overflow-x-auto
                overflow-y-hidden
                select-none
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
                `,

                compactLandscape
                  ? "w-[72%] gap-2 px-2"
                  : "flex-1 gap-2.5 px-3"
              )}
            >
              {actors.map(
                (actor) => (
                  <ActorMini
                    key={
                      actor
                    }
                    name={
                      actor
                    }
                    active={
                      false
                    }
                    compact
                    landscapeCompact={
                      compactLandscape
                    }
                    onSelect={
                      selectActor
                    }
                  />
                )
              )}
            </div>

            {/* PRODUCTION */}

            <div
              className={cn(
                `
                ml-auto
                flex
                shrink-0
                items-center
                justify-end
                border-l
                border-white/[0.08]
                `,

                compactLandscape
                  ? "h-[48px] w-[28%] gap-2 px-2"
                  : "h-[70px] min-w-[210px] gap-3 px-4"
              )}
            >
              <div className="min-w-0 text-right">
                <p
                  className={cn(
                    "font-semibold uppercase tracking-[0.18em] text-[#d8ccff]/75",

                    compactLandscape
                      ? "text-[5px]"
                      : "text-[7px]"
                  )}
                >
                  Production & Studios
                </p>

                <p
                  className={cn(
                    "mt-1 truncate font-semibold text-white/90",

                    compactLandscape
                      ? "text-[6px]"
                      : "text-[9px]"
                  )}
                >
                  {studio ||
                    companyNames[0] ||
                    producerNames[0] ||
                    "Production"}
                </p>
              </div>

              {studioLogo && (
                <div
                  className={cn(
                    "grid shrink-0 place-items-center rounded-[10px] bg-white",

                    compactLandscape
                      ? "h-[38px] w-[38px]"
                      : "h-[54px] w-[54px]"
                  )}
                >
                  <img
                    src={
                      studioLogo
                    }
                    alt={
                      studio ||
                      "Studio"
                    }
                    draggable={
                      false
                    }
                    className="max-h-[78%] max-w-[78%] object-contain"
                  />
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={
              selected.name
            }
            initial={{
              opacity: 0,
              x:
                swipeDirection ===
                -1
                  ? -20
                  : 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
            }}
            transition={
              appleLiteMode
                ? appleTransition
                : smoothTransition
            }
            onTouchStart={
              handleBioTouchStart
            }
            onTouchMove={
              handleBioTouchMove
            }
            onTouchEnd={
              handleBioTouchEnd
            }
            className="absolute inset-0 flex items-center overflow-hidden"
          >
            {selected.photoUrl && (
  <img
    src={selected.photoUrl}
    alt=""
    draggable={false}
    className="
      absolute
      bottom-0
      right-0
      h-[92%]
      w-[38%]
      object-cover
      object-[center_37%]
      opacity-40
    "
  />
)}

            <div className="absolute inset-0 bg-gradient-to-r from-[#09090d] via-[#09090d]/95 to-[#09090d]/50" />

            <button
              type="button"
              onClick={
                closeActor
              }
              className="absolute right-2 top-2 z-30 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/35 text-white/70"
            >
              <X className="h-3 w-3" />
            </button>

            <div
              className={cn(
                "relative z-10 min-w-0",

                compactLandscape
                  ? "max-w-[68%] px-3"
                  : "max-w-[72%] px-5"
              )}
            >
              <p
                className={cn(
                  "font-semibold uppercase tracking-[0.18em] text-[#d8ccff]",

                  compactLandscape
                    ? "text-[5px]"
                    : "text-[7px]"
                )}
              >
                Casting
              </p>

              <h3
                className={cn(
                  "mt-1 truncate font-semibold tracking-[-0.03em] text-white",

                  compactLandscape
                    ? "text-[10px]"
                    : "text-[15px]"
                )}
              >
                {
                  selected.name
                }
              </h3>

              <p
                className={cn(
                  "mt-1.5 line-clamp-3 leading-[1.5] text-white/65",

                  compactLandscape
                    ? "text-[5.5px]"
                    : "text-[8px]"
                )}
              >
                {selected.bio ||
                  "Biographie indisponible."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
   PAGE SERIES
========================================================= */

export default function SeriesDetailPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const id =
    (
      params?.seriesId ||
      params?.id
    ) as string;

  const {
    data,
    isLoading,
    isError,
  } =
    useSeriesInfo(id);

  const {
    isFav,
    toggleFav,
    progress,
  } =
    useLibrary();

  /* =======================================================
     PLAYER STATE

     director  -> Movie DirectorShowcase
     episodes  -> episodes de la saison
     playing   -> VideoPlayer

     Toujours dans LE MÊME panneau.
  ======================================================= */

  const [
    playerMode,
    setPlayerMode,
  ] =
    useState<
      | "director"
      | "episodes"
      | "playing"
    >("director");

  const [
    showSeasons,
    setShowSeasons,
  ] =
    useState(false);

  const [
    seasonKey,
    setSeasonKey,
  ] =
    useState<
      string | null
    >(null);

  const [
    activeEpisode,
    setActiveEpisode,
  ] =
    useState<Episode | null>(
      null
    );

  const [
    activeEpisodeDuration,
    setActiveEpisodeDuration,
  ] =
    useState(0);

  const [
    fullscreen,
    setFullscreen,
  ] =
    useState(false);

  const [
    actorOpen,
    setActorOpen,
  ] =
    useState(false);

  const screenMode =
    useScreenMode(
      fullscreen
    );

  const appleLiteMode =
    useAppleSafariLiteMode();

  const playerContainerRef =
    useRef<HTMLDivElement>(
      null
    );

  const epListRef =
    useRef<HTMLDivElement>(
      null
    );

  const epDrag =
    useRef({
      isDown: false,
      startY: 0,
      scrollTop: 0,
      didDrag: false,
    });

  /* =======================================================
     SERIES DATA
  ======================================================= */

  const info =
    data?.info ||
    data?.series_info ||
    (
      data &&
      !data.episodes
        ? data
        : {}
    ) ||
    {};

  const episodesBySeason =
    data?.episodes ??
    {};

  const rawTitle =
    info?.name ||
    info?.title ||
    "Série";

  const cleanTitle =
    cleanName(
      rawTitle
    )
      .replace(
        /\s*\(\d{4}\)/g,
        ""
      )
      .replace(
        /\s*\[\d{4}\]/g,
        ""
      )
      .trim();

  const tmdbId =
    info?.tmdb_id ||
    info?.tmdbId;

  const safeTitle =
    !isLoading &&
    cleanTitle !==
      "Série"
      ? cleanTitle
      : undefined;

  const logoUrl =
    useTitleLogo(
      tmdbId,
      safeTitle
    );

  const {
    details:
      productionDetails,

    loading:
      isTmdbLoading,
  } =
    useProductionDetails(
      tmdbId,
      safeTitle
    );

  const fanart =
    useFanartSeries(
      tmdbId
    );

  const productionLogoUrl =
    productionDetails
      ?.studioLogo ||
    null;

  const studioName =
    productionDetails
      ?.studio ||
    info?.studio ||
    info?.network ||
    "Studio Inconnu";

  const companies =
    productionDetails
      ?.companies ||
    [];

  const producers =
    productionDetails
      ?.producers ||
    [];

  const finalSynopsis =
    info?.plot ||
    info?.description ||
    info?.overview ||
    productionDetails
      ?.overview ||
    "Aucun synopsis détaillé n'est disponible pour cette série.";

  /* =======================================================
     DIRECTOR / CREATOR
  ======================================================= */

  const tmdbCreator =
    producers.find(
      (producer) =>
        producer.job ===
          "Creator" ||
        producer.job ===
          "Showrunner"
    )?.name;

  const xtreamDirector =
    info?.director
      ? String(
          info.director
        )
          .split(",")[0]
          .trim()
      : undefined;

  const tmdbFallback =
    producers.find(
      (producer) =>
        [
          "Director",
          "Series Director",
          "Executive Producer",
        ].includes(
          producer.job ||
            ""
        )
    )?.name;

  const bestDirectorName =
    tmdbCreator ||
    xtreamDirector ||
    tmdbFallback;

  const finalDirectorName =
    isTmdbLoading
      ? undefined
      : bestDirectorName;

  /* =======================================================
     SEASONS
  ======================================================= */

  const seasons =
    useMemo(
      () =>
        Object.keys(
          episodesBySeason
        )
          .filter(
            (season) =>
              (
                episodesBySeason[
                  season
                ] || []
              ).length >
              0
          )
          .sort(
            (a, b) =>
              (
                parseInt(
                  a.replace(
                    /\D/g,
                    ""
                  ),
                  10
                ) || 0
              ) -
              (
                parseInt(
                  b.replace(
                    /\D/g,
                    ""
                  ),
                  10
                ) || 0
              )
          ),
      [
        episodesBySeason,
      ]
    );

  const activeSeasonKey =
    seasonKey ??
    seasons[0] ??
    null;

  const episodes =
    activeSeasonKey
      ? episodesBySeason[
          activeSeasonKey
        ] || []
      : [];

      const selectedSeasonNumber =
  activeSeasonKey
    ? parseInt(
        activeSeasonKey.replace(/\D/g, ""),
        10
      ) || 1
    : 1;

  /* =======================================================
     CAST
  ======================================================= */

  const castList =
    useMemo(
      () =>
        info?.cast
          ? String(
              info.cast
            )
              .split(",")
              .map(
                (value) =>
                  value.trim()
              )
              .filter(
                Boolean
              )
          : [],
      [
        info?.cast,
      ]
    );

  /* =======================================================
     METADATA
  ======================================================= */

  const rating =
    ratingNum(
      info?.rating
    );

  const year =
    yearFrom(
      info?.releaseDate ||
        info?.releasedate,
      cleanTitle
    );

  const genreText =
    String(
      info?.genre ||
        info?.category_name ||
        ""
    )
      .split(",")[0]
      .trim();

  /* =======================================================
     ARTWORK

     IMPORTANT :
     on conserve l'effet background Série que tu aimais.
     On ne touche pas au squelette responsive Movie.
  ======================================================= */

  const backdrop =
    fanart?.backdrop ||
    info
      ?.backdrop_path?.[0] ||
    info?.backdrop ||
    info?.cover;

  const basePoster =
    fanart?.poster ||
    info?.cover;

  const currentPoster =
    basePoster;

  const fav =
    isFav(
      "series",
      Number(id)
    );

  /* =======================================================
     FAVORITE
  ======================================================= */

  const handleFavorite =
    useCallback(
      () => {
        toggleFav(
          "series",
          {
            id:
              Number(id),

            title:
              cleanTitle,

            image:
              basePoster ||
              currentPoster ||
              "",
          } as any
        );
      },
      [
        toggleFav,
        id,
        cleanTitle,
        basePoster,
        currentPoster,
      ]
    );

  /* =======================================================
     REGARDER

     IMPORTANT :
     le premier clic NE LANCE PAS directement le player.

     Il révèle uniquement les saisons horizontalement
     à côté de Regarder.
  ======================================================= */

  const handleWatch =
    useCallback(
      () => {
        setShowSeasons(
          true
        );
      },
      []
    );

  /* =======================================================
     SELECT SEASON

     La saison ne crée aucune nouvelle zone.
     Le panneau Réalisation devient la liste épisodes.
  ======================================================= */

  const handleSeasonSelect =
    useCallback(
      (
        season:
          string
      ) => {
        setSeasonKey(
          season
        );

        setActiveEpisode(
          null
        );

        setPlayerMode(
          "episodes"
        );
      },
      []
    );

  /* =======================================================
     SELECT EPISODE

     Même panneau -> VideoPlayer.
  ======================================================= */

  const handleEpisodeSelect =
    useCallback(
      (
        episode:
          Episode
      ) => {
        if (
          epDrag.current
            .didDrag
        ) {
          return;
        }

        setActiveEpisode(
          episode
        );

        setPlayerMode(
          "playing"
        );
      },
      []
    );

  /* =======================================================
     CLOSE PLAYER

     Retour aux épisodes de la saison sélectionnée.
  ======================================================= */

  const handleClosePlayer =
    useCallback(
      () => {
        setPlayerMode(
          "episodes"
        );
      },
      []
    );

  /* =======================================================
     EPISODE DRAG
  ======================================================= */

  const handleEpMouseDown = (
    event:
      React.MouseEvent
  ) => {
    epDrag.current.isDown =
      true;

    epDrag.current.didDrag =
      false;

    epDrag.current.startY =
      event.clientY;

    epDrag.current.scrollTop =
      epListRef.current
        ?.scrollTop ||
      0;
  };

  const handleEpMouseMove = (
    event:
      React.MouseEvent
  ) => {
    if (
      !epDrag.current
        .isDown ||
      !epListRef.current
    ) {
      return;
    }

    const delta =
      event.clientY -
      epDrag.current
        .startY;

    if (
      Math.abs(
        delta
      ) > 5
    ) {
      epDrag.current.didDrag =
        true;
    }

    epListRef.current.scrollTop =
      epDrag.current
        .scrollTop -
      delta;
  };

  const handleEpMouseUp =
    () => {
      epDrag.current.isDown =
        false;

      window.setTimeout(
        () => {
          epDrag.current.didDrag =
            false;
        },
        50
      );
    };

  /* =======================================================
     EPISODE DURATION
  ======================================================= */

  useEffect(() => {
    if (
      !activeEpisode
    ) {
      setActiveEpisodeDuration(
        0
      );

      return;
    }

    const episode =
      activeEpisode as any;

    const localDuration =
      durationToSeconds(
        episode?.info
          ?.duration_secs
      ) ||
      durationToSeconds(
        episode?.info
          ?.duration
      ) ||
      durationToSeconds(
        episode
          ?.duration_secs
      );

    if (
      localDuration >
      0
    ) {
      setActiveEpisodeDuration(
        localDuration
      );

      return;
    }

    const episodeId =
      episode?.id ??
      episode
        ?.stream_id;

    if (
      !episodeId ||
      !id
    ) {
      setActiveEpisodeDuration(
        0
      );

      return;
    }

    let mounted =
      true;

    fetch(
      `/api/media-info?type=series&seriesId=${encodeURIComponent(
        id
      )}&episodeId=${encodeURIComponent(
        String(
          episodeId
        )
      )}`,
      {
        cache:
          "no-store",
      }
    )
      .then(
        async (
          response
        ) => {
          if (
            !response.ok
          ) {
            throw new Error();
          }

          return response.json();
        }
      )
      .then(
        (json) => {
          if (
            !mounted
          ) {
            return;
          }

          const value =
            Number(
              json?.duration ||
                0
            );

          setActiveEpisodeDuration(
            Number.isFinite(
              value
            ) &&
              value >
                0
              ? value
              : 0
          );
        }
      )
      .catch(
        () => {
          if (
            mounted
          ) {
            setActiveEpisodeDuration(
              0
            );
          }
        }
      );

    return () => {
      mounted =
        false;
    };
  }, [
    activeEpisode,
    id,
  ]);

  /* =======================================================
     ACTIVE RESUME
  ======================================================= */

  const activeResumePosition =
    activeEpisode
      ? progress[
          `series:${activeEpisode.id}`
        ]?.position ??
        0
      : 0;

  /* =======================================================
     FULLSCREEN STATE
  ======================================================= */

  useEffect(() => {
    const update =
      () => {
        setFullscreen(
          Boolean(
            document.fullscreenElement
          )
        );
      };

    document.addEventListener(
      "fullscreenchange",
      update
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        update
      );
    };
  }, []);

  /* =======================================================
     LOADING / ERROR
  ======================================================= */

  if (
    isLoading ||
    !screenMode
  ) {
    return (
      <SeriesSkeleton />
    );
  }

  if (
    isError ||
    !data ||
    !id
  ) {
    return (
      <div className="grid h-full min-h-0 w-full place-items-center bg-[#060608] text-white/40">
        Impossible de charger la série.
      </div>
    );
  }

    /* =======================================================
     SEASON ACTIONS
     REGARDER + SAISONS HORIZONTALES

     - au départ : Regarder seulement
     - clic Regarder : saisons visibles
     - aucune SeasonWheel verticale
     - aucun nouveau bloc
  ======================================================= */

  const renderSeasonActions = (
    mode:
      | "desktop"
      | "portrait"
      | "landscape"
  ) => {
    const compact =
      mode ===
      "landscape";

    return (
      <div
        className={cn(
          "flex min-w-0 items-center",

          compact
            ? "gap-1"
            : mode ===
                "portrait"
              ? "gap-2"
              : "gap-2.5"
        )}
      >
        <button
          type="button"
          onClick={
            handleWatch
          }
          className={cn(
            `
            inline-flex
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-white
            font-bold
            text-black
            shadow-[0_8px_24px_rgba(0,0,0,.25)]
            transition
            active:scale-[.97]
            `,

            compact
              ? "h-[29px] gap-1 px-2.5 text-[5.7px]"
              : mode ===
                  "portrait"
                ? "h-9 gap-1.5 px-3 text-[12px]"
                : "h-10 gap-2 px-6 text-[10px]"
          )}
        >
          <Play
            className={cn(
              "fill-current",

              compact
                ? "h-2.5 w-2.5"
                : mode ===
                    "portrait"
                  ? "h-3 w-3"
                  : "h-3.5 w-3.5"
            )}
          />

          Regarder
        </button>

        <AnimatePresence
          initial={false}
        >
          {showSeasons &&
            seasons.length >
              0 && (
              <motion.div
                initial={{
                  opacity: 0,
                  scaleX:
                    0.96,
                }}
                animate={{
                  opacity: 1,
                  scaleX: 1,
                }}
                exit={{
                  opacity: 0,
                  scaleX:
                    0.96,
                }}
                transition={{
                  duration:
                    0.2,
                }}
                className="
                  min-w-0
                  flex-1
                  overflow-hidden
                  origin-left
                "
              >
                <div
                  className={cn(
                    `
                    flex
                    min-w-0
                    items-center
                    overflow-x-auto
                    overflow-y-hidden
                    [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                    `,

                    compact
                      ? "gap-1"
                      : "gap-1.5"
                  )}
                  style={{
                    WebkitOverflowScrolling:
                      "touch",

                    touchAction:
                      "pan-x",

                    overscrollBehaviorX:
                      "contain",
                  }}
                >
                  {seasons.map(
                    (
                      season
                    ) => {
                      const active =
                        activeSeasonKey ===
                        season;

                      const number =
                        season.replace(
                          /\D/g,
                          ""
                        ) ||
                        season;

                      return (
                        <button
                          key={
                            season
                          }
                          type="button"
                          onClick={() =>
                            handleSeasonSelect(
                              season
                            )
                          }
                          className={cn(
                            `
                            shrink-0
                            rounded-full
                            border
                            font-semibold
                            transition
                            active:scale-[.96]
                            `,

                            compact
                              ? "h-[29px] min-w-[42px] px-2 text-[5.5px]"
                              : mode ===
                                  "portrait"
                                ? "h-9 min-w-[54px] px-3 text-[9px]"
                                : "h-10 min-w-[62px] px-3 text-[9px]",

                            active
                              ? `
                                border-[#d8ccff]/55
                                bg-[#d8ccff]/18
                                text-[#e8e0ff]
                                shadow-[0_6px_20px_rgba(170,145,255,.12)]
                              `
                              : `
                                border-white/15
                                bg-[#111118]/80
                                text-white/72
                                hover:border-white/25
                                hover:text-white
                              `
                          )}
                        >
                          S
                          {
                            number
                          }
                        </button>
                      );
                    }
                  )}
                </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    );
  };

  /* =======================================================
     EPISODES

     IMPORTANT :
     ceci vit DANS le panneau Movie.
     Pas en dessous de la page.
  ======================================================= */

  const renderEpisodes =
    () => (
      <div className="absolute inset-0 flex min-h-0 flex-col bg-[#08080c]/96">
        {/* HEADER */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-white/[0.08]
            px-3
            py-2
            sm:px-4
          "
        >
          <div className="min-w-0">
            <p className="text-[6px] font-semibold uppercase tracking-[0.18em] text-[#d8ccff]/80 sm:text-[8px]">
              {activeSeasonKey
                ? `Saison ${
                    activeSeasonKey.replace(
                      /\D/g,
                      ""
                    ) ||
                    activeSeasonKey
                  }`
                : "Épisodes"}
            </p>

            <p className="mt-0.5 truncate text-[8px] font-semibold text-white/90 sm:text-[10px]">
              {cleanTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPlayerMode(
                "director"
              );

              setActiveEpisode(
                null
              );
            }}
            className="
              grid
              h-6
              w-6
              shrink-0
              place-items-center
              rounded-full
              border
              border-white/12
              bg-black/35
              text-white/65
              transition
              hover:text-white
              sm:h-7
              sm:w-7
            "
            aria-label="Fermer les épisodes"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* LIST */}

        <div
          ref={
            epListRef
          }
          onMouseDown={
            handleEpMouseDown
          }
          onMouseMove={
            handleEpMouseMove
          }
          onMouseUp={
            handleEpMouseUp
          }
          onMouseLeave={
            handleEpMouseUp
          }
          className="
            min-h-0
            flex-1
            cursor-grab
            overflow-y-auto
            overscroll-contain
            px-2
            py-2
            active:cursor-grabbing
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
            sm:px-3
          "
          style={{
            WebkitOverflowScrolling:
              "touch",
          }}
        >
          {episodes.length >
          0 ? (
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {episodes.map(
                (
                  episode:
                    any,
                  index:
                    number
                ) => {
                  const episodeNumber =
                    episode
                      ?.episode_num ||
                    episode
                      ?.episode ||
                    index +
                      1;

                  const episodeTitle =
                    cleanName(
                      episode
                        ?.title ||
                        `Épisode ${episodeNumber}`
                    );

                  const resume =
                    progress[
                      `series:${episode.id}`
                    ]
                      ?.position ??
                    0;

                  return (
                    <button
                      key={
                        episode.id ||
                        `${activeSeasonKey}-${index}`
                      }
                      type="button"
                      draggable={
                        false
                      }
                      onClick={() =>
                        handleEpisodeSelect(
                          episode
                        )
                      }
                      className="
                        group
                        flex
                        w-full
                        shrink-0
                        items-center
                        gap-2
                        rounded-[10px]
                        border
                        border-white/[0.07]
                        bg-white/[0.025]
                        p-1.5
                        text-left
                        transition
                        hover:border-[#d8ccff]/25
                        hover:bg-white/[0.055]
                        sm:gap-3
                        sm:rounded-[12px]
                        sm:p-2
                      "
                    >
                      {/* EPISODE IMAGE */}

                      <div
                        className="
                          relative
                          aspect-video
                          w-[72px]
                          shrink-0
                          overflow-hidden
                          rounded-[7px]
                          bg-[#111118]
                          sm:w-[105px]
                          md:w-[120px]
                        "
                      >
                        <EpisodeImage
                          ep={
                            episode
                          }
                          seriesTitle={
                            cleanTitle
                          }
                          tmdbId={
                            tmdbId
                          }
                          seasonKey={
                            activeSeasonKey ||
                            "1"
                          }
                          fallbackCover={
                            backdrop ||
                            currentPoster ||
                            undefined
                          }
                        />

                        <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/0" />

                        <div
                          className="
                            absolute
                            inset-0
                            grid
                            place-items-center
                            opacity-0
                            transition
                            group-hover:opacity-100
                          "
                        >
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-black shadow-lg sm:h-8 sm:w-8">
                            <Play className="ml-[1px] h-2.5 w-2.5 fill-current sm:h-3 sm:w-3" />
                          </span>
                        </div>

                        {resume >
                          15 && (
                          <div className="absolute inset-x-1 bottom-1 h-[2px] overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-[#d8ccff]"
                              style={{
                                width:
                                  "35%",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* INFO */}

                      <div className="min-w-0 flex-1">
                        <p className="text-[5px] font-semibold uppercase tracking-[0.16em] text-[#d8ccff]/75 sm:text-[7px]">
                          Épisode{" "}
                          {
                            episodeNumber
                          }
                        </p>

                        <p className="mt-0.5 line-clamp-1 text-[7px] font-semibold text-white/92 sm:text-[10px] md:text-[11px]">
                          {
                            episodeTitle
                          }
                        </p>

                        {episode
                          ?.info
                          ?.plot && (
                          <p className="mt-1 line-clamp-1 text-[5px] leading-relaxed text-white/40 sm:text-[7px]">
                            {
                              episode
                                .info
                                .plot
                            }
                          </p>
                        )}
                      </div>

                      <Play className="mr-1 h-3 w-3 shrink-0 text-white/25 transition group-hover:text-[#d8ccff] sm:h-4 sm:w-4" />
                    </button>
                  );
                }
              )}
            </div>
          ) : (
            <div className="grid h-full place-items-center text-[8px] text-white/35">
              Aucun
              épisode
              disponible.
            </div>
          )}
        </div>
      </div>
    );

  /* =======================================================
     PLAYER
     EXACTEMENT UN PANNEAU

     director
       ↓
     episodes
       ↓
     VideoPlayer
  ======================================================= */

  const renderPlayer =
    () => (
      <div
        ref={
          playerContainerRef
        }
        className="
          group
          relative
          h-full
          w-full
          overflow-hidden
          rounded-[20px]
          border
          border-white/[0.12]
          bg-[#060608]
          shadow-[0_20px_65px_rgba(0,0,0,.45)]
        "
      >
        <AnimatePresence
          initial={false}
          mode="wait"
        >
          {playerMode ===
          "director" ? (
            <motion.div
              key="director"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration:
                  0.18,
              }}
              className="absolute inset-0"
            >
              <DirectorShowcase
                portrait={
                  screenMode ===
                  "portrait"
                }
                name={
                  finalDirectorName
                }
                backdrop={
                  backdrop ||
                  null
                }
                onPlay={
                  handleWatch
                }
              />
            </motion.div>
          ) : playerMode ===
            "episodes" ? (
            <motion.div
              key={`episodes-${activeSeasonKey}`}
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration:
                  0.18,
              }}
              className="absolute inset-0"
            >
              {renderEpisodes()}
            </motion.div>
          ) : activeEpisode ? (
            <motion.div
              key={`playing-${activeEpisode.id}`}
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration:
                  0.18,
              }}
              className="absolute inset-0"
            >
<VideoPlayer
  onFullscreenChange={
    setFullscreen
  }
  sources={[
    `${
      appleLiteMode
        ? "/api/vod-hls"
        : "/api/stream-vod"
    }?type=series&id=${encodeURIComponent(
      String(
        activeEpisode.id
      )
    )}&ext=${encodeURIComponent(
      activeEpisode.container_extension ||
        "mkv"
    )}`,
  ]}
                ext={
                  activeEpisode.container_extension ||
                  "mkv"
                }
                isLive={
                  false
                }
                mediaType="series"
                title={cleanName(
                  activeEpisode.title ||
                    `${cleanTitle} · S${selectedSeasonNumber}E${
                      (
                        activeEpisode as any
                      )
                        .episode_num ||
                      (
                        activeEpisode as any
                      )
                        .episode ||
                      ""
                    }`
                )}
                titleLogo={
                  logoUrl ||
                  undefined
                }
                poster={
                  (
                    activeEpisode as any
                  ).info
                    ?.movie_image ||
                  backdrop ||
                  currentPoster ||
                  undefined
                }
                resumeData={{
                  id:
                    activeEpisode.id,

                  seriesId:
                    id,

                  season:
                    selectedSeasonNumber,

                  episode:
                    (
                      activeEpisode as any
                    )
                      .episode_num ||
                    (
                      activeEpisode as any
                    )
                      .episode ||
                    null,

                  image:
                    basePoster ||
                    currentPoster ||
                    backdrop ||
                    null,

                  title:
                    cleanTitle,
                }}
                knownDuration={
                  activeEpisodeDuration
                }
                startTime={
                  activeResumePosition >
                  15
                    ? activeResumePosition
                    : 0
                }
                onBack={
                  handleClosePlayer
                }
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );

  /* =======================================================
     DESKTOP
     SQUELETTE MOVIES
  ======================================================= */

  const renderDesktop =
    () => (
      <div className="relative h-full min-h-0">
        <div
          className="
            relative
            z-10
            mx-auto
            flex
            h-full
            min-h-0
            w-full
            max-w-[1700px]
            flex-col
            justify-center
            gap-[30px]
            px-8
            pb-[62px]
            pt-[76px]
          "
        >
          {/* HERO */}

          <div
            className="
              grid
              w-full
              shrink-0
              grid-cols-[190px_minmax(0,1fr)_minmax(500px,44%)]
              items-start
              gap-9
            "
          >
            {/* COVER */}

            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[22px] border border-white/[0.13] bg-[#0c0c10] shadow-[0_24px_70px_rgba(0,0,0,.45)]">
              {currentPoster && (
                <img
                  src={
                    currentPoster
                  }
                  alt={
                    cleanTitle
                  }
                  draggable={
                    false
                  }
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              <button
                type="button"
                onClick={
                  handleFavorite
                }
                className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60"
              >
                <Heart
                  className={cn(
                    "h-4 w-4",

                    fav &&
                      "fill-[#d8ccff] text-[#d8ccff]"
                  )}
                />
              </button>
            </div>

            {/* INFO */}

            <div className="min-w-0">
              <div className="flex min-h-[108px] items-start">
                {logoUrl ? (
                  <img
                    src={
                      logoUrl
                    }
                    alt={
                      cleanTitle
                    }
                    draggable={
                      false
                    }
                    className="max-h-[108px] max-w-[95%] object-contain object-left-top drop-shadow-[0_12px_26px_rgba(0,0,0,.55)]"
                  />
                ) : (
                  <h1 className="text-5xl font-semibold leading-[.94] tracking-[-.05em]">
                    {
                      cleanTitle
                    }
                  </h1>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] font-medium text-white/80">
                {rating >
                  0 && (
                  <span className="flex items-center gap-1 text-[#d8ccff]">
                    <Star className="h-3.5 w-3.5 fill-current" />

                    {rating.toFixed(
                      1
                    )}
                  </span>
                )}

                {year && (
                  <span>
                    • {year}
                  </span>
                )}

                {genreText && (
                  <span>
                    •{" "}
                    {
                      genreText
                    }
                  </span>
                )}
              </div>

              {finalSynopsis && (
                <p className="mt-5 line-clamp-4 max-w-2xl text-[12px] font-medium leading-[1.65] text-white/78">
                  {
                    finalSynopsis
                  }
                </p>
              )}

              {producers.length >
                0 && (
                <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/[0.08] pt-4">
                  {producers
                    .slice(
                      0,
                      3
                    )
                    .map(
                      (
                        producer,
                        index
                      ) => (
                        <div
                          key={`${producer.id || producer.name}-${index}`}
                        >
                          <p className="text-[9px] font-semibold text-white">
                            {
                              producer.name
                            }
                          </p>

                          <p className="mt-1 text-[5.5px] uppercase tracking-[0.18em] text-[#d8ccff]/75">
                            {producer.job ||
                              "Production"}
                          </p>
                        </div>
                      )
                    )}
                </div>
              )}

              {/* REGARDER + SAISONS */}

              <div className="mt-5 min-w-0">
                {renderSeasonActions(
                  "desktop"
                )}
              </div>
            </div>

            {/* PLAYER */}

            <div className="aspect-video w-full">
              {renderPlayer()}
            </div>
          </div>

          {/* CASTING */}

<div className="h-[118px] w-full shrink-0">
  <CastingShowcase
    actors={castList}
    movieLogo={logoUrl || currentPoster}
    studio={studioName}
    studioLogo={productionLogoUrl}
    companies={companies}
    producers={producers}
    appleLiteMode={appleLiteMode}
  />
</div>
        </div>
      </div>
    );

  /* =======================================================
     PORTRAIT
     SQUELETTE MOVIES
  ======================================================= */

  const renderPortrait =
    () => (
      <div
        className="
          relative
          h-full
          min-h-0
          overflow-y-auto
          overscroll-y-contain
        "
        style={{
          WebkitOverflowScrolling:
            "touch",
        }}
      >
        <div
          className="
            flex
            min-h-full
            flex-col
            gap-3
            px-3
            pb-3
            pt-4
          "
        >
          {/* HERO */}

          <div
            className="
              grid
              min-h-[156px]
              shrink-0
              grid-cols-[29%_minmax(0,1fr)]
              items-center
              gap-3
            "
          >
            {/* COVER */}

            <div className="flex h-full min-h-0 items-center">
              <div className="relative aspect-[2/3] max-h-full w-full overflow-hidden rounded-[15px] border border-white/12 bg-[#0b0b10] shadow-[0_18px_45px_rgba(0,0,0,.35)]">
                {currentPoster && (
                  <img
                    src={
                      currentPoster
                    }
                    alt={
                      cleanTitle
                    }
                    draggable={
                      false
                    }
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                <button
                  type="button"
                  onClick={
                    handleFavorite
                  }
                  className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/70"
                >
                  <Heart
                    className={cn(
                      "h-3.5 w-3.5",

                      fav &&
                        "fill-[#d8ccff] text-[#d8ccff]"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* INFO */}

            <div className="flex h-full min-w-0 flex-col justify-center pt-3">
              <div className="flex min-h-[68px] w-full items-center">
                {logoUrl ? (
                  <img
                    src={
                      logoUrl
                    }
                    alt={
                      cleanTitle
                    }
                    draggable={
                      false
                    }
                    className="block max-h-[82px] max-w-full object-contain object-left drop-shadow-[0_10px_24px_rgba(0,0,0,.70)]"
                  />
                ) : (
                  <h1 className="text-[clamp(24px,7vw,38px)] font-semibold leading-[.92] tracking-[-.04em] text-white">
                    {
                      cleanTitle
                    }
                  </h1>
                )}
              </div>

              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg bg-[#111118]/90 px-2 py-1 text-[11px] font-medium text-white/95">
                {rating >
                  0 && (
                  <span className="shrink-0 text-[#d8ccff]">
                    ★{" "}
                    {rating.toFixed(
                      1
                    )}
                  </span>
                )}

                {year && (
                  <span className="shrink-0 text-white/85">
                    • {year}
                  </span>
                )}

                {genreText && (
                  <span className="text-white/95">
                    •{" "}
                    {
                      genreText
                    }
                  </span>
                )}
              </div>

              {/* REGARDER + SAISONS */}

              <div className="mt-3 min-w-0">
                {renderSeasonActions(
                  "portrait"
                )}
              </div>
            </div>
          </div>

          {/* PLAYER */}

          <div className="h-[clamp(170px,24dvh,260px)] min-h-0 shrink-0">
            {renderPlayer()}
          </div>

          {/* SYNOPSIS */}

          {!actorOpen && (
            <section
              aria-label="Synopsis"
              className="
                h-[128px]
                shrink-0
                overflow-y-auto
                overscroll-contain
                rounded-[15px]
                border
                border-white/15
                bg-[#09090e]/[0.94]
                p-3
                shadow-[0_12px_35px_rgba(0,0,0,.28)]
              "
            >
              <p className="text-[13px] font-medium leading-relaxed text-white/95">
                {
                  finalSynopsis
                }
              </p>
            </section>
          )}

          {/* CASTING */}

          <div
            className={cn(
              "flex flex-1 flex-col",

              actorOpen
                ? "min-h-[300px]"
                : "min-h-[160px]"
            )}
            style={{
              flexBasis:
                actorOpen
                  ? 300
                  : 160,
            }}
          >
            {castList.length >
              0 && (
              <CastingShowcase
                portraitCompact
                appleLiteMode={
                  appleLiteMode
                }
                actors={
                  castList
                }
                movieLogo={
                  logoUrl ||
                  currentPoster
                }
                studio={
                  studioName
                }
                studioLogo={
                  productionLogoUrl
                }
                companies={
                  companies
                }
                producers={
                  producers
                }
                onActorOpenChange={
                  setActorOpen
                }
              />
            )}
          </div>
        </div>
      </div>
    );

  /* =======================================================
     LANDSCAPE
     SQUELETTE MOVIES EXACT :
     92px | INFO | PLAYER
     CASTING = 72px EN BAS
  ======================================================= */

  const renderLandscape =
    () => (
      <div className="h-full min-h-0">
        <div
          className="
            grid
            h-full
            min-h-0
            grid-rows-[minmax(0,1fr)_72px]
            gap-2
            p-2.5
          "
        >
          {/* TOP */}

          <div
            className="
              grid
              min-h-0
              grid-cols-[92px_minmax(235px,.98fr)_minmax(300px,1.20fr)]
              gap-3
              overflow-hidden
            "
          >
            {/* COVER */}

            <div className="flex min-h-0 items-center">
              <div className="relative aspect-[2/3] max-h-full w-full overflow-hidden rounded-[12px] border border-white/10 bg-[#0b0b10]">
                {currentPoster && (
                  <img
                    src={
                      currentPoster
                    }
                    alt={
                      cleanTitle
                    }
                    draggable={
                      false
                    }
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                <button
                  type="button"
                  onClick={
                    handleFavorite
                  }
                  className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/65"
                >
                  <Heart
                    className={cn(
                      "h-2.5 w-2.5",

                      fav &&
                        "fill-[#d8ccff] text-[#d8ccff]"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* INFO */}

            <div className="relative z-20 flex min-w-0 flex-col justify-center">
              <div className="min-w-0">
                <div className="flex min-h-[50px] w-full items-center">
                  {logoUrl ? (
                    <img
                      src={
                        logoUrl
                      }
                      alt={
                        cleanTitle
                      }
                      draggable={
                        false
                      }
                      className="block max-h-[54px] max-w-full object-contain object-left drop-shadow-[0_8px_18px_rgba(0,0,0,.65)]"
                    />
                  ) : (
                    <h1 className="text-[22px] font-semibold leading-[.92] tracking-[-.04em] text-white">
                      {
                        cleanTitle
                      }
                    </h1>
                  )}
                </div>

                <div className="mt-1 flex gap-1.5 text-[6px] font-medium text-white/80">
                  {rating >
                    0 && (
                    <span className="text-[#d8ccff]">
                      ★{" "}
                      {rating.toFixed(
                        1
                      )}
                    </span>
                  )}

                  {year && (
                    <span>
                      • {year}
                    </span>
                  )}

                  {genreText && (
                    <span className="truncate">
                      •{" "}
                      {
                        genreText
                      }
                    </span>
                  )}
                </div>

                <p className="mt-1.5 line-clamp-3 text-[6.2px] font-medium leading-[1.45] text-white/68">
                  {
                    finalSynopsis
                  }
                </p>

                {/*
                  SAISONS SOUS LES INFOS,
                  TOUJOURS HORIZONTALES AVEC REGARDER.
                  Aucun bloc vertical.
                */}

                <div className="mt-2 min-w-0">
                  {renderSeasonActions(
                    "landscape"
                  )}
                </div>
              </div>
            </div>

            {/* PLAYER */}

            <div className="flex min-h-0 items-center justify-center overflow-hidden">
              <div className="aspect-video w-full max-h-full">
                {renderPlayer()}
              </div>
            </div>
          </div>

          {/* CASTING — 72px MOVIES */}

          <div className="h-[72px] min-h-0 overflow-hidden">
            {castList.length >
              0 && (
              <CastingShowcase
                compactLandscape
                actors={
                  castList
                }
                movieLogo={
                  logoUrl ||
                  currentPoster
                }
                studio={
                  studioName
                }
                studioLogo={
                  productionLogoUrl
                }
                companies={
                  companies
                }
                producers={
                  producers
                }
                appleLiteMode={
                  appleLiteMode
                }
              />
            )}
          </div>
        </div>
      </div>
    );

      /* =======================================================
     RETURN FINAL
     UN SEUL SCREEN / UN SEUL PLAYER
  ======================================================= */

  return (
    <main
      className="
        relative
        h-full
        min-h-0
        w-full
        min-w-0
        overflow-hidden
        bg-[#060608]
        text-white
      "
    >
      {/* ===================================================
          BACKGROUND SERIES

          On garde l'effet background Series.
          On ne remplace PAS ça par le background Movie pur.
      =================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {backdrop && (
          <>
            {/* BACKDROP PRINCIPAL */}

            <motion.img
              key={backdrop}
              src={backdrop}
              alt=""
              draggable={false}
              initial={{
                opacity: 0,
                scale: 1.025,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                opacity: {
                  duration: 0.45,
                },
                scale: {
                  duration: 1.1,
                  ease: "easeOut",
                },
              }}
              className="
                absolute
                inset-0
                h-full
                w-full
                object-cover
                opacity-[0.68]
              "
            />

            {/* léger glow du backdrop */}

            <div
              className="
                absolute
                inset-0
                bg-[radial-gradient(circle_at_72%_32%,rgba(216,204,255,0.07),transparent_36%)]
              "
            />
          </>
        )}

        {/* =================================================
            GRADIENT GAUCHE
        ================================================= */}

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-r
            from-[#060608]
            via-[#060608]/86
            via-[45%]
            to-black/30
          "
        />

        {/* =================================================
            GRADIENT BAS
        ================================================= */}

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-t
            from-[#060608]/94
            via-[#060608]/18
            to-black/35
          "
        />

        {/* =================================================
            VIGNETTE
        ================================================= */}

        <div
          className="
            absolute
            inset-0
            shadow-[inset_0_0_120px_rgba(0,0,0,.34)]
          "
        />
      </div>

      {/* ===================================================
          UN SEUL LAYOUT ACTIF

          desktop   -> renderDesktop()
          portrait  -> renderPortrait()
          landscape -> renderLandscape()

          Aucun deuxième layout caché.
          Aucun deuxième player.
      =================================================== */}

      {screenMode === "desktop"
        ? renderDesktop()
        : screenMode === "portrait"
          ? renderPortrait()
          : renderLandscape()}
    </main>
  );
}

/* =========================================================
   SERIES SKELETON
========================================================= */

function SeriesSkeleton() {
  return (
    <main
      className="
        relative
        h-full
        min-h-0
        w-full
        overflow-hidden
        bg-[#060608]
        p-3
        text-white
        sm:p-4
      "
    >
      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_70%_28%,rgba(216,204,255,0.045),transparent_36%)]
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-r
            from-[#060608]
            via-[#060608]
            to-[#09090d]
          "
        />
      </div>

      {/* DESKTOP SKELETON */}

      <div
        className="
          relative
          z-10
          hidden
          h-full
          min-h-0
          w-full
          lg:flex
          lg:flex-col
          lg:justify-center
          lg:gap-[30px]
          lg:px-4
          lg:pb-[62px]
          lg:pt-[76px]
        "
      >
        <div
          className="
            grid
            w-full
            grid-cols-[190px_minmax(0,1fr)_minmax(500px,44%)]
            items-start
            gap-9
          "
        >
          {/* COVER */}

          <Skeleton
            className="
              aspect-[2/3]
              w-full
              rounded-[22px]
              bg-white/[0.05]
            "
          />

          {/* INFO */}

          <div className="min-w-0 pt-1">
            <Skeleton
              className="
                h-[82px]
                w-[68%]
                rounded-[18px]
                bg-white/[0.05]
              "
            />

            <div className="mt-4 flex gap-2">
              <Skeleton className="h-4 w-12 rounded-full bg-white/[0.05]" />

              <Skeleton className="h-4 w-16 rounded-full bg-white/[0.05]" />

              <Skeleton className="h-4 w-24 rounded-full bg-white/[0.05]" />
            </div>

            <div className="mt-5 space-y-2">
              <Skeleton className="h-3 w-full rounded-full bg-white/[0.045]" />

              <Skeleton className="h-3 w-[94%] rounded-full bg-white/[0.045]" />

              <Skeleton className="h-3 w-[80%] rounded-full bg-white/[0.045]" />
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Skeleton className="h-10 w-[110px] rounded-full bg-white/[0.08]" />

              <Skeleton className="h-10 w-[62px] rounded-full bg-white/[0.05]" />

              <Skeleton className="h-10 w-[62px] rounded-full bg-white/[0.05]" />
            </div>
          </div>

          {/* PLAYER */}

          <Skeleton
            className="
              aspect-video
              w-full
              rounded-[20px]
              bg-white/[0.05]
            "
          />
        </div>

        {/* CASTING */}

        <Skeleton
          className="
            h-[118px]
            w-full
            rounded-[20px]
            bg-white/[0.04]
          "
        />
      </div>

      {/* ===================================================
          MOBILE / TABLET SKELETON
      =================================================== */}

      <div
        className="
          relative
          z-10
          flex
          h-full
          min-h-0
          flex-col
          gap-3
          lg:hidden

          portrait:overflow-y-auto

          landscape:grid
          landscape:grid-rows-[minmax(0,1fr)_72px]
          landscape:gap-2
          landscape:overflow-hidden
        "
      >
        {/* PORTRAIT */}

        <div
          className="
            grid
            shrink-0
            grid-cols-[29%_minmax(0,1fr)]
            gap-3

            landscape:hidden
          "
        >
          <Skeleton
            className="
              aspect-[2/3]
              w-full
              rounded-[15px]
              bg-white/[0.05]
            "
          />

          <div className="flex min-w-0 flex-col justify-center gap-3">
            <Skeleton className="h-[58px] w-[82%] rounded-[14px] bg-white/[0.05]" />

            <Skeleton className="h-6 w-full rounded-[9px] bg-white/[0.05]" />

            <div className="flex gap-2">
              <Skeleton className="h-9 w-[92px] rounded-full bg-white/[0.08]" />

              <Skeleton className="h-9 w-[54px] rounded-full bg-white/[0.05]" />
            </div>
          </div>
        </div>

        <Skeleton
          className="
            h-[clamp(170px,24dvh,260px)]
            shrink-0
            rounded-[20px]
            bg-white/[0.05]

            landscape:hidden
          "
        />

        <Skeleton
          className="
            h-[128px]
            shrink-0
            rounded-[15px]
            bg-white/[0.04]

            landscape:hidden
          "
        />

        <Skeleton
          className="
            min-h-[160px]
            flex-1
            rounded-[15px]
            bg-white/[0.04]

            landscape:hidden
          "
        />

        {/* =================================================
            LANDSCAPE
            EXACTEMENT LE MÊME SQUELETTE DE GRILLE
            92px | INFO | PLAYER
        ================================================= */}

        <div
          className="
            hidden
            min-h-0
            grid-cols-[92px_minmax(235px,.98fr)_minmax(300px,1.20fr)]
            gap-3
            overflow-hidden

            landscape:grid
          "
        >
          {/* COVER */}

          <div className="flex min-h-0 items-center">
            <Skeleton
              className="
                aspect-[2/3]
                max-h-full
                w-full
                rounded-[12px]
                bg-white/[0.05]
              "
            />
          </div>

          {/* INFO */}

          <div className="flex min-w-0 flex-col justify-center">
            <Skeleton
              className="
                h-[48px]
                w-[72%]
                rounded-[10px]
                bg-white/[0.05]
              "
            />

            <div className="mt-2 flex gap-1">
              <Skeleton className="h-2 w-7 rounded-full bg-white/[0.05]" />

              <Skeleton className="h-2 w-8 rounded-full bg-white/[0.05]" />

              <Skeleton className="h-2 w-14 rounded-full bg-white/[0.05]" />
            </div>

            <div className="mt-2 space-y-1">
              <Skeleton className="h-1.5 w-full rounded-full bg-white/[0.045]" />

              <Skeleton className="h-1.5 w-[92%] rounded-full bg-white/[0.045]" />

              <Skeleton className="h-1.5 w-[76%] rounded-full bg-white/[0.045]" />
            </div>

            <div className="mt-3 flex gap-1">
              <Skeleton className="h-[29px] w-[64px] rounded-full bg-white/[0.08]" />

              <Skeleton className="h-[29px] w-[42px] rounded-full bg-white/[0.05]" />

              <Skeleton className="h-[29px] w-[42px] rounded-full bg-white/[0.05]" />
            </div>
          </div>

          {/* PLAYER */}

          <div className="flex min-h-0 items-center">
            <Skeleton
              className="
                aspect-video
                w-full
                rounded-[20px]
                bg-white/[0.05]
              "
            />
          </div>
        </div>

        {/* LANDSCAPE CASTING */}

        <Skeleton
          className="
            hidden
            h-[72px]
            min-h-0
            rounded-[14px]
            bg-white/[0.04]

            landscape:block
          "
        />
      </div>
    </main>
  );
}