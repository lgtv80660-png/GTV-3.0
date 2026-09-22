"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Clock,
  Heart,
  Maximize,
  Play,
  Plus,
  Star,
  User,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
  type Transition,
} from "framer-motion";

import {
  SmartImage,
} from "@/components/ui/SmartImage";

import {
  Skeleton,
} from "@/components/ui/Skeleton";

import {
  VideoPlayer,
} from "@/components/player/VideoPlayer";

import {
  useSeriesInfo,
} from "@/lib/hooks";

import {
  useLibrary,
} from "@/store/library";

import {
  cleanName,
  cn,
  ratingNum,
  yearFrom,
} from "@/lib/utils";

import type {
  Episode,
} from "@/lib/xtream/types";

/* =========================================================
   CONFIG
========================================================= */

const SERIES_CATEGORIES_ROUTE =
  "/series";

const SEASON_WHEEL_HEIGHT =
  190;

const SEASON_ITEM_HEIGHT =
  46;

const smoothTransition: Transition =
  {
    duration: 0.55,

    ease: [
      0.16,
      1,
      0.3,
      1,
    ],
  };

/* =========================================================
   TYPES
========================================================= */

type SeasonArtwork = {
  poster:
    | string
    | null;

  name: string;

  episodeCount?: number;
};

type FanartData = {
  logo?:
    | string
    | null;

  backdrop?:
    | string
    | null;

  poster?:
    | string
    | null;

  tvdbId?:
    | string
    | number
    | null;

  seasons?: Record<
    string,
    SeasonArtwork
  >;
};

type ActorData = {
  name: string;

  photoUrl:
    | string
    | null;

  bio: string;
};

type EpisodeMeta = {
  imageUrl?:
    | string
    | null;

  overview?:
    | string
    | null;

  name?:
    | string
    | null;

  airDate?:
    | string
    | null;

  voteAverage?:
    | number
    | null;
};

/* =========================================================
   DURATION
========================================================= */

function parseDurationToSeconds(
  value: unknown
): number {
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
      ? value
      : 0;
  }

  const text =
    String(
      value
    ).trim();

  if (!text) {
    return 0;
  }

  /*
    Déjà des secondes.
  */
  if (
    /^\d+(\.\d+)?$/.test(
      text
    )
  ) {
    const value =
      Number(text);

    return Number.isFinite(
      value
    )
      ? value
      : 0;
  }

  /*
    HH:MM:SS / MM:SS
  */
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

