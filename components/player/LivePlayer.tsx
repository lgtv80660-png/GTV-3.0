"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  SkipForward,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import {
  attach,
  type EngineHandle,
} from "@/lib/player/engine";

import { cn } from "@/lib/utils";

/* =========================================================
   TYPES
========================================================= */

type DeviceType =
  | "tv"
  | "mobile"
  | "desktop";

type LiveGrid = {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
};

type LiveAd = {
  id: number;

  client?: string;

  client_logo?: string | null;

  name?: string;

  regie_type: "live";

  format:
    | "lower_third"
    | "corner_card"
    | "l_band"
    | "webm_overlay";

  asset_url: string;

  click_url?: string | null;

  grid?: LiveGrid | null;

  duration_seconds?: number;

  trigger_type?:
    | "pre"
    | "time"
    | "post"
    | "manual";

  trigger_time?: number;

  audio?: boolean;

  media?: string;

  device?: string;

  scenario_id?: number | null;
};

type LiveScenario = {
  id: number;

  name: string;

  regie_type: "live";

  media: "live";

  spot_count: number;

  order_mode:
    | "fixed"
    | "random"
    | "weighted";

  trigger_type:
    | "pre"
    | "time"
    | "post"
    | "manual";

  trigger_time: number;
};

type AdServerResponse = {
  status:
    | "success"
    | "empty"
    | "error";

  mode:
    | "campaign"
    | "scenario"
    | "none";

  scenario?: LiveScenario | null;

  ads?: LiveAd[];
};

/* =========================================================
   ANCIENNE API CINEPUB
========================================================= */

type LegacyAdResponse = {
  status?: string;

  active?: boolean;

  ad?: {
    id?: number;

    brand?: string;

    logo_url?: string | null;

    title?: string;

    video_url?: string;

    asset_url?: string;

    click_url?: string | null;

    slot?: string;

    trigger_time?: number;

    duration_seconds?: number;

    mode?: string;

    description?: string;
  };
};

/* =========================================================
   FULLSCREEN NAVIGATION TYPES
========================================================= */

type FullscreenCategory = {
  category_id: string;
  category_name: string;
};

type FullscreenChannel = {
  num: number;

  name: string;

  stream_id: number;

  stream_icon: string;

  category_id: string;
};

type LockableOrientation =
  ScreenOrientation & {
    lock?: (
      orientation: "landscape"
    ) => Promise<void>;
  };

/* =========================================================
   PROPS
========================================================= */

type LivePlayerProps = {
  sources: string[];

  ext: string;

  title: string;

  poster?: string;

  channelIcon?: string;

  hasNext?: boolean;

  onNext?: () => void;

  onBack?: () => void;

  device?: DeviceType;

  categories?: FullscreenCategory[];

  channels?: FullscreenChannel[];

  selectedCategory?:
    | FullscreenCategory
    | null;

  selectedChannelId?:
    | number
    | null;

  loadingChannels?: boolean;

  onSelectCategory?: (
    category: FullscreenCategory
  ) => void;

  onSelectChannel?: (
    channel: FullscreenChannel
  ) => void;

  onBackToCategories?: () => void;
};

/* =========================================================
   CONFIG
========================================================= */

/*
 * FALSE pendant les tests :
 * même la première chaîne peut
 * recevoir une publicité.
 */
const FIRST_ZAP_FREE =
  false;

let liveZapCount = 0;

/* =========================================================
   DEVICE
========================================================= */

