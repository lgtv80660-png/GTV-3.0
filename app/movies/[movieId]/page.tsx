"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  ArrowLeft,
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

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/Skeleton";
import GPlayerAdapter from "@/components/player/GPlayerAdapter";
import { useLibrary } from "@/store/library";

/* =========================================================
   TYPES
========================================================= */

type ScreenMode =
  | "desktop"
  | "portrait"
  | "landscape";

type FanartData = {
  logo?: string | null;
  backdrop?: string | null;
  poster?: string | null;
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

type ProductionData = {
  studio?: string | null;
  studioLogo?: string | null;
  companies?: ProductionCompany[];
  producers?: ProducerData[];
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
  new Map<string, ActorMiniData>();

const personPending =
  new Map<
    string,
    Promise<ActorMiniData>
  >();

/* =========================================================
   HELPERS
========================================================= */

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function cleanMovieTitle(
  rawTitle: string
) {
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
}

function safeImage(
  value?: string | null
): string | undefined {
  if (
    !value ||
    typeof value !== "string"
  ) {
    return undefined;
  }

  const clean =
    value.trim();

  if (
    !clean ||
    clean === "null" ||
    clean === "undefined"
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

function ratingNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function extractYear(
  ...values: unknown[]
) {
  for (
    const value of values
  ) {
    if (!value) {
      continue;
    }

    const match =
      String(value).match(
        /\b(19|20)\d{2}\b/
      );

    if (match) {
      return match[0];
    }
  }

  return "";
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
    typeof value === "number"
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
    String(value).trim();

  if (!text) {
    return 0;
  }

  if (
    /^\d+$/.test(text)
  ) {
    return Number(text);
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
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    );
  }

  return 0;
}

function getYoutubeId(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  if (
    /^[a-zA-Z0-9_-]{11}$/.test(
      text
    )
  ) {
    return text;
  }

  try {
    const url =
      new URL(text);

    if (
      url.hostname.includes(
        "youtu.be"
      )
    ) {
      return (
        url.pathname
          .split("/")
          .filter(Boolean)[0] ||
        null
      );
    }

    if (
      url.hostname.includes(
        "youtube.com"
      )
    ) {
      const normal =
        url.searchParams.get(
          "v"
        );

      if (normal) {
        return normal;
      }

      const parts =
        url.pathname
          .split("/")
          .filter(Boolean);

      const embedIndex =
        parts.indexOf(
          "embed"
        );

      if (
        embedIndex >= 0 &&
        parts[
          embedIndex + 1
        ]
      ) {
        return parts[
          embedIndex + 1
        ];
      }

      const shortsIndex =
        parts.indexOf(
          "shorts"
        );

      if (
        shortsIndex >= 0 &&
        parts[
          shortsIndex + 1
        ]
      ) {
        return parts[
          shortsIndex + 1
        ];
      }
    }
  } catch {}

  return null;
}

/* =========================================================
   PERSON LOADER
========================================================= */

async function loadPerson(
  name: string
): Promise<ActorMiniData> {
  const cleanName =
    name.trim();

  const cached =
    personCache.get(
      cleanName
    );

  if (cached) {
    return cached;
  }

  const pending =
    personPending.get(
      cleanName
    );

  if (pending) {
    return pending;
  }

  const request =
    fetch(
      `/api/actor-photo?name=${encodeURIComponent(
        cleanName
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
                () => ({})
              );

          const result:
            ActorMiniData =
            {
              name:
                cleanName,

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
            cleanName,
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
                cleanName,

              photoUrl:
                null,

              bio:
                "",
            };

          personCache.set(
            cleanName,
            result
          );

          return result;
        }
      )
      .finally(
        () => {
          personPending.delete(
            cleanName
          );
        }
      );

  personPending.set(
    cleanName,
    request
  );

  return request;
}

/* =========================================================
   SCREEN MODE
========================================================= */

function useScreenMode(fullscreen: boolean) {
  const [
    mode,
    setMode,
  ] =
    useState<ScreenMode | null>(
      null
    );

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
        // Keep the mounted player when fullscreen rotates the viewport.
        if (fullscreen || document.fullscreenElement) return;
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
    document.addEventListener("fullscreenchange", update);

    desktop.addEventListener(
      "change",
      update
    );

    portrait.addEventListener(
      "change",
      update
    );

    return () => {
      document.removeEventListener("fullscreenchange", update);
      desktop.removeEventListener(
        "change",
        update
      );

      portrait.removeEventListener(
        "change",
        update
      );
    };
  }, [fullscreen]);

  return mode;
}

/* =========================================================
   APPLE / SAFARI LITE
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
   ARTWORK
========================================================= */

function useMovieArtwork(
  title: string,
  tmdbId?:
    | string
    | number
) {
  const [
    artwork,
    setArtwork,
  ] =
    useState<FanartData>(
      {}
    );

  const artworkKey = JSON.stringify([title, tmdbId]);
  const [loadedArtworkKey, setLoadedArtworkKey] = useState<string | null>(null);

  useEffect(() => {
    if (!title) {
      return;
    }

    let mounted =
      true;

    const load =
      async () => {
        try {
          const cleaned =
            cleanMovieTitle(
              title
            );

          let logoEndpoint =
            `/api/title-logo?title=${encodeURIComponent(
              cleaned
            )}&type=movie`;

          if (tmdbId) {
            logoEndpoint +=
              `&tmdbId=${encodeURIComponent(
                String(
                  tmdbId
                )
              )}`;
          }

          const [
            logoResponse,
            fanartResponse,
          ] =
            await Promise.all(
              [
                fetch(
                  logoEndpoint
                ).catch(
                  () =>
                    null
                ),

                tmdbId
                  ? fetch(
                      `/api/fanart/movie?tmdbId=${encodeURIComponent(
                        String(
                          tmdbId
                        )
                      )}`
                    ).catch(
                      () =>
                        null
                    )
                  : Promise.resolve(
                      null
                    ),
              ]
            );

          const logoJson =
            logoResponse
              ? await logoResponse
                  .json()
                  .catch(
                    () =>
                      ({})
                  )
              : {};

          const fanartJson =
            fanartResponse
              ? await fanartResponse
                  .json()
                  .catch(
                    () =>
                      ({})
                  )
              : {};

          if (
            !mounted
          ) {
            return;
          }

          setArtwork({
            logo:
              safeImage(
                logoJson?.logoUrl
              ) ||
              safeImage(
                logoJson?.logo
              ) ||
              safeImage(
                fanartJson?.logo
              ) ||
              null,

            poster:
              safeImage(
                fanartJson?.poster
              ) ||
              null,

            backdrop:
              safeImage(
                fanartJson?.backdrop
              ) ||
              null,
          });
        } catch {} finally {
          if (mounted) setLoadedArtworkKey(JSON.stringify([title, tmdbId]));
        }
      };

    void load();

    return () => {
      mounted = false;
    };
  }, [
    title,
    tmdbId,
  ]);

  return { ...(loadedArtworkKey === artworkKey ? artwork : {}), ready: !title || loadedArtworkKey === artworkKey };
}

/* =========================================================
   DIRECTOR SHOWCASE
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
    useState<ActorMiniData | null>(
      null
    );

  useEffect(() => {
    if (!name) {
      setData(null);

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
      mounted = false;
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
            <p className={cn("font-semibold uppercase tracking-[0.2em] text-[#d8ccff]/90", portrait ? "text-[10px]" : "text-[clamp(5px,.7vw,9px)]")}>
              Réalisation
            </p>

            <h3 className="mt-1 truncate text-[clamp(14px,2vw,29px)] font-semibold tracking-[-0.03em] text-white">
              {name ||
                "Découvrir le film"}
            </h3>

            <p className={cn("mt-2 line-clamp-3 max-w-[500px] leading-[1.55]", portrait ? "text-[12px] text-white/90" : "text-[clamp(6px,.8vw,11px)] text-white/72")}>
              {data?.bio ||
                "Biographie indisponible."}
            </p>
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
  portraitCompact?: boolean;
  landscapeCompact?: boolean;
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
      mounted = false;
    };
  }, [
    name,
  ]);

  return (
    <motion.button
      layout={!portraitCompact}
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
        rounded-[12px]
        border
        select-none
        transition-colors
        duration-300
        `,

        portraitCompact
          ? "h-[112px] w-[82px]"

          : landscapeCompact
          ? "h-[54px] w-[42px]"

          : compact
          ? "aspect-[3/4] w-[54px] sm:w-[60px]"

          : "aspect-[3/4] w-[64px] sm:w-[74px]",

        active
          ? `
            border-[#d8ccff]/60
            bg-[#d8ccff]/10
            shadow-[0_10px_28px_rgba(170,145,255,.20)]
          `
          : `
            border-white/12
            bg-[#101016]
            hover:border-white/22
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
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <User className="h-4 w-4 text-white/25" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />

      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" />

      {active && (
        <motion.div
          layoutId="active-actor-outline"
          className="absolute inset-0 rounded-[12px] ring-1 ring-[#d8ccff]/70 shadow-[inset_0_0_20px_rgba(216,204,255,.12)]"
        />
      )}

      <p
        className={cn(
          `
          pointer-events-none
          absolute
          bottom-1
          left-1
          right-1
          text-white
          `,

          portraitCompact
            ? "flex min-h-8 items-end justify-center px-1 py-1 text-center text-[11px] font-semibold leading-tight text-white whitespace-normal break-words [text-shadow:0_1px_6px_rgba(0,0,0,0.95)]"

          : landscapeCompact
            ? "truncate text-[5.5px] font-medium"

          : "truncate text-[8.5px] font-medium sm:text-[9.5px]"
        )}
      >
        {name}
      </p>
    </motion.button>
  );
}

/* =========================================================
   CASTING SHOWCASE
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

  onActorOpenChange?:
    (
      open:
        boolean
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

  const actorRequest = useRef(0);
  useEffect(() => () => { actorRequest.current += 1; }, []);

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

  const handleMouseDown =
    (
      event:
        React.MouseEvent<HTMLDivElement>
    ) => {
      if (
        !railRef.current
      ) {
        return;
      }

      mouseDown.current =
        true;

      dragged.current =
        false;

      startX.current =
        event.clientX;

      startScroll.current =
        railRef.current
          .scrollLeft;
    };

  const handleMouseMove =
    (
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
        Math.abs(
          delta
        ) >
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
          delta *
            1.1;
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
      actorRequest.current += 1;
      setSelected(
        null
      );

      setSelectedIndex(
        -1
      );

      setSwipeDirection(
        0
      );

      onActorOpenChange?.(
        false
      );
    };

  const selectActor =
    (
      actor:
        ActorMiniData
    ) => {
      if (
        dragged.current
      ) {
        return;
      }

      const request = ++actorRequest.current;
      const index =
        actors.findIndex(
          (
            name
          ) =>
            name ===
            actor.name
        );

      setSelected(
        actor
      );

      setSelectedIndex(
        index
      );

      setSwipeDirection(
        0
      );

      onActorOpenChange?.(true);
      void loadPerson(actors[index] || actor.name).then((person) => {
        if (actorRequest.current === request) setSelected(person);
      });
    };

  /* =======================================================
     NEXT / PREVIOUS
  ======================================================= */

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

        if (
          index < 0
        ) {
          index =
            actors.length -
            1;
        }

        if (
          index >=
          actors.length
        ) {
          index =
            0;
        }

        setSwipeDirection(
          direction
        );

        const request = ++actorRequest.current;
        const name = actors[index];
        setSelectedIndex(index);
        setSelected(personCache.get(name) || { name, photoUrl: null, bio: "Chargement de la biographie…" });
        const actor = await loadPerson(name);
        if (actorRequest.current === request) setSelected(actor);
      },
      [
        actors,
      ]
    );

  /* =======================================================
     BIO SWIPE
  ======================================================= */

  const handleBioTouchStart =
    (
      event:
        React.TouchEvent<HTMLDivElement>
    ) => {
      const touch =
        event.touches[
          0
        ];

      bioTouchStartX.current =
        touch.clientX;

      bioTouchStartY.current =
        touch.clientY;

      bioTouchDragging.current =
        false;
    };

  const handleBioTouchMove =
    (
      event:
        React.TouchEvent<HTMLDivElement>
    ) => {
      const touch =
        event.touches[
          0
        ];

      const deltaX =
        touch.clientX -
        bioTouchStartX.current;

      const deltaY =
        touch.clientY -
        bioTouchStartY.current;

      if (
        Math.abs(
          deltaX
        ) >
          10 &&
        Math.abs(
          deltaX
        ) >
          Math.abs(
            deltaY
          )
      ) {
        bioTouchDragging.current =
          true;
      }
    };

  const handleBioTouchEnd =
    (
      event:
        React.TouchEvent<HTMLDivElement>
    ) => {
      if (
        !bioTouchDragging.current
      ) {
        return;
      }

      const touch =
        event.changedTouches[
          0
        ];

      const deltaX =
        touch.clientX -
        bioTouchStartX.current;

      bioTouchDragging.current =
        false;

      if (
        deltaX <
        -42
      ) {
        void showActorByIndex(
          selectedIndex +
            1,
          1
        );

        return;
      }

      if (
        deltaX >
        42
      ) {
        void showActorByIndex(
          selectedIndex -
            1,
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
            (
              company
            ) =>
              company?.name
          )
          .filter(Boolean)
          .slice(
            0,
            4
          )
      : [];

  const producerNames =
    Array.isArray(
      producers
    )
      ? producers
          .filter(
            (
              producer
            ) =>
              [
                "Producer",
                "Executive Producer",
              ].includes(
                producer.job ||
                  ""
              )
          )
          .map(
            (
              producer
            ) =>
              producer?.name
          )
          .filter(Boolean)
          .slice(
            0,
            2
          )
      : [];

  /* =======================================================
     PORTRAIT
  ======================================================= */

  if (
    portraitCompact
  ) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col">
        {/* HEADER */}

        <div className="mb-2 flex h-[16px] shrink-0 items-center gap-2 px-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_10px_rgba(216,204,255,.8)]" />

          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/95">
            Casting / Acteurs
          </p>
        </div>

        {/* CONTENT */}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence
            initial={
              false
            }
            mode="wait"
          >
            {!selected ? (
              /* =============================================
                 CASTING RAIL
              ============================================= */

              <motion.div
                key="portrait-casting-rail"
                initial={{
                  opacity:
                    0,
                }}
                animate={{
                  opacity:
                    1,
                }}
                exit={{
                  opacity:
                    0,
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
                {/* LOGO FILM */}

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

                {/* ACTORS */}

                <div
                  ref={
                    railRef
                  }
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
                    (
                      actor
                    ) => (
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
              /* =============================================
                 BIO CARD FIXE
              ============================================= */

              <motion.div
                key="portrait-bio-container"
                initial={{
                  opacity:
                    0,
                }}
                animate={{
                  opacity:
                    1,
                }}
                exit={{
                  opacity:
                    0,
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
                onTouchEnd={handleBioTouchEnd}
                onTouchCancel={() => { bioTouchDragging.current = false; }}
                style={{
                  touchAction:
                    "pan-y",

                  WebkitBackfaceVisibility:
                    "hidden",

                  backfaceVisibility:
                    "hidden",
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
                {/* ACTOR CONTENT */}

                <AnimatePresence
                  initial={
                    false
                  }
                  mode="sync"
                >
                  <motion.div
                    key={
                      selected.name
                    }
                    initial={
                      appleLiteMode
                        ? {
                            opacity:
                              0,

                            x:
                              swipeDirection ===
                              -1
                                ? -16
                                : 16,
                          }
                        : {
                            opacity:
                              0,

                            x:
                              swipeDirection ===
                              -1
                                ? -26
                                : 26,

                            scale:
                              0.99,
                          }
                    }
                    animate={{
                      opacity:
                        1,

                      x:
                        0,

                      scale:
                        1,
                    }}
                    exit={
                      appleLiteMode
                        ? {
                            opacity:
                              0,

                            x:
                              swipeDirection ===
                              -1
                                ? 16
                                : -16,
                          }
                        : {
                            opacity:
                              0,

                            x:
                              swipeDirection ===
                              -1
                                ? 26
                                : -26,

                            scale:
                              0.99,
                          }
                    }
                    transition={
                      appleLiteMode
                        ? appleTransition
                        : {
                            duration:
                              0.27,

                            ease: [
                              0.16,
                              1,
                              0.3,
                              1,
                            ],
                          }
                    }
                    style={{
                      WebkitBackfaceVisibility:
                        "hidden",

                      backfaceVisibility:
                        "hidden",

                      willChange:
                        "transform, opacity",
                    }}
                    className="absolute inset-0"
                  >
                    {selected.photoUrl && (
                      <img
                        src={
                          selected.photoUrl
                        }
                        alt={
                          selected.name
                        }
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

                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

                    <div
                      className="
                        relative
                        z-10
                        flex
                        h-full
                        max-w-[78%]
                        flex-col
                        justify-start
                        px-4
                        py-3
                      "
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d8ccff]/90">
                        Distribution
                      </p>

                      <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-white">
                        {
                          selected.name
                        }
                      </h3>

                      <p className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 text-[13px] font-medium leading-relaxed text-white/95">
                        {selected.bio ||
                          "Biographie indisponible."}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-black/20 to-transparent" />

                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-black/20 to-transparent" />

                <button
                  type="button"
                  aria-label="Fermer la biographie"
                  onClick={
                    closeActor
                  }
                  className="
                    absolute
                    right-2
                    top-2
                    z-40
                    grid
                    h-9
                    w-9
                    place-items-center
                    rounded-full
                    border
                    border-white/15
                    bg-black/65
                    text-white/85
                    transition
                    active:scale-95
                  "
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* =======================================================
     DESKTOP / LANDSCAPE
  ======================================================= */

  return (
    <div
      className={cn(
        "w-full",

        compactLandscape
          ? "h-full"

          : "border-t border-white/[0.07] pt-3"
      )}
    >
      {!compactLandscape && (
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_14px_rgba(216,204,255,.8)]" />

          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/65">
            Casting / Acteurs
          </p>
        </div>
      )}

      <motion.div
        layout
        transition={
          smoothTransition
        }
        className={cn(
          `
          relative
          flex
          items-stretch
          overflow-hidden
          rounded-[20px]
          border
          border-white/[0.10]
          bg-[#0a0a0f]/88
          `,

          compactLandscape
            ? "h-full flex-row p-1.5"

          : "flex-col p-2.5 sm:p-3 lg:flex-row"
        )}
      >
        <motion.div
          layout
          transition={
            smoothTransition
          }
          className={cn(
            `
            relative
            flex
            min-w-0
            items-center
            overflow-hidden
            `,

            compactLandscape
              ? selected
                ? "w-[48%]"
                : "w-[72%]"

            : selected
              ? "w-full lg:w-[46%]"

              : "w-full lg:w-[65%]"
          )}
        >
          <div className="relative flex min-w-0 w-full items-center overflow-hidden">
            {movieLogo && (
              <div
                className={cn(
                  `
                  sticky
                  left-0
                  z-30
                  mr-2
                  flex
                  shrink-0
                  items-center
                  justify-center
                  border-r
                  border-white/10
                  bg-[#0d0d12]/98
                  shadow-[15px_0_20px_-10px_rgba(0,0,0,0.6)]
                  `,

                  compactLandscape
                    ? "h-[48px] w-[62px] pr-2"

                    : "h-[64px] w-[75px] pr-3 sm:h-[74px] sm:w-[95px]"
                )}
              >
                <img
                  src={
                    movieLogo
                  }
                  alt="Logo"
                  draggable={
                    false
                  }
                  className={cn(
                    "pointer-events-none max-w-full object-contain opacity-95 drop-shadow-md",

                    compactLandscape
                      ? "max-h-[32px]"

                      : "max-h-[45px]"
                  )}
                />
              </div>
            )}

            <div
              ref={
                railRef
              }
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
              className="
                relative
                z-10
                flex
                min-w-0
                w-full
                items-center
                gap-2
                overflow-x-auto
                overflow-y-hidden
                pb-1
                select-none
                cursor-grab
                active:cursor-grabbing
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            >
              {actors.map(
                (
                  actor
                ) => (
                  <ActorMini
                    key={
                      actor
                    }
                    name={
                      actor
                    }
                    compact={
                      !!selected
                    }
                    landscapeCompact={
                      compactLandscape
                    }
                    active={
                      selected?.name ===
                      actor
                    }
                    onSelect={
                      selectActor
                    }
                  />
                )
              )}
            </div>

            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-10 bg-gradient-to-l from-[#0a0a0f] to-transparent" />
          </div>
        </motion.div>

        <AnimatePresence
          mode="popLayout"
        >
          {selected ? (
            <motion.div
              layout
              key="bio"
              initial={{
                opacity:
                  0,

                x:
                  20,

                filter:
                  "blur(4px)",
              }}
              animate={{
                opacity:
                  1,

                x:
                  0,

                filter:
                  "blur(0px)",
              }}
              exit={{
                opacity:
                  0,

                x:
                  20,

                filter:
                  "blur(4px)",
              }}
              transition={
                smoothTransition
              }
              className={cn(
                `
                relative
                overflow-hidden
                rounded-[16px]
                border
                border-white/[0.11]
                bg-[#0d0d12]/95
                `,

                compactLandscape
                  ? "ml-2 h-full min-h-0 w-[52%]"

                  : "mt-4 min-h-[140px] w-full lg:mt-0 lg:ml-4 lg:w-[54%]"
              )}
            >
              {selected.photoUrl && (
                <motion.img
                  key={
                    selected.photoUrl
                  }
                  initial={{
                    opacity:
                      0,

                    x:
                      50,

                    scale:
                      1.1,
                  }}
                  animate={{
                    opacity:
                      1,

                    x:
                      0,

                    scale:
                      1,
                  }}
                  transition={
                    smoothTransition
                  }
                  src={
                    selected.photoUrl
                  }
                  alt={
                    selected.name
                  }
                  className="absolute right-0 top-0 h-full w-[52%] object-cover object-top"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-[#101015] via-[#101015]/98 via-[52%] to-transparent" />

              <div
                className={cn(
                  "relative z-10",

                  compactLandscape
                    ? "max-w-[70%] p-2"

                    : "max-w-[62%] p-5"
                )}
              >
                <p
                  className={cn(
                    "uppercase tracking-[0.25em] text-[#d8ccff]/80",

                    compactLandscape
                      ? "text-[5px]"

                      : "text-[8px]"
                  )}
                >
                  Distribution
                </p>

                <h3
                  className={cn(
                    "mt-0.5 font-semibold text-white",

                    compactLandscape
                      ? "text-[9px]"

                      : "text-lg"
                  )}
                >
                  {selected.name}
                </h3>

                <p
                  className={cn(
                    "mt-2 line-clamp-4 leading-relaxed text-white/65",

                    compactLandscape
                      ? "text-[5px]"

                      : "text-[11px]"
                  )}
                >
                  {selected.bio ||
                    "Biographie indisponible."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeActor
                }
                className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/45 text-white/70"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              key="production"
              initial={{
                opacity:
                  0,
              }}
              animate={{
                opacity:
                  1,
              }}
              exit={{
                opacity:
                  0,
              }}
              transition={
                smoothTransition
              }
              className={cn(
                `
                flex-col
                justify-center
                border-l
                border-white/5
                `,

                compactLandscape
                  ? "flex w-[28%] pl-2 pr-2"

                  : "hidden w-[35%] pl-4 pr-6 lg:flex"
              )}
            >
              <div className="flex items-center justify-end gap-3">
                <div className="min-w-0 flex-1 text-right">
                  <p
                    className={cn(
                      "mb-1 font-semibold uppercase tracking-[0.3em] text-[#d8ccff]/75",

                      compactLandscape
                        ? "text-[4.3px]"

                        : "text-[8px]"
                    )}
                  >
                    Production & Studios
                  </p>

                  <h4
                    className={cn(
                      "truncate font-bold text-white",

                      compactLandscape
                        ? "text-[7.5px]"

                        : "text-sm"
                    )}
                  >
                    {studio ||
                      "Production non renseignée"}
                  </h4>

                  {!compactLandscape &&
                    companyNames.length >
                      1 && (
                      <p className="mt-1 line-clamp-1 text-[9px] text-white/45">
                        {companyNames
                          .slice(
                            1
                          )
                          .join(
                            " · "
                          )}
                      </p>
                    )}

                  {!compactLandscape &&
                    producerNames.length >
                      0 && (
                      <p className="mt-1 line-clamp-1 text-[9px] text-white/35">
                        Prod.{" "}
                        {producerNames.join(
                          ", "
                        )}
                      </p>
                    )}
                </div>

                <div
                  className={cn(
                    `
                    flex
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[12px]
                    border
                    border-white/15
                    bg-white
                    shadow-[0_10px_30px_rgba(0,0,0,.35)]
                    `,

                    compactLandscape
                      ? "h-[42px] w-[54px] p-1.5"

                      : "h-16 w-24 p-2"
                  )}
                >
                  {studioLogo ? (
                    <img
                      src={
                        studioLogo
                      }
                      alt={
                        studio ||
                        "Studio"
                      }
                      className="h-full w-full object-contain brightness-0 opacity-80"
                      referrerPolicy="no-referrer"
                      onError={(
                        event
                      ) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
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
  const params =
    useParams();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const screenMode = useScreenMode(playerFullscreen);

  const appleLiteMode =
    useAppleSafariLiteMode();

  const id =
    String(
      params?.movieId ||
        params?.id ||
        ""
    );

  const resumeFromQuery =
    Math.max(
      0,
      Number(
        searchParams.get(
          "resume"
        ) ||
          0
      ) ||
        0
    );

  const [
    playerMode,
    setPlayerMode,
  ] =
    useState<
      "none" |
      "movie" |
      "trailer"
    >("none");

  const [
    portraitActorOpen,
    setPortraitActorOpen,
  ] =
    useState(
      false
    );

  /* =======================================================
     MOVIE QUERY
  ======================================================= */

  const {
    data,
    isLoading,
    isError,
  } =
    useQuery({
      queryKey: [
        "movie-info",
        id,
      ],

      queryFn:
        async () => {
          try {
            const response =
              await fetch(
                `/api/movie-info?id=${encodeURIComponent(
                  id
                )}&vod_id=${encodeURIComponent(
                  id
                )}`
              );

            if (
              response.ok
            ) {
              const json =
                await response.json();

              if (
                json?.info ||
                json?.movie_data
              ) {
                return json;
              }
            }
          } catch {}

          const fallback =
            await fetch(
              `/api/xtream?action=get_vod_info&vod_id=${encodeURIComponent(
                id
              )}`
            );

          if (
            !fallback.ok
          ) {
            throw new Error(
              "Film inaccessible"
            );
          }

          return fallback.json();
        },

      enabled:
        !!id,

      staleTime:
        30 *
        60 *
        1000,

      gcTime:
        60 *
        60 *
        1000,

      retry:
        1,
    });

  /* =======================================================
     LIBRARY
  ======================================================= */

  const favorites =
    useLibrary(
      (
        state
      ) =>
        state.favorites
    );

  const toggleFav =
    useLibrary(
      (
        state
      ) =>
        state.toggleFav
    );

  const progress =
    useLibrary(
      (
        state
      ) =>
        state.progress
    );

  /* =======================================================
     BASIC DATA
  ======================================================= */

  const info =
    data?.info ||
    {};

  const movieData =
    data?.movie_data ||
    {};

  const rawTitle =
    movieData?.name ||
    info?.name ||
    info?.title ||
    movieData?.title ||
    "Film";

  const cleanTitle =
    cleanMovieTitle(
      rawTitle
    ) ||
    "Film";

  const rating =
    ratingNumber(
      info?.rating ||
        movieData?.rating
    );

  const year =
    extractYear(
      info?.releaseDate,
      info?.releasedate,
      info?.release_date,
      movieData?.releasedate,
      rawTitle
    );

  const ext =
    String(
      info?.container_extension ||
        movieData?.container_extension ||
        "mp4"
    );

  const tmdbId =
    info?.tmdb_id ||
    movieData?.tmdb_id ||
    info?.tmdbId ||
    movieData?.tmdbId ||
    null;

  const artwork =
    useMovieArtwork(
      rawTitle,
      tmdbId ||
        undefined
    );

  const logoUrl =
    artwork.logo ||
    null;

  const youtubeTrailerId =
    getYoutubeId(
      info?.youtube_trailer ||
        movieData?.youtube_trailer ||
        info?.trailer ||
        movieData?.trailer ||
        info?.youtube ||
        movieData?.youtube ||
        null
    );

  /* =======================================================
     PRODUCTION
  ======================================================= */

  const {
    data:
      productionData,
  } =
    useQuery<ProductionData>({
      queryKey: [
        "movie-production",
        tmdbId,
        cleanTitle,
        year,
      ],

      queryFn:
        async () => {
          const query =
            new URLSearchParams();

          if (
            tmdbId
          ) {
            query.set(
              "tmdbId",
              String(
                tmdbId
              )
            );
          }

          query.set(
            "title",
            cleanTitle
          );

          if (
            year
          ) {
            query.set(
              "year",
              year
            );
          }

          query.set(
            "type",
            "movie"
          );

          const response =
            await fetch(
              `/api/tmdb/movie-production?${query.toString()}`
            );

          const json =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (
            !response.ok
          ) {
            throw new Error(
              json?.error ||
                "TMDB"
            );
          }

          return json;
        },

      enabled:
        !!cleanTitle,

      staleTime:
        24 *
        60 *
        60 *
        1000,

      gcTime:
        24 *
        60 *
        60 *
        1000,

      retry:
        1,
    });

  const companies =
    Array.isArray(
      productionData
        ?.companies
    )
      ? productionData
          ?.companies ||
        []
      : [];

  const producers =
    Array.isArray(
      productionData
        ?.producers
    )
      ? productionData
          ?.producers ||
        []
      : [];

  const studioName =
    productionData?.studio ||
    companies[0]?.name ||
    info?.production ||
    info?.studio ||
    movieData?.production ||
    movieData?.studio ||
    null;

  const productionLogoUrl =
    safeImage(
      productionData
        ?.studioLogo
    ) ||
    safeImage(
      companies.find(
        (
          company
        ) =>
          company.logo
      )?.logo
    ) ||
    safeImage(
      companies.find(
        (
          company
        ) =>
          company.logoPath
      )?.logoPath
    ) ||
    null;

  const director =
    producers.find(
      (
        producer
      ) =>
        producer.job ===
        "Director"
    )?.name ||
    (
      info?.director
        ? String(
            info.director
          )
            .split(
              ","
            )[0]
            .trim()
        : undefined
    );

  /* =======================================================
     IMAGES
  ======================================================= */

  const currentPoster =
    safeImage(
      artwork.poster
    ) ||
    safeImage(
      info?.cover
    ) ||
    safeImage(
      info?.movie_image
    ) ||
    safeImage(
      info?.cover_big
    ) ||
    safeImage(
      movieData
        ?.stream_icon
    ) ||
    safeImage(
      info?.poster_path
    );

  const rawBackdrop =
    Array.isArray(
      info?.backdrop_path
    )
      ? info
          .backdrop_path[
          0
        ]
      : info?.backdrop_path;

  const backdrop =
    safeImage(
      artwork.backdrop
    ) ||
    safeImage(
      rawBackdrop
    ) ||
    safeImage(
      info?.backdrop
    ) ||
    currentPoster;

  /* =======================================================
     CAST
  ======================================================= */

  const castList =
    useMemo(
      () => {
        if (
          !info?.cast
        ) {
          return [];
        }

        return String(
          info.cast
        )
          .split(",")
          .map(
            (
              actor
            ) =>
              actor.trim()
          )
          .filter(Boolean)
          .slice(
            0,
            20
          );
      },
      [
        info?.cast,
      ]
    );

  const description =
    String(
      info?.plot ||
        info?.description ||
        ""
    );

  const favKey =
    `movies:${id}`;

  const isFavorite =
    !!favorites?.[
      favKey
    ];

  const libraryResumePosition =
    Number(
      progress?.[
        `movie:${id}`
      ]?.position ||
        0
    ) ||
    0;

  const resumePosition =
    resumeFromQuery > 0
      ? resumeFromQuery
      : libraryResumePosition;

  const knownDuration =
    Number(
      info?.duration_secs ||
        movieData?.duration_secs ||
        0
    ) ||
    durationToSeconds(
      info?.duration
    );

  /* =======================================================
     RESET
  ======================================================= */

  useEffect(() => {
    setPortraitActorOpen(
      false
    );

    setPlayerMode(
      "none"
    );
  }, [
    id,
  ]);

  useEffect(() => {
    if (
      resumeFromQuery > 0
    ) {
      setPlayerMode(
        "movie"
      );
    }
  }, [
    id,
    resumeFromQuery,
  ]);

  useEffect(() => {
    if (
      screenMode !==
      "portrait"
    ) {
      setPortraitActorOpen(
        false
      );
    }
  }, [
    screenMode,
  ]);

  /* =======================================================
     ACTIONS
  ======================================================= */

  const goBack =
    useCallback(
      () => {
        if (
          window.history
            .length >
          1
        ) {
          router.back();
        } else {
          router.push(
            "/movies"
          );
        }
      },
      [
        router,
      ]
    );

  const handleFavorite =
    () => {
      toggleFav(
        "movies",
        {
          id:
            Number(id),

          name:
            cleanTitle,

          poster:
            currentPoster ||
            undefined,
        }
      );
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    isLoading ||
    screenMode ===
      null
  ) {
    return (
      <MovieSkeleton />
    );
  }

  if (
    isError ||
    !data ||
    !id
  ) {
    return (
      <main className="grid h-full w-full place-items-center bg-[#060608] text-white/50">
        Impossible de charger le film.
      </main>
    );
  }

  /* =======================================================
     PLAYER
  ======================================================= */

  const renderPlayer =
    () => (
      <div
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
        {playerMode ===
        "none" ? (
          <DirectorShowcase
            portrait={screenMode === "portrait"}
            name={
              director
            }
            backdrop={
              backdrop
            }
            onPlay={() =>
              setPlayerMode(
                "movie"
              )
            }
          />
        ) : playerMode ===
          "movie" ? (
          <GPlayerAdapter
            titleLogo={logoUrl || undefined}
            titleLogoReady={artwork.ready}
  sources={[
    `/api/resolve?type=movie&id=${encodeURIComponent(
      id
    )}&ext=${encodeURIComponent(
      ext
    )}`,
  ]}
            ext={
              ext
            }
            isLive={
              false
            }
            title={
              cleanTitle
            }
            poster={
              backdrop ||
                currentPoster ||
                undefined
            }
            startTime={
              resumePosition >
              0
                ? resumePosition
                : 0
            }
            resumeData={{
              id,
              image:
                currentPoster ||
                backdrop ||
                null,
              title:
                cleanTitle,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black">
            {youtubeTrailerId && (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeTrailerId}?autoplay=1&rel=0`}
                title={`Bande-annonce ${cleanTitle}`}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            )}

            <button
              type="button"
              onClick={() =>
                setPlayerMode(
                  "none"
                )
              }
              className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );

  /* =======================================================
     DESKTOP
  ======================================================= */

  const renderDesktop =
    () => (
      <div className="relative h-full min-h-0">
        <button
          type="button"
          onClick={
            goBack
          }
          className="
            absolute
            left-6
            top-5
            z-40
            inline-flex
            h-9
            items-center
            gap-2
            rounded-full
            border
            border-white/10
            bg-black/45
            px-4
            text-[10px]
            text-white/80
          "
        >
          <ArrowLeft className="h-4 w-4" />

          Retour aux catégories
        </button>

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
                  className={`h-4 w-4 ${
                    isFavorite
                      ? "fill-[#d8ccff] text-[#d8ccff]"
                      : ""
                  }`}
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
                    {cleanTitle}
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

                {info?.genre && (
                  <span>
                    •{" "}
                    {info.genre}
                  </span>
                )}
              </div>

              {description && (
                <p className="mt-5 line-clamp-4 max-w-2xl text-[12px] font-medium leading-[1.65] text-white/78">
                  {description}
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

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPlayerMode(
                      "movie"
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-6 text-[10px] font-bold text-black shadow-[0_8px_24px_rgba(0,0,0,.25)]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />

                  {resumePosition >
                  15
                    ? "Reprendre"
                    : "Regarder"}
                </button>

                {youtubeTrailerId && (
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerMode(
                        "trailer"
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-[#111118]/88 px-5 text-[9px] font-semibold text-white"
                  >
                    <Film className="h-3.5 w-3.5" />

                    Bande-annonce
                  </button>
                )}
              </div>
            </div>

            {/* PLAYER */}

            <div className="aspect-video w-full">
              {renderPlayer()}
            </div>
          </div>

          {/* CASTING */}

          {castList.length >
            0 && (
            <div className="w-full shrink-0">
              <CastingShowcase
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
              />
            </div>
          )}
        </div>
      </div>
    );

  /* =======================================================
     PORTRAIT
  ======================================================= */

  const renderPortrait =
    () => (
      <div className="relative h-full min-h-0 overflow-y-auto overscroll-y-contain" style={{ WebkitOverflowScrolling: "touch" }}>
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
              min-h-0
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
                    className={`h-3.5 w-3.5 ${
                      isFavorite
                        ? "fill-[#d8ccff] text-[#d8ccff]"
                        : ""
                    }`}
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
                    {cleanTitle}
                  </h1>
                )}
              </div>

              {/* META PLUS LISIBLE */}

              <div className="mt-1 flex min-w-0 items-center gap-1.5 flex-wrap rounded-lg bg-[#111118]/90 px-2 py-1 text-[11px] font-medium text-white/95">
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

                {info?.genre && (
                  <span className="text-white/95">
                    •{" "}
                    {info.genre}
                  </span>
                )}
              </div>

              {/* BUTTONS PLUS OPAQUES */}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPlayerMode(
                      "movie"
                    )
                  }
                  className="
                    inline-flex
                    h-9
                    items-center
                    justify-center
                    gap-1.5
                    rounded-full
                    bg-white
                    px-3
                    text-[12px]
                    font-bold
                    text-black
                    shadow-[0_8px_24px_rgba(0,0,0,.28)]
                  "
                >
                  <Play className="h-3 w-3 fill-current" />

                  {resumePosition >
                  15
                    ? "Reprendre"
                    : "Regarder"}
                </button>

                {youtubeTrailerId && (
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerMode(
                        "trailer"
                      )
                    }
                    className="
                      inline-flex
                      h-9
                      items-center
                      justify-center
                      gap-1
                      rounded-full
                      border
                      border-white/25
                      bg-[#111118]/90
                      px-3
                      text-[11px]
                      font-semibold
                      text-white
                      shadow-[0_8px_24px_rgba(0,0,0,.22)]
                    "
                  >
                    <Film className="h-3 w-3" />

                    Bande-annonce
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PLAYER */}

          <div className="h-[clamp(170px,24dvh,260px)] min-h-0 shrink-0">
            {renderPlayer()}
          </div>

          {/* =================================================
              SYNOPSIS
              FIX FLASH + CONTRASTE
          ================================================= */}

          {/* Remove immediately: no exit/layout animation can flash the synopsis. */}
          {!portraitActorOpen && (
            <section aria-label="Synopsis" className="h-[128px] shrink-0 overflow-y-auto overscroll-contain rounded-[15px] border border-white/15 bg-[#09090e]/[0.94] p-3 shadow-[0_12px_35px_rgba(0,0,0,.28)]">
              <p className="text-[13px] font-medium leading-relaxed text-white/95">{description}</p>
            </section>
          )}

          {/* The bio reuses the synopsis height plus the rail height and gap. */}
          <div className={cn("flex flex-1 flex-col", portraitActorOpen ? "min-h-[300px]" : "min-h-[160px]")}
            style={{ flexBasis: portraitActorOpen ? 300 : 160 }}>
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
                  setPortraitActorOpen
                }
              />
            )}
          </div>
        </div>
      </div>
    );

  /* =======================================================
     LANDSCAPE
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
                    className={`h-2.5 w-2.5 ${
                      isFavorite
                        ? "fill-[#d8ccff] text-[#d8ccff]"
                        : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* INFO */}

            <div className="relative z-20 grid min-w-0 grid-cols-[minmax(0,1fr)_82px] items-center gap-2">
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
                      {cleanTitle}
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

                  {info?.genre && (
                    <span className="truncate">
                      •{" "}
                      {info.genre}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 line-clamp-3 text-[6.2px] font-medium leading-[1.45] text-white/68">
                  {description}
                </p>
              </div>

              {/* BUTTONS */}

              <div className="flex h-full flex-col justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPlayerMode(
                      "movie"
                    )
                  }
                  className="inline-flex h-[29px] w-full items-center justify-center gap-1 rounded-full bg-white px-2 text-[5.7px] font-bold text-black"
                >
                  <Play className="h-2.5 w-2.5 fill-current" />

                  Regarder
                </button>

                {youtubeTrailerId && (
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerMode(
                        "trailer"
                      )
                    }
                    className="inline-flex h-[29px] w-full items-center justify-center gap-1 rounded-full border border-white/20 bg-[#111118]/88 px-2 text-[5.1px] font-semibold text-white"
                  >
                    <Film className="h-2.5 w-2.5" />

                    Bande-annonce
                  </button>
                )}
              </div>
            </div>

            {/* PLAYER */}

            <div className="flex min-h-0 items-center justify-center overflow-hidden">
              <div className="aspect-video w-full max-h-full">
                {renderPlayer()}
              </div>
            </div>
          </div>

          {/* CASTING */}

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
              />
            )}
          </div>
        </div>
      </div>
    );

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <main className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#060608] text-white">
      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0">
        {backdrop && (
          <img
            src={
              backdrop
            }
            alt=""
            draggable={
              false
            }
            className="absolute inset-0 h-full w-full object-cover opacity-[0.66]"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/86 via-[45%] to-black/30" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#060608]/92 via-transparent to-black/35" />
      </div>

      {/* UN SEUL LAYOUT = UN SEUL PLAYER */}

      {screenMode ===
      "desktop"
        ? renderDesktop()

        : screenMode ===
          "portrait"
        ? renderPortrait()

        : renderLandscape()}
    </main>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function MovieSkeleton() {
  return (
    <main className="h-full w-full overflow-hidden bg-[#060608] p-4">
      <div className="grid h-full grid-cols-3 gap-4">
        <Skeleton className="rounded-[22px] bg-white/[0.05]" />

        <Skeleton className="rounded-[22px] bg-white/[0.05]" />

        <Skeleton className="rounded-[22px] bg-white/[0.05]" />
      </div>
    </main>
  );
}