function formatDuration(
  seconds: number
) {
  if (
    !seconds ||
    seconds <= 0
  ) {
    return "";
  }

  const total =
    Math.round(
      seconds
    );

  const hours =
    Math.floor(
      total /
        3600
    );

  const minutes =
    Math.floor(
      (
        total %
        3600
      ) /
        60
    );

  if (
    hours > 0
  ) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

/* =========================================================
   FANART
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
    if (!tmdbId) {
      setData({});
      return;
    }

    let mounted =
      true;

    fetch(
      `/api/fanart/series?tmdbId=${tmdbId}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (json) => {
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
        () => {
          if (
            mounted
          ) {
            setData(
              {}
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
  ]);

  return data;
}

/* =========================================================
   EPISODE META
========================================================= */

function useEpisodeMeta({
  episode,
  tmdbId,
  seriesTitle,
  seasonKey,
}: {
  episode:
    | Episode
    | null;

  tmdbId?:
    | string
    | number;

  seriesTitle:
    string;

  seasonKey:
    | string
    | null;
}) {
  const [
    data,
    setData,
  ] =
    useState<EpisodeMeta>(
      {}
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  useEffect(() => {
    if (
      !episode ||
      !seasonKey
    ) {
      setData({});
      setLoading(
        false
      );

      return;
    }

    let mounted =
      true;

    const season =
      seasonKey.replace(
        /\D/g,
        ""
      ) ||
      "1";

    const episodeNumber =
      episode.episode_num ||
      (
        episode as any
      ).episode;

    setLoading(
      true
    );

    fetch(
      `/api/episode-image?tmdbId=${tmdbId || ""}` +
        `&show=${encodeURIComponent(
          seriesTitle
        )}` +
        `&season=${season}` +
        `&episode=${episodeNumber}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (json) => {
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
        () => {
          if (
            mounted
          ) {
            setData(
              {}
            );
          }
        }
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
    episode,
    tmdbId,
    seriesTitle,
    seasonKey,
  ]);

  return {
    data,
    loading,
  };
}

/* =========================================================
   ACTOR MINI
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

  onSelect: (
    actor: ActorData
  ) => void;
}) {
  const [
    data,
    setData,
  ] =
    useState<ActorData>({
      name,

      photoUrl:
        null,

      bio: "",
    });

  useEffect(() => {
    let mounted =
      true;

    fetch(
      `/api/actor-photo?name=${encodeURIComponent(
        name
      )}`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (json) => {
          if (
            !mounted
          ) {
            return;
          }

          setData({
            name,

            photoUrl:
              json?.photoUrl ||
              null,

            bio:
              json?.bio ||
              "Biographie non disponible.",
          });
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
    name,
  ]);

  return (
    <motion.button
      layout
      type="button"
      draggable={
        false
      }
      onClick={() =>
        onSelect(
          data
        )
      }
      transition={
        smoothTransition
      }
      className={cn(
        `
        group
        relative
        shrink-0
        overflow-hidden
        rounded-2xl
        border
        select-none
        backdrop-blur-xl
        transition-colors
        duration-300
        `,

        compact
          ? `
            w-[58px]
            sm:w-[64px]
            aspect-[3/4]
          `
          : `
            w-[72px]
            sm:w-[82px]
            aspect-[3/4]
          `,

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
          className="
            pointer-events-none
            absolute
            inset-0
            h-full
            w-full
            select-none
            object-cover
          "
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
          className="absolute inset-0 rounded-2xl ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]"
        />
      )}

      <p className="pointer-events-none absolute bottom-2 left-2 right-2 truncate text-[9px] font-medium text-white/85 sm:text-[10px]">
        {name}
      </p>
    </motion.button>
  );
}

/* =========================================================
   CASTING
========================================================= */

function CastingShowcase({
  actors,
}: {
  actors: string[];
}) {
  const [
    selected,
    setSelected,
  ] =
    useState<
      ActorData | null
    >(null);

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

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rail =
      railRef.current;

    if (!rail) {
      return;
    }

    mouseDown.current =
      true;

    dragged.current =
      false;

    startX.current =
      e.clientX;

    startScroll.current =
      rail.scrollLeft;
  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rail =
      railRef.current;

    if (
      !rail ||
      !mouseDown.current
    ) {
      return;
    }

    const delta =
      e.clientX -
      startX.current;

    if (
      Math.abs(
        delta
      ) > 5
    ) {
      dragged.current =
        true;
    }

    if (
      !dragged.current
    ) {
      return;
    }

    e.preventDefault();

    rail.scrollLeft =
      startScroll.current -
      delta *
        1.15;
  };

  const stopMouseDrag =
    () => {
      mouseDown.current =
        false;

      setTimeout(
        () => {
          dragged.current =
            false;
        },
        70
      );
    };

  const selectActor = (
    actor: ActorData
  ) => {
    if (
      dragged.current
    ) {
      return;
    }

    if (
      selected?.name ===
      actor.name
    ) {
      setSelected(
        null
      );

      return;
    }

    setSelected(
      actor
    );
  };

  return (
    <div className="mt-7 border-t border-white/[0.07] pt-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d8ccff] shadow-[0_0_14px_rgba(216,204,255,.8)]" />

        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">
          Casting / Acteurs
        </p>
      </div>

      <motion.div
        layout
        transition={
          smoothTransition
        }
        className="relative overflow-hidden rounded-[25px] border border-white/[0.10] bg-white/[0.04] p-3 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_18px_50px_rgba(0,0,0,.24)] sm:p-4"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-white/[0.10] to-transparent" />

        <div className="pointer-events-none absolute -left-8 -top-8 h-36 w-36 rounded-full bg-[#d8ccff]/[0.06] blur-3xl" />

        <motion.div
          layout
          transition={
            smoothTransition
          }
          className="relative z-10 flex min-w-0 items-stretch gap-4"
        >
          <motion.div
            layout
            transition={
              smoothTransition
            }
            className={cn(
              "flex min-w-0 items-center overflow-hidden",

              selected
                ? "w-[46%]"
                : "w-full"
            )}
          >
            <div className="relative min-w-0 w-full overflow-hidden">
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
                }}
                className="flex min-w-0 w-full gap-2.5 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none select-none cursor-grab active:cursor-grabbing"
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

              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#111116]/90 to-transparent" />
            </div>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {selected && (
              <motion.div
                layout
                key={
                  selected.name
                }
                initial={{
                  opacity:
                    0,

                  x:
                    65,

                  scale:
                    0.95,
                }}
                animate={{
                  opacity:
                    1,

                  x:
                    0,

                  scale:
                    1,
                }}
                exit={{
                  opacity:
                    0,

                  x:
                    45,

                  scale:
                    0.97,
                }}
                transition={
                  smoothTransition
                }
                className="relative w-[54%] min-h-[180px] overflow-hidden rounded-[22px] border border-white/[0.11] bg-[#0d0d12]/90 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
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
                    transition={{
                      duration:
                        0.65,

                      ease: [
                        0.16,
                        1,
                        0.3,
                        1,
                      ],
                    }}
                    src={
                      selected.photoUrl
                    }
                    alt={
                      selected.name
                    }
                    className="absolute right-0 top-0 h-full w-[52%] object-cover"
                  />
                )}

                <div className="pointer-events-none absolute right-0 top-0 h-full w-[52%] bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />

                <div className="absolute inset-0 bg-gradient-to-r from-[#101015] via-[#101015]/98 via-[52%] to-transparent" />

                <div className="absolute inset-0 bg-gradient-to-t from-[#101015]/70 via-transparent to-transparent" />

                <motion.div
                  key={`${selected.name}-text`}
                  initial={{
                    opacity:
                      0,

                    x:
                      -14,
                  }}
                  animate={{
                    opacity:
                      1,

                    x:
                      0,
                  }}
                  transition={{
                    delay:
                      0.07,

                    ...smoothTransition,
                  }}
                  className="relative z-10 max-w-[62%] p-5 sm:p-6"
                >
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[#d8ccff]/75">
                    Distribution
                  </p>

                  <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                    {
                      selected.name
                    }
                  </h3>

                  <p className="mt-3 line-clamp-4 text-[11px] leading-5 text-white/50 sm:text-xs sm:leading-6">
                    {
                      selected.bio
                    }
                  </p>
                </motion.div>

                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      null
                    )
                  }
                  className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/25 text-white/45 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
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
   SEASON WHEEL
========================================================= */

function SeasonWheel({
  seasons,
  activeSeasonKey,
  onSelect,
}: {
  seasons:
    string[];

  activeSeasonKey:
    | string
    | null;

  onSelect: (
    season: string
  ) => void;
}) {
  const wheelRef =
    useRef<HTMLDivElement>(
      null
    );

  const itemRefs =
    useRef<
      Record<
        string,
        HTMLButtonElement | null
      >
    >({});

  const scrollTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const mouseDown =
    useRef(false);

  const didDrag =
    useRef(false);

  const startY =
    useRef(0);

  const startScroll =
    useRef(0);

  const initialized =
    useRef(false);

  const padding =
    (
      SEASON_WHEEL_HEIGHT -
      SEASON_ITEM_HEIGHT
    ) /
    2;

  const normalizeSeason = (
    season: string
  ) =>
    season.replace(
      /\D/g,
      ""
    ) ||
    season;

  const centerSeason = (
    season: string,

    behavior:
      ScrollBehavior =
      "smooth"
  ) => {
    const wheel =
      wheelRef.current;

    const item =
      itemRefs.current[
        season
      ];

    if (
      !wheel ||
      !item
    ) {
      return;
    }

    const top =
      item.offsetTop -
      wheel.clientHeight /
        2 +
      item.clientHeight /
        2;

    wheel.scrollTo({
      top,
      behavior,
    });
  };

  const findCenteredSeason =
    () => {
      const wheel =
        wheelRef.current;

      if (!wheel) {
        return null;
      }

      const center =
        wheel.scrollTop +
        wheel.clientHeight /
          2;

      let result:
        | string
        | null =
        null;

      let distance =
        Infinity;

      for (
        const season of
        seasons
      ) {
        const item =
          itemRefs.current[
            season
          ];

        if (!item) {
          continue;
        }

        const itemCenter =
          item.offsetTop +
          item.clientHeight /
            2;

        const currentDistance =
          Math.abs(
            itemCenter -
              center
          );

        if (
          currentDistance <
          distance
        ) {
          distance =
            currentDistance;

          result =
            season;
        }
      }

      return result;
    };

  const settleWheel =
    () => {
      const season =
        findCenteredSeason();

      if (!season) {
        return;
      }

      centerSeason(
        season
      );

      if (
        season !==
        activeSeasonKey
      ) {
        onSelect(
          season
        );
      }
    };

  useEffect(() => {
    if (
      initialized.current ||
      !activeSeasonKey
    ) {
      return;
    }

    const timer =
      setTimeout(
        () => {
          centerSeason(
            activeSeasonKey,
            "auto"
          );

          initialized.current =
            true;
        },
        80
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    activeSeasonKey,
  ]);

  const handleScroll =
    () => {
      if (
        scrollTimer.current
      ) {
        clearTimeout(
          scrollTimer.current
        );
      }

      scrollTimer.current =
        setTimeout(
          () => {
            if (
              !mouseDown.current
            ) {
              settleWheel();
            }
          },
          130
        );
    };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const wheel =
      wheelRef.current;

    if (!wheel) {
      return;
    }

    mouseDown.current =
      true;

    didDrag.current =
      false;

    startY.current =
      e.clientY;

    startScroll.current =
      wheel.scrollTop;
  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const wheel =
      wheelRef.current;

    if (
      !wheel ||
      !mouseDown.current
    ) {
      return;
    }

    const delta =
      e.clientY -
      startY.current;

    if (
      Math.abs(
        delta
      ) > 3
    ) {
      didDrag.current =
        true;
    }

    if (
      !didDrag.current
    ) {
      return;
    }

    e.preventDefault();

    wheel.scrollTop =
      startScroll.current -
      delta *
        1.15;
  };

  const stopDrag =
    () => {
      if (
        !mouseDown.current
      ) {
        return;
      }

      mouseDown.current =
        false;

      if (
        didDrag.current
      ) {
        setTimeout(
          settleWheel,
          30
        );
      }

      setTimeout(
        () => {
          didDrag.current =
            false;
        },
        90
      );
    };

  return (
    <div
      style={{
        height:
          SEASON_WHEEL_HEIGHT,
      }}
      className="relative w-full shrink-0 overflow-hidden rounded-[22px] border border-white/[0.10] bg-white/[0.035] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.11)]"
    >
      <div
        style={{
          height:
            SEASON_ITEM_HEIGHT,
        }}
        className="pointer-events-none absolute left-3 right-3 top-1/2 z-10 -translate-y-1/2 rounded-[14px] border border-[#d8ccff]/25 bg-[#d8ccff]/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,.10)]"
      />

      <div
        ref={
          wheelRef
        }
        onScroll={
          handleScroll
        }
        onMouseDown={
          handleMouseDown
        }
        onMouseMove={
          handleMouseMove
        }
        onMouseUp={
          stopDrag
        }
        onMouseLeave={
          stopDrag
        }
        style={{
          paddingTop:
            padding,

          paddingBottom:
            padding,

          WebkitOverflowScrolling:
            "touch",
        }}
        className="relative z-20 h-full overflow-y-auto overscroll-y-contain snap-y snap-mandatory scrollbar-none select-none cursor-grab active:cursor-grabbing"
      >
        {seasons.map(
          (
            season
          ) => {
            const active =
              activeSeasonKey ===
              season;

            return (
              <button
                ref={(
                  node
                ) => {
                  itemRefs.current[
                    season
                  ] =
                    node;
                }}
                key={
                  season
                }
                type="button"
                style={{
                  height:
                    SEASON_ITEM_HEIGHT,
                }}
                onClick={() => {
                  if (
                    didDrag.current
                  ) {
                    return;
                  }

                  onSelect(
                    season
                  );

                  centerSeason(
                    season
                  );
                }}
                className={cn(
                  "snap-center flex w-full shrink-0 items-center justify-center text-sm transition-all duration-300",

                  active
                    ? "scale-[1.08] font-semibold text-white opacity-100"
                    : "scale-[0.92] font-medium text-white/30 opacity-60 hover:text-white/60"
                )}
              >
                Saison{" "}
                {normalizeSeason(
                  season
                )}
              </button>
            );
          }
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-12 bg-gradient-to-b from-[#0a0a0d] via-[#0a0a0d]/85 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-12 bg-gradient-to-t from-[#0a0a0d] via-[#0a0a0d]/85 to-transparent" />
    </div>
  );
}

/* =========================================================
   EPISODE IMAGE
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
    string;
}) {
  const [
    imgSrc,
    setImgSrc,
  ] =
    useState<
      string | null
    >(
      ep.info
        ?.movie_image ||
        null
    );

  useEffect(() => {
    if (
      ep.info
        ?.movie_image
    ) {
      setImgSrc(
        ep.info
          .movie_image
      );

      return;
    }

    let mounted =
      true;

    const season =
      seasonKey.replace(
        /\D/g,
        ""
      ) ||
      "1";

    fetch(
      `/api/episode-image?tmdbId=${tmdbId || ""}` +
        `&show=${encodeURIComponent(
          seriesTitle
        )}` +
        `&season=${season}` +
        `&episode=${
          ep.episode_num ||
          ep.episode
        }`
    )
      .then(
        (
          response
        ) =>
          response.json()
      )
      .then(
        (json) => {
          if (
            mounted &&
            json?.imageUrl
          ) {
            setImgSrc(
              json.imageUrl
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
    ep,
    seriesTitle,
    tmdbId,
    seasonKey,
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
      className="h-full w-full object-cover pointer-events-none"
    />
  );
}

/* =========================================================
   PAGE
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
    useSeriesInfo(
      id
    );

  const {
    isFav,
    toggleFav,
    progress,
  } =
    useLibrary();

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
    useState<
      Episode | null
    >(null);

  /*
    Nouvelle durée fiable de l'épisode.
  */
  const [
    activeEpisodeDuration,
    setActiveEpisodeDuration,
  ] =
    useState(0);

  const [
    durationLoading,
    setDurationLoading,
  ] =
    useState(false);

  const playerContainerRef =
    useRef<HTMLDivElement>(
      null
    );

  const episodeListRef =
    useRef<HTMLDivElement>(
      null
    );

  const lastTapRef =
    useRef(0);

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

  const title =
    info?.name ||
    info?.title ||
    "Série";

  const cleanTitle =
    cleanName(
      title
    );

  const tmdbId =
    info?.tmdb_id ||
    info?.tmdbId;

  const fanart =
    useFanartSeries(
      tmdbId
    );

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
            (
              season
            ) =>
              (
                episodesBySeason[
                  season
                ] ||
                []
              ).length >
              0
          )
          .sort(
            (
              a,
              b
            ) => {
              const na =
                parseInt(
                  a.replace(
                    /\D/g,
                    ""
                  ),
                  10
                ) ||
                0;

              const nb =
                parseInt(
                  b.replace(
                    /\D/g,
                    ""
                  ),
                  10
                ) ||
                0;

              return (
                na -
                nb
              );
            }
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
        ] ||
        []
      : [];

  /* =======================================================
     CAST
  ======================================================= */

  const castList =
    useMemo(() => {
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
          (value) =>
            value.trim()
        )
        .filter(
          Boolean
        );
    }, [
      info?.cast,
    ]);

  /* =======================================================
     META
  ======================================================= */

  const rating =
    ratingNum(
      info?.rating
    );

  const year =
    yearFrom(
      info?.releaseDate ||
        info?.releasedate,
      title
    );

  const backdrop =
    fanart?.backdrop ||
    info?.backdrop_path?.[
      0
    ] ||
    info?.backdrop ||
    info?.cover;

  const basePoster =
    fanart?.poster ||
    info?.cover;

  const selectedSeasonNumber =
    activeSeasonKey?.replace(
      /\D/g,
      ""
    ) ||
    "";

  const selectedSeasonPoster =
    selectedSeasonNumber
      ? fanart
          ?.seasons?.[
          selectedSeasonNumber
        ]?.poster
      : null;

  const currentPoster =
    selectedSeasonPoster ||
    basePoster;

  const fav =
    isFav(
      "series",
      Number(id)
    );

  /* =======================================================
     EPISODE META
  ======================================================= */

  const {
    data:
      activeEpisodeMeta,

    loading:
      activeEpisodeMetaLoading,
  } =
    useEpisodeMeta({
      episode:
        activeEpisode,

      tmdbId,

      seriesTitle:
        cleanTitle,

      seasonKey:
        activeSeasonKey,
    });

  /* =======================================================
     DURATION API
  ======================================================= */

  useEffect(() => {
    if (
      !activeEpisode
    ) {
      setActiveEpisodeDuration(
        0
      );

      setDurationLoading(
        false
      );

      return;
    }

    /*
      D'abord on regarde si le host a déjà
      fourni une durée dans get_series_info.
    */
    const localDuration =
      parseDurationToSeconds(
        (
          activeEpisode as any
        )?.info
          ?.duration_secs
      ) ||
      parseDurationToSeconds(
        (
          activeEpisode as any
        )?.info
          ?.duration
      ) ||
      parseDurationToSeconds(
        (
          activeEpisode as any
        )?.duration_secs
      ) ||
      parseDurationToSeconds(
        (
          activeEpisode as any
        )?.duration
      );

    if (
      localDuration >
      0
    ) {
      setActiveEpisodeDuration(
        localDuration
      );

      setDurationLoading(
        false
      );

      return;
    }

    const episodeId =
      (
        activeEpisode as any
      )?.id ??
      (
        activeEpisode as any
      )?.stream_id;

    if (
      !episodeId ||
      !id
    ) {
      setActiveEpisodeDuration(
        0
      );

      setDurationLoading(
        false
      );

      return;
    }

    /*
      Aucun accès au fichier MKV ici.

      Cette route doit uniquement utiliser
      player_api.php / get_series_info.
    */
    let mounted =
      true;

    setActiveEpisodeDuration(
      0
    );

    setDurationLoading(
      true
    );

    fetch(
      `/api/media-info?type=series` +
        `&seriesId=${encodeURIComponent(
          id
        )}` +
        `&episodeId=${encodeURIComponent(
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
            throw new Error(
              `media-info ${response.status}`
            );
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

          console.log(
            "[GTV SERIES MEDIA INFO]",
            json
          );

          if (
            Number.isFinite(
              value
            ) &&
            value > 0
          ) {
            setActiveEpisodeDuration(
              value
            );
          } else {
            setActiveEpisodeDuration(
              0
            );
          }
        }
      )
      .catch(
        (err) => {
          console.warn(
            "[GTV SERIES] durée indisponible:",
            err
          );

          if (
            mounted
          ) {
            setActiveEpisodeDuration(
              0
            );
          }
        }
      )
      .finally(
        () => {
          if (
            mounted
          ) {
            setDurationLoading(
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
    activeEpisode,
    id,
  ]);

  /* =======================================================
     RESUME
  ======================================================= */

  const resumeEpisode =
    useMemo(() => {
      let candidate:
        | {
            episode:
              Episode;

            season:
              string;

            position:
              number;
          }
        | null =
        null;

      for (
        const season of
        seasons
      ) {
        for (
          const ep of
          episodesBySeason[
            season
          ] ||
          []
        ) {
          const position =
            progress[
              `series:${ep.id}`
            ]?.position ??
            0;

          if (
            position >
            15
          ) {
            candidate = {
              episode:
                ep,

              season,

              position,
            };
          }
        }
      }

      return candidate;
    }, [
      seasons,
      episodesBySeason,
      progress,
    ]);

  /* =======================================================
     EPISODE LIST DRAG
  ======================================================= */

  const episodeMouseDown =
    useRef(false);

  const episodeStartY =
    useRef(0);

  const episodeScrollStart =
    useRef(0);

  const [
    episodeDragging,
    setEpisodeDragging,
  ] =
    useState(false);

  const handleEpisodeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const element =
      episodeListRef.current;

    if (!element) {
      return;
    }

    episodeMouseDown.current =
      true;

    setEpisodeDragging(
      false
    );

    episodeStartY.current =
      e.clientY;

    episodeScrollStart.current =
      element.scrollTop;
  };

  const handleEpisodeMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const element =
      episodeListRef.current;

    if (
      !element ||
      !episodeMouseDown.current
    ) {
      return;
    }

    const delta =
      e.clientY -
      episodeStartY.current;

    if (
      Math.abs(
        delta
      ) > 5
    ) {
      setEpisodeDragging(
        true
      );

      e.preventDefault();
    }

    element.scrollTop =
      episodeScrollStart.current -
      delta;
  };

  const stopEpisodeDrag =
    () => {
      episodeMouseDown.current =
        false;

      setTimeout(
        () => {
          setEpisodeDragging(
            false
          );
        },
        60
      );
    };

  /* =======================================================
     FULLSCREEN
  ======================================================= */

  const handleFullscreen =
    async () => {
      const element =
        playerContainerRef.current;

      if (!element) {
        return;
      }

      try {
        await element.requestFullscreen?.();

        if (
          window.screen
            ?.orientation &&
          "lock" in
            window.screen
              .orientation
        ) {
          await (
            window.screen
              .orientation as any
          )
            .lock(
              "landscape"
            )
            .catch(
              () => {}
            );
        }
      } catch {}
    };

  const handleDoubleTap =
    () => {
      const now =
        Date.now();

      if (
        now -
          lastTapRef.current <
        300
      ) {
        handleFullscreen();
      }

      lastTapRef.current =
        now;
    };

  /* =======================================================
     STATES
  ======================================================= */

  if (
    isLoading
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
      <div className="min-h-screen grid place-items-center bg-[#060608] text-white/40">
        Impossible de charger la série.
      </div>
    );
  }

  /* =======================================================
     PLAYER RESUME
  ======================================================= */

  const activeResumePosition =
    activeEpisode
      ? progress[
          `series:${activeEpisode.id}`
        ]?.position ??
        0
      : 0;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#060608] text-white">
      {/* =================================================
          HERO
      ================================================= */}

      <section className="relative overflow-hidden">
        {backdrop && (
          <motion.img
            key={
              backdrop
            }
            initial={{
              opacity:
                0,

              scale:
                1.025,
            }}
            animate={{
              opacity:
                1,

              scale:
                1,
            }}
            transition={{
              duration:
                0.9,
            }}
            src={
              backdrop
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/92 via-[43%] to-[#060608]/10" />

        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent via-[68%] to-transparent" />

        {/* BACK */}

        <button
          type="button"
          onClick={() => {
            if (
              window.history
                .length >
              1
            ) {
              router.back();
            } else {
              router.push(
                SERIES_CATEGORIES_ROUTE
              );
            }
          }}
          className="absolute left-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-black/25 px-4 text-xs font-medium text-white/70 backdrop-blur-2xl transition hover:bg-white/[0.10] hover:text-white sm:left-7 lg:left-8"
        >
          <ArrowLeft className="h-4 w-4" />

          Retour aux catégories
        </button>

        <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-10 pt-24 sm:px-7 lg:px-12 lg:pb-12 lg:pt-[110px]">
          <div className="grid items-stretch gap-8 lg:grid-cols-[185px_minmax(0,800px)] lg:gap-10">
            {/* LEFT */}

            <div className="hidden lg:flex lg:flex-col">
              <div className="relative aspect-[2/3] w-full shrink-0">
                <AnimatePresence mode="wait">
                  {currentPoster && (
                    <motion.div
                      key={
                        currentPoster
                      }
                      initial={{
                        opacity:
                          0,

                        scale:
                          1.025,
                      }}
                      animate={{
                        opacity:
                          1,

                        scale:
                          1,
                      }}
                      exit={{
                        opacity:
                          0,

                        scale:
                          0.99,
                      }}
                      transition={{
                        duration:
                          0.4,
                      }}
                      className="absolute inset-0 overflow-hidden rounded-[24px] border border-white/[0.14] bg-white/[0.03] shadow-[0_25px_70px_rgba(0,0,0,.48)]"
                    >
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

                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.10] to-transparent" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="min-h-4 flex-1" />

              {seasons.length >
                0 && (
                <SeasonWheel
                  seasons={
                    seasons
                  }
                  activeSeasonKey={
                    activeSeasonKey
                  }
                  onSelect={(
                    season
                  ) => {
                    setSeasonKey(
                      season
                    );

                    setActiveEpisode(
                      null
                    );
                  }}
                />
              )}
            </div>

            {/* RIGHT */}

            <div className="flex min-w-0 flex-col">
              {fanart?.logo ? (
                <img
                  src={
                    fanart.logo
                  }
                  alt={
                    cleanTitle
                  }
                  className="max-h-[130px] max-w-[80vw] object-contain object-left drop-shadow-[0_16px_30px_rgba(0,0,0,.65)] sm:max-h-[150px] sm:max-w-[500px]"
                />
              ) : (
                <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[64px]">
                  {
                    cleanTitle
                  }
                </h1>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/55 sm:text-sm">
                {rating >
                  0 && (
                  <span className="flex items-center gap-1.5 text-[#d8ccff]">
                    <Star className="h-4 w-4 fill-current" />

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

                {seasons.length >
                  0 && (
                  <span>
                    •{" "}
                    {
                      seasons.length
                    }{" "}
                    saison
                    {seasons.length >
                    1
                      ? "s"
                      : ""}
                  </span>
                )}

                {info?.genre && (
                  <span>
                    •{" "}
                    {
                      info.genre
                    }
                  </span>
                )}
              </div>

              {(info?.plot ||
                info?.description) && (
                <p className="mt-5 max-w-2xl line-clamp-3 text-sm leading-7 text-white/58 sm:text-[15px]">
                  {info.plot ||
                    info.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      resumeEpisode
                    ) {
                      setSeasonKey(
                        resumeEpisode.season
                      );

                      setActiveEpisode(
                        resumeEpisode.episode
                      );
                    } else if (
                      episodes[
                        0
                      ]
                    ) {
                      setActiveEpisode(
                        episodes[
                          0
                        ]
                      );
                    }
                  }}
                  className="relative h-12 overflow-hidden rounded-full border border-white/20 bg-white/[0.10] px-6 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.24),0_14px_45px_rgba(0,0,0,.35)] transition hover:scale-[1.02] hover:bg-white/[0.16]"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Play className="h-4 w-4 fill-current" />

                    {resumeEpisode
                      ? "Reprendre"
                      : "Regarder"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleFav(
                      "series",
                      {
                        id:
                          Number(
                            id
                          ),

                        name:
                          cleanTitle,

                        poster:
                          basePoster,
                      }
                    )
                  }
                  className="flex h-12 items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-5 text-sm text-white/75 backdrop-blur-2xl transition hover:bg-white/10 hover:text-white"
                >
                  {fav ? (
                    <Heart className="h-4 w-4 fill-[#d8ccff] text-[#d8ccff]" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  Ma liste
                </button>
              </div>

              <div className="mt-auto">
                {castList.length >
                  0 && (
                  <CastingShowcase
                    actors={
                      castList
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================
          MOBILE POSTER / SEASONS
      ================================================= */}

      {seasons.length >
        0 && (
        <section className="mx-auto max-w-[1600px] px-4 pb-8 sm:px-7 lg:hidden">
          <div className="grid grid-cols-[112px_minmax(0,1fr)] items-end gap-4">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[20px] border border-white/[0.12] bg-white/[0.03]">
              {currentPoster && (
                <motion.img
                  key={
                    currentPoster
                  }
                  src={
                    currentPoster
                  }
                  alt={
                    cleanTitle
                  }
                  initial={{
                    opacity:
                      0,
                  }}
                  animate={{
                    opacity:
                      1,
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>

            <SeasonWheel
              seasons={
                seasons
              }
              activeSeasonKey={
                activeSeasonKey
              }
              onSelect={(
                season
              ) => {
                setSeasonKey(
                  season
                );

                setActiveEpisode(
                  null
                );
              }}
            />
          </div>
        </section>
      )}

      {/* =================================================
          EPISODES
      ================================================= */}

      <section className="mx-auto max-w-[1600px] px-4 pb-28 sm:px-7 lg:px-12">
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
            Saison{" "}
            {
              selectedSeasonNumber
            }
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Épisodes
          </h2>
        </div>

        <div className="mb-6 h-px bg-white/[0.07]" />

        {/* =================================================
            PLAYER
        ================================================= */}

        <AnimatePresence mode="popLayout">
          {activeEpisode && (
            <motion.div
              key="episode-player"
              initial={{
                opacity:
                  0,

                y:
                  16,

                scale:
                  0.99,
              }}
              animate={{
                opacity:
                  1,

                y:
                  0,

                scale:
                  1,
              }}
              exit={{
                opacity:
                  0,

                y:
                  10,
              }}
              transition={
                smoothTransition
              }
              className="mb-6 w-full"
            >
              <div className="overflow-hidden rounded-[25px] border border-white/[0.12] bg-white/[0.035] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_20px_60px_rgba(0,0,0,.30)]">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,38%)_1fr]">
                  {/* PLAYER */}

                  <div className="p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-[#d8ccff]/75">
                          Saison{" "}
                          {
                            selectedSeasonNumber
                          }
                        </p>

                        <p className="mt-0.5 truncate text-sm font-medium text-white/85">
                          Épisode{" "}
                          {activeEpisode.episode_num ||
                            (
                              activeEpisode as any
                            ).episode}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={
                            handleFullscreen
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white"
                        >
                          <Maximize className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveEpisode(
                              null
                            )
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={
                        playerContainerRef
                      }
                      onClick={
                        handleDoubleTap
                      }
                      className="relative aspect-video overflow-hidden rounded-[17px] border border-white/[0.07] bg-black"
                    >
                      {/* TEST TEMPORAIRE DE DURÉE */}

                      <div className="pointer-events-none absolute right-3 top-3 z-40 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur-xl">
                        {durationLoading
                          ? "Recherche durée…"
                          : activeEpisodeDuration >
                              0
                            ? `Durée API : ${formatDuration(
                                activeEpisodeDuration
                              )}`
                            : "Durée API indisponible"}
                      </div>

                      <VideoPlayer
                        key={
                          activeEpisode.id
                        }
                        sources={[
                          `/api/stream-vod?type=series&id=${activeEpisode.id}&ext=${
                            activeEpisode.container_extension ||
                            "mkv"
                          }`,
                        ]}
                        ext={
                          activeEpisode.container_extension ||
                          "mkv"
                        }
                        isLive={
                          false
                        }
                        mediaType="series"
                        title={
                          activeEpisode.title ||
                          `${cleanTitle} · S${
                            selectedSeasonNumber ||
                            "1"
                          }E${
                            activeEpisode.episode_num ||
                            (
                              activeEpisode as any
                            ).episode ||
                            ""
                          }`
                        }
                        poster={
                          activeEpisodeMeta?.imageUrl ||
                          activeEpisode.info
                            ?.movie_image ||
                          backdrop ||
                          currentPoster
                        }
                        /*
                          IMPORTANT :

                          le player ne demandera PAS ffprobe.

                          Il ne connaît la vraie durée que par ceci.
                        */
                        knownDuration={
                          activeEpisodeDuration
                        }
                        /*
                          Si cet épisode avait déjà une progression,
                          on repart directement à cet endroit.

                          Pour stream-vod cela devient &t=.
                        */
                        startTime={
                          activeResumePosition >
                          15
                            ? activeResumePosition
                            : 0
                        }
                      />
                    </div>
                  </div>

                  {/* EPISODE INFO */}

                  <div className="flex flex-col justify-center border-t border-white/[0.07] p-5 sm:p-6 lg:border-l lg:border-t-0">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-[#d8ccff]/70">
                      À propos de cet épisode
                    </p>

                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-white/90 sm:text-2xl">
                      {activeEpisodeMeta?.name ||
                        cleanName(
                          activeEpisode.title ||
                            `Épisode ${
                              activeEpisode.episode_num ||
                              (
                                activeEpisode as any
                              ).episode
                            }`
                        )}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                      {activeEpisodeDuration >
                      0 ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />

                          {formatDuration(
                            activeEpisodeDuration
                          )}
                        </span>
                      ) : activeEpisode.info
                          ?.duration ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />

                          {
                            activeEpisode
                              .info
                              .duration
                          }
                        </span>
                      ) : null}

                      {activeEpisodeMeta?.airDate && (
                        <>
                          <span>
                            •
                          </span>

                          <span>
                            {
                              activeEpisodeMeta.airDate
                            }
                          </span>
                        </>
                      )}

                      {Number(
                        activeEpisodeMeta?.voteAverage
                      ) >
                        0 && (
                        <>
                          <span>
                            •
                          </span>

                          <span className="flex items-center gap-1 text-[#d8ccff]/80">
                            <Star className="h-3 w-3 fill-current" />

                            {Number(
                              activeEpisodeMeta.voteAverage
                            ).toFixed(
                              1
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-5">
                      {activeEpisodeMetaLoading ? (
                        <div className="space-y-2">
                          <div className="h-3 w-full rounded-full bg-white/[0.06]" />

                          <div className="h-3 w-[94%] rounded-full bg-white/[0.06]" />

                          <div className="h-3 w-[78%] rounded-full bg-white/[0.06]" />
                        </div>
                      ) : (
                        <p className="max-w-2xl line-clamp-6 text-xs leading-6 text-white/48 sm:text-sm sm:leading-7">
                          {activeEpisodeMeta?.overview ||
                            "Aucun synopsis détaillé disponible pour cet épisode."}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <Link
                        href={`/watch?type=series&id=${activeEpisode.id}&ext=${
                          activeEpisode.container_extension ||
                          "mp4"
                        }&title=${encodeURIComponent(
                          `${cleanTitle} · ${
                            activeEpisode.title ||
                            `Épisode ${
                              activeEpisode.episode_num ||
                              (
                                activeEpisode as any
                              ).episode
                            }`
                          }`
                        )}&series=${id}${
                          activeResumePosition >
                          15
                            ? `&resume=${Math.floor(
                                activeResumePosition
                              )}`
                            : ""
                        }`}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.07] px-4 text-xs font-medium text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                      >
                        <Maximize className="h-3.5 w-3.5" />

                        Ouvrir en grand
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =================================================
            LIST
        ================================================= */}

        <div
          ref={
            episodeListRef
          }
          onMouseDown={
            handleEpisodeMouseDown
          }
          onMouseMove={
            handleEpisodeMouseMove
          }
          onMouseUp={
            stopEpisodeDrag
          }
          onMouseLeave={
            stopEpisodeDrag
          }
          className="max-h-[68vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-none"
        >
          {episodes.map(
            (
              ep:
                Episode
            ) => {
              const selected =
                activeEpisode?.id ===
                ep.id;

              const num =
                ep.episode_num ||
                (
                  ep as any
                ).episode;

              const episodeTitle =
                ep.title ||
                `Épisode ${num}`;

              const resume =
                progress[
                  `series:${ep.id}`
                ]?.position ??
                0;

              const durationSeconds =
                parseDurationToSeconds(
                  (
                    ep.info as any
                  )
                    ?.duration_secs
                ) ||
                parseDurationToSeconds(
                  (
                    ep.info as any
                  )
                    ?.duration
                );

              const percent =
                durationSeconds >
                0
                  ? Math.min(
                      100,

                      (
                        resume /
                        durationSeconds
                      ) *
                        100
                    )
                  : 0;

              const ext =
                ep.container_extension ||
                "mp4";

              return (
                <motion.div
                  layout
                  key={
                    ep.id
                  }
                  onClick={() => {
                    if (
                      !episodeDragging
                    ) {
                      setActiveEpisode(
                        ep
                      );
                    }
                  }}
                  className={cn(
                    `
                    group
                    relative
                    flex
                    items-center
                    gap-3
                    overflow-hidden
                    rounded-[20px]
                    border
                    p-2
                    cursor-pointer
                    transition-all
                    duration-300
                    sm:gap-4
                    sm:p-2.5
                    `,

                    selected
                      ? `
                        border-[#d8ccff]/35
                        bg-[#d8ccff]/[0.065]
                      `
                      : `
                        border-white/[0.06]
                        bg-white/[0.025]
                        hover:bg-white/[0.055]
                        hover:border-white/[0.12]
                      `
                  )}
                >
                  {/* IMAGE */}

                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[14px] bg-black sm:w-40">
                    <EpisodeImage
                      ep={
                        ep
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
                        currentPoster
                      }
                    />

                    {percent >
                      0 && (
                      <div className="absolute left-2 right-2 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/20">
                        <div
                          style={{
                            width: `${percent}%`,
                          }}
                          className="h-full rounded-full bg-gradient-to-r from-[#aa95ff] to-[#eeeaff]"
                        />
                      </div>
                    )}
                  </div>

                  {/* INFO */}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80 sm:text-sm">
                      <span className="text-white/25">
                        {num}.
                      </span>{" "}

                      {cleanName(
                        episodeTitle
                      )}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30 sm:text-xs">
                      {durationSeconds >
                      0 ? (
                        <>
                          <Clock className="h-3 w-3" />

                          {formatDuration(
                            durationSeconds
                          )}
                        </>
                      ) : ep.info
                          ?.duration ? (
                        <>
                          <Clock className="h-3 w-3" />

                          {
                            ep.info
                              .duration
                          }
                        </>
                      ) : null}

                      {resume >
                        15 && (
                        <>
                          <span>
                            •
                          </span>

                          <span className="text-[#d8ccff]/75">
                            En cours
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* FULL PLAYER */}

                  <Link
                    href={`/watch?type=series&id=${ep.id}&ext=${ext}&title=${encodeURIComponent(
                      `${cleanTitle} · ${episodeTitle}`
                    )}&series=${id}${
                      resume >
                      15
                        ? `&resume=${Math.floor(
                            resume
                          )}`
                        : ""
                    }`}
                    onClick={(
                      e
                    ) =>
                      e.stopPropagation()
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/30 transition hover:bg-white/10 hover:text-white"
                  >
                    <Maximize className="h-4 w-4" />
                  </Link>
                </motion.div>
              );
            }
          )}
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function SeriesSkeleton() {
  return (
    <div className="min-h-screen bg-[#060608]">
      <Skeleton className="h-[70vh] rounded-none" />

      <div className="mx-auto max-w-[1500px] space-y-3 px-6 py-10">
        {Array.from({
          length:
            6,
        }).map(
          (
            _,
            index
          ) => (
            <Skeleton
              key={
                index
              }
              className="h-28 rounded-[20px]"
            />
          )
        )}
      </div>
    </div>
  );
}