function detectDevice(): DeviceType {
  if (
    typeof window ===
    "undefined"
  ) {
    return "tv";
  }

  const ua =
    navigator.userAgent.toLowerCase();

  const tvPatterns = [
    "smart-tv",
    "smarttv",
    "hbbtv",
    "tizen",
    "webos",
    "web0s",
    "netcast",
    "android tv",
    "googletv",
    "appletv",
  ];

  if (
    tvPatterns.some(
      (pattern) =>
        ua.includes(pattern)
    )
  ) {
    return "tv";
  }

  if (
    /android|iphone|ipad|ipod|mobile/i.test(
      navigator.userAgent
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

/* =========================================================
   ADSERVER URL
========================================================= */

function resolveApiUrl(): string {
  const configured =
    process.env
      .NEXT_PUBLIC_ADSERVER_API ||
    "/api/ad";

  if (
    configured.startsWith(
      "http://"
    ) ||
    configured.startsWith(
      "https://"
    )
  ) {
    return configured;
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return configured;
  }

  return new URL(
    configured,
    window.location.origin
  ).href;
}

/* =========================================================
   ASSET URL
========================================================= */

function resolveAssetUrl(
  assetUrl: string,
  apiUrl: string
): string {
  if (!assetUrl) {
    return "";
  }

  if (
    assetUrl.startsWith(
      "http://"
    ) ||
    assetUrl.startsWith(
      "https://"
    )
  ) {
    return assetUrl;
  }

  try {
    return new URL(
      assetUrl,
      apiUrl
    ).href;
  } catch {
    return assetUrl;
  }
}

/* =========================================================
   ANALYTICS URL

   Direct :
   /cinepub-studio/api.php
   ->
   /cinepub-studio/event.php
========================================================= */

function resolveEventUrl(
  apiUrl: string
): string {
  const configuredEvent =
    process.env
      .NEXT_PUBLIC_ADSERVER_EVENT;

  if (
    configuredEvent
  ) {
    try {
      return new URL(
        configuredEvent,
        typeof window !==
          "undefined"
          ? window.location.origin
          : apiUrl
      ).href;
    } catch {}
  }

  try {
    const url =
      new URL(apiUrl);

    /*
     * L'analytics directe
     * est sûre uniquement
     * si on pointe réellement
     * sur api.php.
     */
    if (
      url.pathname.endsWith(
        "/api.php"
      )
    ) {
      url.pathname =
        url.pathname.replace(
          /api\.php$/,
          "event.php"
        );

      url.search = "";

      return url.href;
    }

    /*
     * Avec /api/ad, pas
     * d'endpoint event connu.
     * On n'invente rien.
     */
    return "";
  } catch {
    return "";
  }
}

/* =========================================================
   GRID 3x3
========================================================= */

function gridToStyle(
  grid?: LiveGrid | null
): CSSProperties {
  const safeGrid =
    grid || {
      r1: 3,
      r2: 3,
      c1: 1,
      c2: 3,
    };

  const r1 =
    Math.max(
      1,
      Math.min(
        3,
        safeGrid.r1
      )
    );

  const r2 =
    Math.max(
      r1,
      Math.min(
        3,
        safeGrid.r2
      )
    );

  const c1 =
    Math.max(
      1,
      Math.min(
        3,
        safeGrid.c1
      )
    );

  const c2 =
    Math.max(
      c1,
      Math.min(
        3,
        safeGrid.c2
      )
    );

  const left =
    ((c1 - 1) / 3) *
    100;

  const top =
    ((r1 - 1) / 3) *
    100;

  const width =
    ((c2 - c1 + 1) /
      3) *
    100;

  const height =
    ((r2 - r1 + 1) /
      3) *
    100;

  return {
    position: "absolute",

    left: `${left}%`,

    top: `${top}%`,

    width: `${width}%`,

    height: `${height}%`,
  };
}

/* =========================================================
   VIDEO / IMAGE
========================================================= */

function isVideoAsset(
  url: string
): boolean {
  const clean =
    url
      .split("?")[0]
      .toLowerCase();

  return (
    clean.endsWith(
      ".webm"
    ) ||
    clean.endsWith(
      ".mp4"
    ) ||
    clean.endsWith(
      ".mov"
    )
  );
}

/* =========================================================
   NORMALISE OLD + NEW CINEPUB
========================================================= */

function normalizeAdResponse(
  raw: unknown,
  currentDevice: DeviceType
): AdServerResponse | null {
  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return null;
  }

  const response =
    raw as
      | AdServerResponse
      | LegacyAdResponse;

  if (
    response.status !==
    "success"
  ) {
    return null;
  }

  /* =======================================================
     NEW STUDIO 4
  ======================================================= */

  if (
    "ads" in response &&
    Array.isArray(
      response.ads
    )
  ) {
    const ads =
      response.ads.filter(
        (ad) =>
          ad &&
          ad.regie_type ===
            "live" &&
          !!ad.asset_url
      );

    if (
      ads.length === 0
    ) {
      return null;
    }

    const newResponse =
      response as AdServerResponse;

    return {
      ...newResponse,

      mode:
        newResponse.mode ||
        "campaign",

      ads,
    };
  }

  /* =======================================================
     OLD CINEPUB

     {
       status: success,
       active: true,
       ad: {...}
     }
  ======================================================= */

  const legacy =
    response as LegacyAdResponse;

  if (
    legacy.active === false ||
    !legacy.ad
  ) {
    return null;
  }

  const assetUrl =
    legacy.ad.video_url ||
    legacy.ad.asset_url ||
    "";

  if (!assetUrl) {
    return null;
  }

  const legacyAd:
    LiveAd = {
    id:
      Number(
        legacy.ad.id
      ) || 0,

    client:
      legacy.ad.brand ||
      "",

    client_logo:
      legacy.ad.logo_url ||
      null,

    name:
      legacy.ad.title ||
      "Publicité",

    regie_type:
      "live",

    format:
      "webm_overlay",

    asset_url:
      assetUrl,

    click_url:
      legacy.ad
        .click_url ||
      null,

    /*
     * L'ancienne API
     * n'a pas de grille.
     *
     * On utilise le tiers
     * inférieur complet.
     */
    grid: {
      r1: 3,
      r2: 3,
      c1: 1,
      c2: 3,
    },

    duration_seconds:
      Math.max(
        1,
        Number(
          legacy.ad
            .duration_seconds
        ) || 10
      ),

    trigger_type:
      "time",

    trigger_time:
      Math.max(
        0,
        Number(
          legacy.ad
            .trigger_time
        ) || 30
      ),

    audio: false,

    media: "live",

    device:
      currentDevice,

    scenario_id:
      null,
  };

  return {
    status:
      "success",

    mode:
      "campaign",

    scenario:
      null,

    ads: [
      legacyAd,
    ],
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export function LivePlayer({
  sources,
  ext,
  title,
  poster,
  channelIcon,
  hasNext,
  onNext,
  onBack,
  device,

  categories = [],
  channels = [],
  selectedCategory,
  selectedChannelId,
  loadingChannels = false,
  onSelectCategory,
  onSelectChannel,
  onBackToCategories,
}: LivePlayerProps) {
  /* =======================================================
     REFS
  ======================================================= */

  const videoRef =
    useRef<HTMLVideoElement>(
      null
    );

  const overlayVideoRef =
    useRef<HTMLVideoElement>(
      null
    );

  const wrapRef =
    useRef<HTMLDivElement>(
      null
    );

  const engineRef =
    useRef<EngineHandle | null>(
      null
    );

  const menuRef =
    useRef<HTMLDivElement>(
      null
    );

  const hideTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const overlayTriggerTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const overlayEndTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const overlayNextTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const overlayVisibleRef =
    useRef(false);

  const overlayIndexRef =
    useRef(-1);

  const adPackageRef =
    useRef<
      AdServerResponse | null
    >(null);

  const orientationLockedRef =
    useRef(false);

  /* =======================================================
     STATE
  ======================================================= */

  const [
    playing,
    setPlaying,
  ] = useState(false);

  const [
    muted,
    setMuted,
  ] = useState(false);

  const [
    volume,
    setVolume,
  ] = useState(1);

  const [
    buffering,
    setBuffering,
  ] = useState(true);

  const [
    fullscreen,
    setFullscreen,
  ] = useState(false);

  const [
    controlsOn,
    setControlsOn,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    srcIdx,
    setSrcIdx,
  ] = useState(0);

  const [
    adPackage,
    setAdPackage,
  ] = useState<
    AdServerResponse | null
  >(null);

  const [
    overlayVisible,
    setOverlayVisible,
  ] = useState(false);

  const [
    overlayIndex,
    setOverlayIndex,
  ] = useState(-1);

  const [
    overlayAssetUrl,
    setOverlayAssetUrl,
  ] = useState("");

  const [
    fullscreenMenuOpen,
    setFullscreenMenuOpen,
  ] = useState(false);

  const [
    categoryMode,
    setCategoryMode,
  ] = useState(false);

  const [
    fallbackFullscreen,
    setFallbackFullscreen,
  ] = useState(false);

  const [
    orientationHint,
    setOrientationHint,
  ] = useState(false);

  /* =======================================================
     BASIC
  ======================================================= */

  const sourcesKey =
    sources.join("||");

  const activePoster =
    poster ||
    channelIcon;

  const src =
    sources[srcIdx] ||
    "";

  /* =======================================================
     ACTIVE AD
  ======================================================= */

  const activeOverlay =
    overlayIndex >= 0
      ? adPackage
          ?.ads?.[
            overlayIndex
          ] || null
      : null;

  /* =======================================================
     SYNC REFS
  ======================================================= */

  useEffect(() => {
    overlayVisibleRef.current =
      overlayVisible;
  }, [
    overlayVisible,
  ]);

  useEffect(() => {
    overlayIndexRef.current =
      overlayIndex;
  }, [
    overlayIndex,
  ]);

  useEffect(() => {
    adPackageRef.current =
      adPackage;
  }, [
    adPackage,
  ]);

  /* =======================================================
     CLEAR ADS TIMERS
  ======================================================= */

  const clearAdTimers =
    useCallback(() => {
      if (
        overlayTriggerTimerRef
          .current
      ) {
        clearTimeout(
          overlayTriggerTimerRef
            .current
        );

        overlayTriggerTimerRef.current =
          null;
      }

      if (
        overlayEndTimerRef
          .current
      ) {
        clearTimeout(
          overlayEndTimerRef
            .current
        );

        overlayEndTimerRef.current =
          null;
      }

      if (
        overlayNextTimerRef
          .current
      ) {
        clearTimeout(
          overlayNextTimerRef
            .current
        );

        overlayNextTimerRef.current =
          null;
      }
    }, []);

  /* =======================================================
     RESET ON ZAP
  ======================================================= */

  useEffect(() => {
    setSrcIdx(0);

    setError(null);

    setBuffering(true);

    clearAdTimers();

    setAdPackage(null);

    setOverlayVisible(
      false
    );

    setOverlayIndex(-1);

    setOverlayAssetUrl(
      ""
    );

    overlayVisibleRef.current =
      false;

    overlayIndexRef.current =
      -1;

    adPackageRef.current =
      null;

    liveZapCount += 1;

    return () => {
      clearAdTimers();
    };
  }, [
    sourcesKey,
    clearAdTimers,
  ]);

  /* =======================================================
     FETCH CINEPUB

     SUPPORT :
     - STUDIO 4 ads[]
     - ANCIENNE API ad
  ======================================================= */

  useEffect(() => {
    let active = true;

    const fetchAds =
      async () => {
        if (
          FIRST_ZAP_FREE &&
          liveZapCount === 1
        ) {
          return;
        }

        const apiUrl =
          resolveApiUrl();

        const currentDevice =
          device ||
          detectDevice();

        const separator =
          apiUrl.includes(
            "?"
          )
            ? "&"
            : "?";

        const endpoint =
          `${apiUrl}` +
          `${separator}` +
          `media=live` +
          `&device=${encodeURIComponent(
            currentDevice
          )}`;

        try {
          console.log(
            "[CinePub] GET",
            endpoint
          );

          const response =
            await fetch(
              endpoint,
              {
                cache:
                  "no-store",
              }
            );

          console.log(
            "[CinePub] HTTP",
            response.status
          );

          if (
            !response.ok
          ) {
            console.warn(
              "[CinePub] HTTP ERROR",
              response.status
            );

            return;
          }

          const raw:
            unknown =
            await response.json();

          console.log(
            "[CinePub] RESPONSE",
            raw
          );

          if (!active) {
            return;
          }

          const normalized =
            normalizeAdResponse(
              raw,
              currentDevice
            );

          if (
            !normalized ||
            !normalized.ads ||
            normalized.ads
              .length === 0
          ) {
            console.warn(
              "[CinePub] aucune pub compatible",
              raw
            );

            return;
          }

          console.log(
            "[CinePub] PUB READY",
            normalized
          );

          setAdPackage(
            normalized
          );
        } catch (err) {
          console.error(
            "[CinePub] FETCH ERROR",
            err
          );
        }
      };

    fetchAds();

    return () => {
      active = false;
    };
  }, [
    sourcesKey,
    device,
  ]);

  /* =======================================================
     ANALYTICS
  ======================================================= */

  const sendAdEvent =
    useCallback(
      async (
        ad: LiveAd,

        eventType:
          | "impression"
          | "complete"
          | "click"
      ) => {
        const apiUrl =
          resolveApiUrl();

        const eventUrl =
          resolveEventUrl(
            apiUrl
          );

        /*
         * Si on utilise un
         * proxy /api/ad sans
         * route analytics,
         * on ne casse jamais
         * la pub.
         */
        if (!eventUrl) {
          return;
        }

        const currentDevice =
          device ||
          detectDevice();

        try {
          await fetch(
            eventUrl,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              keepalive:
                true,

              body:
                JSON.stringify(
                  {
                    campaign_id:
                      ad.id,

                    scenario_id:
                      ad.scenario_id ??
                      adPackageRef
                        .current
                        ?.scenario
                        ?.id ??
                      null,

                    event_type:
                      eventType,

                    device:
                      currentDevice,

                    media:
                      "live",
                  }
                ),
            }
          );
        } catch {
          /*
           * Analytics ne doit
           * jamais interrompre
           * le live.
           */
        }
      },
      [
        device,
      ]
    );

  /* =======================================================
     SHOW AD
  ======================================================= */

  const showOverlay =
    useCallback(
      (
        index: number
      ) => {
        const currentPackage =
          adPackageRef.current;

        const ads =
          currentPackage
            ?.ads ||
          [];

        const ad =
          ads[index];

        if (!ad) {
          return;
        }

        const apiUrl =
          resolveApiUrl();

        const finalAssetUrl =
          resolveAssetUrl(
            ad.asset_url,
            apiUrl
          );

        if (
          !finalAssetUrl
        ) {
          console.warn(
            "[CinePub] asset vide"
          );

          return;
        }

        console.log(
          "[CinePub] SHOW",
          ad,
          finalAssetUrl
        );

        overlayIndexRef.current =
          index;

        overlayVisibleRef.current =
          true;

        setOverlayIndex(
          index
        );

        setOverlayAssetUrl(
          finalAssetUrl
        );

        setOverlayVisible(
          true
        );

        sendAdEvent(
          ad,
          "impression"
        );

        /*
         * HARD RULE :
         * LIVE ADS =
         * TOUJOURS MUETTES
         */
        requestAnimationFrame(
          () => {
            const overlay =
              overlayVideoRef
                .current;

            if (overlay) {
              overlay.muted =
                true;

              overlay.defaultMuted =
                true;

              overlay.volume =
                0;
            }
          }
        );
      },
      [
        sendAdEvent,
      ]
    );

  /* =======================================================
     FINISH AD
  ======================================================= */

  const finishOverlay =
    useCallback(() => {
      if (
        !overlayVisibleRef
          .current
      ) {
        return;
      }

      const currentPackage =
        adPackageRef.current;

      const ads =
        currentPackage
          ?.ads ||
        [];

      const currentIndex =
        overlayIndexRef.current;

      const currentAd =
        ads[currentIndex];

      overlayVisibleRef.current =
        false;

      setOverlayVisible(
        false
      );

      if (
        overlayEndTimerRef
          .current
      ) {
        clearTimeout(
          overlayEndTimerRef
            .current
        );

        overlayEndTimerRef.current =
          null;
      }

      if (
        currentAd
      ) {
        sendAdEvent(
          currentAd,
          "complete"
        );
      }

      const nextIndex =
        currentIndex + 1;

      /*
       * SCENARIO :
       * on enchaîne les pubs.
       * Le live continue.
       */
      if (
        currentPackage
          ?.mode ===
          "scenario" &&
        nextIndex <
          ads.length
      ) {
        overlayNextTimerRef.current =
          setTimeout(
            () => {
              showOverlay(
                nextIndex
              );
            },
            350
          );

        return;
      }

      setOverlayIndex(-1);

      overlayIndexRef.current =
        -1;

      setOverlayAssetUrl(
        ""
      );
    }, [
      sendAdEvent,
      showOverlay,
    ]);

  /* =======================================================
     SCHEDULE AD
  ======================================================= */

  useEffect(() => {
    if (
      !adPackage ||
      !adPackage.ads
        ?.length
    ) {
      return;
    }

    if (
      overlayTriggerTimerRef
        .current
    ) {
      clearTimeout(
        overlayTriggerTimerRef
          .current
      );
    }

    const firstAd =
      adPackage.ads[0];

    const triggerType =
      adPackage.mode ===
      "scenario"
        ? adPackage
            .scenario
            ?.trigger_type
        : firstAd
            .trigger_type;

    if (
      triggerType ===
      "manual"
    ) {
      console.log(
        "[CinePub] trigger manual"
      );

      return;
    }

    if (
      triggerType ===
      "post"
    ) {
      return;
    }

    let triggerSeconds =
      Number(
        adPackage.mode ===
        "scenario"
          ? adPackage
              .scenario
              ?.trigger_time
          : firstAd
              .trigger_time
      );

    if (
      !Number.isFinite(
        triggerSeconds
      )
    ) {
      triggerSeconds =
        30;
    }

    triggerSeconds =
      Math.max(
        0,
        triggerSeconds
      );

    const delay =
      triggerType ===
      "pre"
        ? 0
        : triggerSeconds *
          1000;

    console.log(
      "[CinePub] scheduled in",
      delay,
      "ms"
    );

    overlayTriggerTimerRef.current =
      setTimeout(
        () => {
          showOverlay(0);
        },
        delay
      );

    return () => {
      if (
        overlayTriggerTimerRef
          .current
      ) {
        clearTimeout(
          overlayTriggerTimerRef
            .current
        );

        overlayTriggerTimerRef.current =
          null;
      }
    };
  }, [
    adPackage,
    showOverlay,
  ]);

  /* =======================================================
     AD DURATION
  ======================================================= */

  useEffect(() => {
    if (
      !overlayVisible ||
      !activeOverlay
    ) {
      return;
    }

    if (
      overlayEndTimerRef
        .current
    ) {
      clearTimeout(
        overlayEndTimerRef
          .current
      );
    }

    const duration =
      Math.max(
        1,
        Number(
          activeOverlay
            .duration_seconds
        ) || 10
      );

    overlayEndTimerRef.current =
      setTimeout(
        () => {
          finishOverlay();
        },
        duration *
          1000
      );

    return () => {
      if (
        overlayEndTimerRef
          .current
      ) {
        clearTimeout(
          overlayEndTimerRef
            .current
        );

        overlayEndTimerRef.current =
          null;
      }
    };
  }, [
    overlayVisible,
    activeOverlay,
    finishOverlay,
  ]);

  /* =======================================================
     HARD MUTE AD
  ======================================================= */

  useEffect(() => {
    if (
      !overlayVisible
    ) {
      return;
    }

    const overlay =
      overlayVideoRef
        .current;

    if (!overlay) {
      return;
    }

    overlay.muted =
      true;

    overlay.defaultMuted =
      true;

    overlay.volume =
      0;
  }, [
    overlayVisible,
    overlayAssetUrl,
  ]);

  /* =======================================================
     STREAM FALLBACK
  ======================================================= */

  const tryFallback =
    useCallback(
      (
        message: string
      ) => {
        setSrcIdx(
          (index) => {
            if (
              index <
              sources.length -
                1
            ) {
              setError(
                null
              );

              setBuffering(
                true
              );

              return (
                index + 1
              );
            }

            setError(
              message
            );

            return index;
          }
        );
      },
      [
        sources.length,
      ]
    );

  /* =======================================================
     ATTACH LIVE
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (
      !video ||
      !src
    ) {
      return;
    }

    let cancelled =
      false;

    setBuffering(true);

    setError(null);

    (async () => {
      try {
        engineRef.current
          ?.destroy();

        engineRef.current =
          await attach(
            video,
            {
              url: src,

              ext,

              isLive:
                true,
            }
          );

        if (
          cancelled
        ) {
          return;
        }

        try {
          await video.play();
        } catch {}
      } catch (err) {
        if (
          !cancelled
        ) {
          tryFallback(
            (
              err as Error
            ).message ||
              "Playback failed"
          );
        }
      }
    })();

    const isLastSource =
      srcIdx >=
      sources.length -
        1;

    const watchdog =
      setTimeout(
        () => {
          const activeVideo =
            videoRef.current;

          if (
            cancelled ||
            !activeVideo ||
            activeVideo
              .readyState >=
              3
          ) {
            return;
          }

          if (
            !isLastSource
          ) {
            tryFallback(
              "Stream slow to start — switching backup."
            );
          } else {
            setError(
              "Flux Live indisponible actuellement."
            );
          }
        },
        isLastSource
          ? 30000
          : 12000
      );

    return () => {
      cancelled =
        true;

      clearTimeout(
        watchdog
      );

      engineRef.current
        ?.destroy();

      engineRef.current =
        null;
    };
  }, [
    src,
    ext,
    srcIdx,
    sources.length,
    tryFallback,
  ]);

  /* =======================================================
     MAIN VIDEO EVENTS
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    const onPlay =
      () =>
        setPlaying(
          true
        );

    const onPause =
      () =>
        setPlaying(
          false
        );

    const onWaiting =
      () =>
        setBuffering(
          true
        );

    const onPlaying =
      () => {
        setBuffering(
          false
        );

        setError(null);
      };

    const onErr =
      () => {
        tryFallback(
          "Erreur de lecture du direct."
        );
      };

    video.addEventListener(
      "play",
      onPlay
    );

    video.addEventListener(
      "pause",
      onPause
    );

    video.addEventListener(
      "waiting",
      onWaiting
    );

    video.addEventListener(
      "playing",
      onPlaying
    );

    video.addEventListener(
      "error",
      onErr
    );

    return () => {
      video.removeEventListener(
        "play",
        onPlay
      );

      video.removeEventListener(
        "pause",
        onPause
      );

      video.removeEventListener(
        "waiting",
        onWaiting
      );

      video.removeEventListener(
        "playing",
        onPlaying
      );

      video.removeEventListener(
        "error",
        onErr
      );
    };
  }, [
    tryFallback,
  ]);

  /* =======================================================
     PLAY / PAUSE
  ======================================================= */

  const togglePlay =
    useCallback(() => {
      const video =
        videoRef.current;

      if (!video) {
        return;
      }

      if (
        video.paused
      ) {
        video
          .play()
          .catch(
            () => {}
          );
      } else {
        video.pause();
      }
    }, []);

  /* =======================================================
     VOLUME
  ======================================================= */

  const toggleMute =
    useCallback(() => {
      const video =
        videoRef.current;

      if (!video) {
        return;
      }

      video.muted =
        !video.muted;

      setMuted(
        video.muted
      );
    }, []);

  const changeVolume =
    useCallback(
      (
        value: number
      ) => {
        const safeValue =
          Math.max(
            0,
            Math.min(
              1,
              value
            )
          );

        const main =
          videoRef.current;

        if (main) {
          main.volume =
            safeValue;

          main.muted =
            safeValue ===
            0;
        }

        /*
         * Pub LIVE :
         * toujours sans son.
         */
        const ad =
          overlayVideoRef
            .current;

        if (ad) {
          ad.volume = 0;

          ad.muted =
            true;

          ad.defaultMuted =
            true;
        }

        setVolume(
          safeValue
        );

        setMuted(
          safeValue ===
            0
        );
      },
      []
    );

  /* =======================================================
     CONTROLS
  ======================================================= */

  const showControls =
    useCallback(() => {
      setControlsOn(
        true
      );

      if (
        hideTimer.current
      ) {
        clearTimeout(
          hideTimer.current
        );
      }

      hideTimer.current =
        setTimeout(
          () => {
            const video =
              videoRef.current;

            if (
              video &&
              !video.paused &&
              !fullscreenMenuOpen
            ) {
              setControlsOn(
                false
              );
            }
          },
          3000
        );
    }, [
      fullscreenMenuOpen,
    ]);

  /* =======================================================
     FULLSCREEN
  ======================================================= */

  useEffect(() => {
    const handler =
      () => {
        const nativeFullscreen =
          document
            .fullscreenElement ===
          wrapRef.current;

        const active =
          nativeFullscreen ||
          fallbackFullscreen;

        setFullscreen(
          active
        );

        if (!active) {
          setFullscreenMenuOpen(
            false
          );

          setCategoryMode(
            false
          );

          setOrientationHint(
            false
          );

          if (
            orientationLockedRef
              .current
          ) {
            try {
              screen.orientation
                ?.unlock?.();
            } catch {}

            orientationLockedRef.current =
              false;
          }
        }
      };

    handler();

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        handler
      );
  }, [
    fallbackFullscreen,
  ]);

  useEffect(() => {
    if (
      !fallbackFullscreen
    ) {
      return;
    }

    const oldOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        oldOverflow;
    };
  }, [
    fallbackFullscreen,
  ]);

  const toggleFs =
    useCallback(
      async () => {
        const wrapper =
          wrapRef.current;

        if (!wrapper) {
          return;
        }

        if (
          document
            .fullscreenElement ===
          wrapper
        ) {
          try {
            await document
              .exitFullscreen();
          } catch {}

          return;
        }

        if (
          fallbackFullscreen
        ) {
          setFallbackFullscreen(
            false
          );

          return;
        }

        let fallback =
          false;

        try {
          await wrapper
            .requestFullscreen();
        } catch {
          fallback =
            true;

          setFallbackFullscreen(
            true
          );
        }

        wrapper.focus();

        if (
          (device ||
            detectDevice()) ===
          "mobile"
        ) {
          try {
            const orientation =
              screen.orientation as
                | LockableOrientation
                | undefined;

            if (
              !orientation
                ?.lock
            ) {
              throw new Error();
            }

            await orientation.lock(
              "landscape"
            );

            orientationLockedRef.current =
              true;

            setOrientationHint(
              false
            );
          } catch {
            setOrientationHint(
              true
            );
          }
        }

        if (fallback) {
          setFullscreen(
            true
          );
        }
      },
      [
        device,
        fallbackFullscreen,
      ]
    );

  /* =======================================================
     PIP
  ======================================================= */

  const togglePip =
    async () => {
      const video =
        videoRef.current;

      if (!video) {
        return;
      }

      try {
        if (
          document
            .pictureInPictureElement
        ) {
          await document
            .exitPictureInPicture();
        } else {
          await video
            .requestPictureInPicture();
        }
      } catch {}
    };

  /* =======================================================
     FULLSCREEN MENU
  ======================================================= */

  const openFullscreenMenu =
    useCallback(() => {
      setCategoryMode(
        !selectedCategory
      );

      setFullscreenMenuOpen(
        true
      );

      setControlsOn(
        true
      );
    }, [
      selectedCategory,
    ]);

  const closeFullscreenMenu =
    useCallback(() => {
      setFullscreenMenuOpen(
        false
      );

      wrapRef.current
        ?.focus();
    }, []);

  useEffect(() => {
    if (
      !fullscreenMenuOpen
    ) {
      return;
    }

    requestAnimationFrame(
      () => {
        const selected =
          menuRef.current
            ?.querySelector<HTMLButtonElement>(
              "[aria-current='true']"
            );

        const first =
          menuRef.current
            ?.querySelector<HTMLButtonElement>(
              "button:not(:disabled)"
            );

        (
          selected ||
          first
        )?.focus();
      }
    );
  }, [
    fullscreenMenuOpen,
    categoryMode,
    channels,
    categories,
  ]);

  /* =======================================================
     KEYBOARD / TV REMOTE
  ======================================================= */

  useEffect(() => {
    const handler =
      (
        event: KeyboardEvent
      ) => {
        if (
          [
            "INPUT",
            "TEXTAREA",
          ].includes(
            (
              event.target as
                HTMLElement
            )?.tagName
          )
        ) {
          return;
        }

        const back =
          [
            "Escape",
            "Backspace",
            "BrowserBack",
            "GoBack",
          ].includes(
            event.key
          ) ||
          [
            4,
            461,
            10009,
          ].includes(
            event.keyCode
          );

        /* =================================================
           MENU FULLSCREEN
        ================================================= */

        if (
          fullscreen &&
          fullscreenMenuOpen
        ) {
          const buttons =
            Array.from(
              menuRef.current
                ?.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)"
                ) || []
            );

          const current =
            buttons.indexOf(
              document
                .activeElement as
                HTMLButtonElement
            );

          if (back) {
            event.preventDefault();

            closeFullscreenMenu();

            return;
          }

          if (
            [
              "ArrowUp",
              "ArrowLeft",
            ].includes(
              event.key
            )
          ) {
            event.preventDefault();

            const next =
              current <= 0
                ? buttons.length -
                  1
                : current - 1;

            buttons[next]
              ?.focus();

            buttons[next]
              ?.scrollIntoView(
                {
                  block:
                    "nearest",
                }
              );

            return;
          }

          if (
            [
              "ArrowDown",
              "ArrowRight",
            ].includes(
              event.key
            )
          ) {
            event.preventDefault();

            const next =
              current >=
              buttons.length - 1
                ? 0
                : current + 1;

            buttons[next]
              ?.focus();

            buttons[next]
              ?.scrollIntoView(
                {
                  block:
                    "nearest",
                }
              );

            return;
          }

          if (
            [
              "Enter",
              " ",
              "Select",
              "Accept",
            ].includes(
              event.key
            )
          ) {
            event.preventDefault();

            if (
              current >= 0
            ) {
              buttons[current]
                ?.click();
            }

            return;
          }

          return;
        }

        /* =================================================
           FULLSCREEN
        ================================================= */

        if (
          fullscreen
        ) {
          if (back) {
            event.preventDefault();

            void toggleFs();

            return;
          }

          if (
            [
              "Enter",
              "Select",
              "Accept",
              "ContextMenu",
            ].includes(
              event.key
            )
          ) {
            event.preventDefault();

            openFullscreenMenu();

            return;
          }
        }

        /* =================================================
           NORMAL PLAYER
        ================================================= */

        switch (
          event.key
        ) {
          case " ":
            event.preventDefault();

            togglePlay();

            break;

          case "ArrowRight":
            if (
              hasNext
            ) {
              onNext?.();
            }

            break;

          case "ArrowUp":
            changeVolume(
              Math.min(
                1,
                volume +
                  0.1
              )
            );

            break;

          case "ArrowDown":
            changeVolume(
              Math.max(
                0,
                volume -
                  0.1
              )
            );

            break;

          case "f":
            void toggleFs();

            break;

          case "m":
            toggleMute();

            break;
        }

        showControls();
      };

    window.addEventListener(
      "keydown",
      handler,
      true
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handler,
        true
      );
  }, [
    fullscreen,
    fullscreenMenuOpen,
    hasNext,
    onNext,
    openFullscreenMenu,
    closeFullscreenMenu,
    toggleFs,
    togglePlay,
    toggleMute,
    changeVolume,
    showControls,
    volume,
  ]);

  /* =======================================================
     AD CLICK
  ======================================================= */

  const handleOverlayClick =
    useCallback(() => {
      if (
        !activeOverlay ||
        !activeOverlay
          .click_url
      ) {
        return;
      }

      sendAdEvent(
        activeOverlay,
        "click"
      );

      window.open(
        activeOverlay
          .click_url,

        "_blank",

        "noopener,noreferrer"
      );
    }, [
      activeOverlay,
      sendAdEvent,
    ]);

  /* =======================================================
     OVERLAY STYLE
  ======================================================= */

  const overlayStyle =
    gridToStyle(
      activeOverlay
        ?.grid
    );

  const overlayIsVideo =
    isVideoAsset(
      overlayAssetUrl
    );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      ref={
        wrapRef
      }
      tabIndex={
        -1
      }
      style={
        fallbackFullscreen
          ? {
              position:
                "fixed",

              inset: 0,

              width:
                "100vw",

              height:
                "100dvh",

              zIndex:
                2147483647,
            }
          : undefined
      }
      onMouseMove={
        showControls
      }
      onClick={
        showControls
      }
      className={cn(
        `
        group
        relative
        h-full
        min-h-0
        w-full
        select-none
        overflow-hidden
        bg-black
        outline-none
        `,

        controlsOn ||
          fullscreenMenuOpen
          ? "cursor-default"
          : "cursor-none"
      )}
    >
      {/* =================================================
          LIVE VIDEO
      ================================================= */}

      <video
        ref={
          videoRef
        }
        poster={
          activePoster
        }
        playsInline
        onClick={() => {
          if (
            fullscreen
          ) {
            openFullscreenMenu();

            return;
          }

          togglePlay();
        }}
        onDoubleClick={() =>
          void toggleFs()
        }
        className="
          absolute
          inset-0
          h-full
          w-full
          object-contain
        "
      />

      {/* =================================================
          CINEPUB LIVE OVERLAY

          LE LIVE RESTE VISIBLE
          ET CONTINUE DE JOUER.
      ================================================= */}

      {overlayVisible &&
        activeOverlay &&
        overlayAssetUrl && (
          <div
            style={
              overlayStyle
            }
            className={cn(
              `
              absolute
              z-[25]
              overflow-hidden
              `,

              activeOverlay
                .click_url
                ? `
                  pointer-events-auto
                  cursor-pointer
                `
                : `
                  pointer-events-none
                `
            )}
            onClick={
              activeOverlay
                .click_url
                ? (
                    event
                  ) => {
                    event.stopPropagation();

                    handleOverlayClick();
                  }
                : undefined
            }
          >
            {overlayIsVideo ? (
              <video
                key={
                  overlayAssetUrl
                }
                ref={
                  overlayVideoRef
                }
                src={
                  overlayAssetUrl
                }
                autoPlay
                muted
                playsInline
                preload="auto"
                onLoadedData={(
                  event
                ) => {
                  const adVideo =
                    event.currentTarget;

                  adVideo.muted =
                    true;

                  adVideo.defaultMuted =
                    true;

                  adVideo.volume =
                    0;

                  adVideo
                    .play()
                    .catch(
                      () => {}
                    );
                }}
                onVolumeChange={(
                  event
                ) => {
                  const adVideo =
                    event.currentTarget;

                  if (
                    !adVideo.muted ||
                    adVideo
                      .volume !==
                      0
                  ) {
                    adVideo.muted =
                      true;

                    adVideo.defaultMuted =
                      true;

                    adVideo.volume =
                      0;
                  }
                }}
                onEnded={
                  finishOverlay
                }
                onError={() => {
                  console.error(
                    "[CinePub] asset video error:",
                    overlayAssetUrl
                  );
                }}
                className="
                  h-full
                  w-full
                  object-contain
                "
              />
            ) : (
              <img
                src={
                  overlayAssetUrl
                }
                alt={
                  activeOverlay
                    .name ||
                  "Publicité"
                }
                draggable={
                  false
                }
                onError={() => {
                  console.error(
                    "[CinePub] asset image error:",
                    overlayAssetUrl
                  );
                }}
                className="
                  h-full
                  w-full
                  object-contain
                "
              />
            )}
          </div>
        )}

      {/* =================================================
          BUFFERING
      ================================================= */}

      {buffering &&
        !error && (
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-10
              grid
              place-items-center
            "
          >
            <Loader2
              className="
                h-10
                w-10
                animate-spin
                text-[#d8ccff]
              "
            />
          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          className="
            absolute
            inset-0
            z-40
            grid
            place-items-center
            bg-[#060608]/95
            px-6
            text-center
          "
        >
          <div
            className="
              max-w-md
            "
          >
            <AlertTriangle
              className="
                mx-auto
                mb-4
                h-10
                w-10
                text-[#d8ccff]
              "
            />

            <p
              className="
                text-lg
                font-semibold
              "
            >
              Flux Live interrompu
            </p>

            <p
              className="
                mt-2
                text-sm
                text-white/40
              "
            >
              {error}
            </p>

            {onBack && (
              <button
                type="button"
                onClick={
                  onBack
                }
                className="
                  mt-6
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.06]
                  px-5
                  py-2.5
                  text-sm
                  hover:bg-white/10
                "
              >
                Retour
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================
          FULLSCREEN BUTTON CHANNELS
      ================================================= */}

      {fullscreen &&
        !fullscreenMenuOpen && (
          <button
            type="button"
            onClick={
              openFullscreenMenu
            }
            className="
              absolute
              right-5
              top-5
              z-[55]

              flex
              items-center
              gap-2

              rounded-full

              border
              border-white/15

              bg-black/35

              px-4
              py-2.5

              text-[11px]
              font-medium

              text-white/85

              backdrop-blur-2xl

              transition

              hover:bg-white/10
            "
          >
            <Tv
              className="
                h-4
                w-4
              "
            />

            Chaînes
          </button>
        )}

      {fullscreen &&
        orientationHint &&
        !fullscreenMenuOpen && (
          <div
            className="
              pointer-events-none
              absolute
              left-5
              top-5
              z-[55]

              rounded-xl

              border
              border-white/10

              bg-black/50

              px-3
              py-2

              text-[10px]
              text-white/70

              backdrop-blur-xl
            "
          >
            Tournez votre appareil en paysage.
          </div>
        )}

      {/* =================================================
          FULLSCREEN FLOATING NAV
      ================================================= */}

      {fullscreen &&
        fullscreenMenuOpen && (
          <div
            className="
              absolute
              inset-0
              z-[70]

              bg-black/10
            "
            onClick={
              closeFullscreenMenu
            }
          >
            <div
              ref={
                menuRef
              }
              role="dialog"
              aria-modal="true"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
              className="
                absolute
                left-4
                top-1/2

                flex

                max-h-[82vh]

                w-[330px]
                max-w-[calc(100vw-32px)]

                -translate-y-1/2

                flex-col

                overflow-hidden

                rounded-[24px]

                border
                border-white/[0.12]

                bg-[#08080c]/60

                text-white

                shadow-[0_30px_100px_rgba(0,0,0,.55)]

                backdrop-blur-[30px]
              "
            >
              {/* HEADER */}

              <div
                className="
                  flex
                  shrink-0

                  items-start
                  justify-between

                  gap-3

                  border-b
                  border-white/[0.08]

                  p-4
                "
              >
                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Radio
                      className="
                        h-3.5
                        w-3.5
                        text-red-400
                      "
                    />

                    <span
                      className="
                        text-[8px]
                        font-semibold

                        uppercase
                        tracking-[0.16em]

                        text-white/40
                      "
                    >
                      Live TV
                    </span>
                  </div>

                  <h2
                    className="
                      mt-2
                      truncate

                      text-[16px]
                      font-semibold
                    "
                  >
                    {categoryMode
                      ? "Toutes les catégories"
                      : selectedCategory
                          ?.category_name ||
                        "Chaînes"}
                  </h2>

                  {!categoryMode &&
                    selectedCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          /*
                           * Important :
                           * on affiche les
                           * catégories sans
                           * couper le live.
                           */
                          setCategoryMode(
                            true
                          );
                        }}
                        className="
                          mt-2

                          flex
                          items-center
                          gap-1.5

                          rounded-lg

                          px-1
                          py-1

                          text-[10px]

                          text-white/45

                          transition

                          hover:text-white
                        "
                      >
                        <ArrowLeft
                          className="
                            h-3
                            w-3
                          "
                        />

                        Toutes les catégories
                      </button>
                    )}
                </div>

                <button
                  type="button"
                  onClick={
                    closeFullscreenMenu
                  }
                  className="
                    grid
                    h-8
                    w-8

                    shrink-0
                    place-items-center

                    rounded-full

                    border
                    border-white/10

                    bg-white/[0.04]

                    text-white/55

                    transition

                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  <X
                    className="
                      h-4
                      w-4
                    "
                  />
                </button>
              </div>

              {/* LIST */}

              <div
                className="
                  min-h-0
                  flex-1

                  overflow-y-auto

                  p-2

                  [scrollbar-width:none]

                  [&::-webkit-scrollbar]:hidden
                "
              >
                {/* =============================================
                    CATEGORY LIST
                ============================================= */}

                {categoryMode ? (
                  categories.length >
                  0 ? (
                    categories.map(
                      (
                        category
                      ) => {
                        const active =
                          category
                            .category_id ===
                          selectedCategory
                            ?.category_id;

                        return (
                          <button
                            type="button"
                            key={
                              category.category_id
                            }
                            aria-current={
                              active
                                ? "true"
                                : undefined
                            }
                            onClick={() => {
                              onSelectCategory?.(
                                category
                              );

                              setCategoryMode(
                                false
                              );
                            }}
                            className={cn(
                              `
                              group

                              mb-1

                              flex
                              min-h-[46px]
                              w-full

                              items-center
                              justify-between

                              rounded-[13px]

                              border

                              px-3

                              text-left

                              transition-all
                              duration-200

                              focus:outline-none
                              focus-visible:border-[#d8ccff]/50
                              `,

                              active
                                ? `
                                  border-[#d8ccff]/18
                                  bg-[#d8ccff]/[0.08]
                                  text-white
                                `
                                : `
                                  border-transparent
                                  text-white/55
                                  hover:bg-white/[0.055]
                                  hover:text-white
                                `
                            )}
                          >
                            <span
                              className="
                                truncate
                                text-[10px]
                                font-medium
                              "
                            >
                              {
                                category.category_name
                              }
                            </span>

                            <ChevronRight
                              className="
                                h-3.5
                                w-3.5

                                shrink-0

                                text-white/18

                                transition

                                group-hover:translate-x-0.5
                              "
                            />
                          </button>
                        );
                      }
                    )
                  ) : (
                    <p
                      className="
                        p-4
                        text-[10px]
                        text-white/40
                      "
                    >
                      Aucune catégorie disponible.
                    </p>
                  )
                ) : loadingChannels ? (
                  <div
                    className="
                      flex
                      h-32

                      items-center
                      justify-center

                      gap-2

                      text-white/40
                    "
                  >
                    <Loader2
                      className="
                        h-4
                        w-4
                        animate-spin
                      "
                    />

                    <span
                      className="
                        text-[10px]
                      "
                    >
                      Chargement...
                    </span>
                  </div>
                ) : channels.length >
                  0 ? (
                  /* ===========================================
                     CHANNEL LIST
                  =========================================== */

                  channels.map(
                    (
                      channel
                    ) => {
                      const active =
                        channel
                          .stream_id ===
                        selectedChannelId;

                      return (
                        <button
                          type="button"
                          key={
                            channel.stream_id
                          }
                          aria-current={
                            active
                              ? "true"
                              : undefined
                          }
                          onClick={() => {
                            onSelectChannel?.(
                              channel
                            );

                            closeFullscreenMenu();
                          }}
                          className={cn(
                            `
                            group

                            mb-1

                            flex
                            min-h-[54px]
                            w-full

                            items-center

                            gap-3

                            rounded-[14px]

                            border

                            px-2.5
                            py-2

                            text-left

                            transition-all

                            focus:outline-none
                            focus-visible:border-[#d8ccff]/50
                            `,

                            active
                              ? `
                                border-[#d8ccff]/18
                                bg-[#d8ccff]/[0.09]
                              `
                              : `
                                border-transparent
                                hover:bg-white/[0.055]
                              `
                          )}
                        >
                          <div
                            className="
                              grid

                              h-9
                              w-12

                              shrink-0
                              place-items-center

                              overflow-hidden

                              rounded-[10px]

                              border
                              border-white/[0.08]

                              bg-white/[0.035]

                              p-1
                            "
                          >
                            {channel.stream_icon ? (
                              <img
                                src={
                                  channel.stream_icon
                                }
                                alt=""
                                className="
                                  h-full
                                  w-full

                                  object-contain
                                "
                              />
                            ) : (
                              <Tv
                                className="
                                  h-4
                                  w-4

                                  text-white/20
                                "
                              />
                            )}
                          </div>

                          <div
                            className="
                              min-w-0
                              flex-1
                            "
                          >
                            <p
                              className="
                                truncate

                                text-[10px]
                                font-semibold

                                text-white/80

                                group-hover:text-white
                              "
                            >
                              {
                                channel.name
                              }
                            </p>

                            {active && (
                              <div
                                className="
                                  mt-1

                                  flex
                                  items-center

                                  gap-1
                                "
                              >
                                <span
                                  className="
                                    h-1.5
                                    w-1.5

                                    rounded-full

                                    bg-red-400
                                  "
                                />

                                <span
                                  className="
                                    text-[7px]

                                    uppercase
                                    tracking-[0.1em]

                                    text-red-300
                                  "
                                >
                                  En direct
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    }
                  )
                ) : (
                  <p
                    className="
                      p-4
                      text-[10px]
                      text-white/40
                    "
                  >
                    Aucune chaîne disponible.
                  </p>
                )}
              </div>

              {/* FOOTER */}

              <div
                className="
                  shrink-0

                  border-t
                  border-white/[0.07]

                  px-4
                  py-2.5

                  text-[8px]

                  text-white/25
                "
              >
                ↑ ↓ Naviguer · OK Choisir · Retour Fermer
              </div>
            </div>
          </div>
        )}

      {/* =================================================
          TOP INFO
      ================================================= */}

      <div
        className={cn(
          `
          pointer-events-none

          absolute
          inset-x-0
          top-0

          z-20

          flex

          items-start

          gap-3

          bg-gradient-to-b

          from-black/75

          to-transparent

          px-5
          pb-12
          pt-5

          transition-opacity

          sm:px-8
          `,

          controlsOn &&
            !fullscreenMenuOpen
            ? "opacity-100"
            : "opacity-0"
        )}
      >
        {onBack && (
          <button
            type="button"
            onClick={
              onBack
            }
            className="
              pointer-events-auto

              grid
              h-10
              w-10

              shrink-0
              place-items-center

              rounded-full

              border
              border-white/10

              bg-black/40

              text-white

              backdrop-blur-xl

              hover:bg-white/10
            "
          >
            <ArrowLeft
              className="
                h-5
                w-5
              "
            />
          </button>
        )}

        <div
          className="
            min-w-0
            pt-1
          "
        >
          <span
            className="
              mb-1

              inline-flex

              items-center

              gap-1.5

              rounded

              bg-red-600

              px-2
              py-0.5

              text-xs
              font-bold

              uppercase
              tracking-wide
            "
          >
            <span
              className="
                h-1.5
                w-1.5

                rounded-full

                bg-white
              "
            />

            Direct
          </span>

          <h2
            className="
              truncate

              text-lg
              font-semibold

              drop-shadow
            "
          >
            {title}
          </h2>
        </div>
      </div>

      {/* =================================================
          BOTTOM CONTROLS
      ================================================= */}

      <div
        className={cn(
          `
          absolute
          inset-x-0
          bottom-0

          z-20

          flex

          items-center
          justify-between

          bg-gradient-to-t

          from-black/95
          via-black/60
          to-transparent

          px-5
          pb-5
          pt-16

          transition-opacity

          sm:px-8
          `,

          controlsOn &&
            !fullscreenMenuOpen
            ? "opacity-100"
            : `
              pointer-events-none
              opacity-0
            `
        )}
      >
        {/* LEFT */}

        <div
          className="
            flex

            items-center

            gap-4
          "
        >
          <button
            type="button"
            onClick={
              togglePlay
            }
            className="
              text-white

              transition-transform

              hover:scale-110
            "
          >
            {playing ? (
              <Pause
                className="
                  h-7
                  w-7
                  fill-white
                "
              />
            ) : (
              <Play
                className="
                  h-7
                  w-7
                  fill-white
                "
              />
            )}
          </button>

          {hasNext && (
            <button
              type="button"
              onClick={
                onNext
              }
              title="Chaîne suivante"
              className="
                text-white/90

                transition-transform

                hover:scale-110
              "
            >
              <SkipForward
                className="
                  h-6
                  w-6

                  fill-white/90
                "
              />
            </button>
          )}

          {/* VOLUME */}

          <div
            className="
              ml-1

              flex

              items-center

              gap-2
            "
          >
            <button
              type="button"
              onClick={
                toggleMute
              }
              className="
                text-white
              "
            >
              {muted ||
              volume ===
                0 ? (
                <VolumeX
                  className="
                    h-6
                    w-6
                  "
                />
              ) : (
                <Volume2
                  className="
                    h-6
                    w-6
                  "
                />
              )}
            </button>

            <input
              type="range"
              min={
                0
              }
              max={
                1
              }
              step={
                0.05
              }
              value={
                muted
                  ? 0
                  : volume
              }
              onChange={(
                event
              ) =>
                changeVolume(
                  Number(
                    event
                      .target
                      .value
                  )
                )
              }
              className="
                h-1
                w-16

                cursor-pointer

                accent-[#d8ccff]

                sm:w-24
              "
            />
          </div>
        </div>

        {/* RIGHT */}

        <div
          className="
            flex

            items-center

            gap-4
          "
        >
          <button
            type="button"
            onClick={
              togglePip
            }
            className="
              text-white/90

              transition-transform

              hover:scale-110
            "
          >
            <PictureInPicture2
              className="
                h-6
                w-6
              "
            />
          </button>

          <button
            type="button"
            onClick={() =>
              void toggleFs()
            }
            className="
              text-white/90

              transition-transform

              hover:scale-110
            "
          >
            {fullscreen ? (
              <Minimize
                className="
                  h-6
                  w-6
                "
              />
            ) : (
              <Maximize
                className="
                  h-6
                  w-6
                "
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LivePlayer;