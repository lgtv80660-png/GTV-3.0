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
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
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

type LivePlayerProps = {
  sources: string[];

  ext: string;

  title: string;

  poster?: string;

  channelIcon?: string;

  hasNext?: boolean;

  onNext?: () => void;

  onBack?: () => void;

  /**
   * Optionnel.
   * Si tu connais déjà le device :
   *
   * device="tv"
   * device="mobile"
   * device="desktop"
   *
   * Sinon détection automatique.
   */
  device?: DeviceType;
};

/* =========================================================
   CONFIG
========================================================= */

/**
 * false pendant les tests.
 *
 * Si plus tard tu veux remettre :
 * "premier zap gratuit"
 *
 * mets true.
 */
const FIRST_ZAP_FREE = false;

let liveZapCount = 0;

/* =========================================================
   HELPERS
========================================================= */

function detectDevice(): DeviceType {
  if (typeof window === "undefined") {
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
    tvPatterns.some((pattern) =>
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
   API URL
   AUCUN DOMAINE EN DUR
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
    typeof window === "undefined"
  ) {
    return configured;
  }

  return new URL(
    configured,
    window.location.origin
  ).href;
}

/* =========================================================
   RESOLVE ASSET URL

   API :
   https://serveur.com/cinepub/api.php

   ASSET :
   uploads/client/pub.webm

   RESULTAT :
   https://serveur.com/cinepub/uploads/client/pub.webm
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
   EVENT API
========================================================= */

function resolveEventUrl(
  apiUrl: string
): string {
  try {
    return new URL(
      "event.php",
      apiUrl
    ).href;
  } catch {
    return "";
  }
}

/* =========================================================
   GRID 3x3 -> CSS
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
    ((c1 - 1) / 3) * 100;

  const top =
    ((r1 - 1) / 3) * 100;

  const width =
    ((c2 - c1 + 1) / 3) *
    100;

  const height =
    ((r2 - r1 + 1) / 3) *
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
   DETECT VIDEO / IMAGE
========================================================= */

function isVideoAsset(
  url: string
): boolean {
  const clean =
    url
      .split("?")[0]
      .toLowerCase();

  return (
    clean.endsWith(".webm") ||
    clean.endsWith(".mp4") ||
    clean.endsWith(".mov")
  );
}

/* =========================================================
   LIVE PLAYER
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

  /* =======================================================
     BASIC DATA
  ======================================================= */

  const sourcesKey =
    sources.join("||");

  const activePoster =
    poster || channelIcon;

  /* =======================================================
     PLAYER STATE

     IMPORTANT :
     srcIdx EST DECLARE AVANT src
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

  /* =======================================================
     ACTIVE SOURCE
  ======================================================= */

  const src =
    sources[srcIdx] || "";

  /* =======================================================
     AD STATE
  ======================================================= */

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

  /* =======================================================
     SYNC REFS
  ======================================================= */

  useEffect(() => {
    overlayVisibleRef.current =
      overlayVisible;
  }, [overlayVisible]);

  useEffect(() => {
    overlayIndexRef.current =
      overlayIndex;
  }, [overlayIndex]);

  useEffect(() => {
    adPackageRef.current =
      adPackage;
  }, [adPackage]);

  /* =======================================================
     ACTIVE OVERLAY
  ======================================================= */

  const activeOverlay =
    overlayIndex >= 0
      ? adPackage?.ads?.[
          overlayIndex
        ] || null
      : null;

  /* =======================================================
     CLEAR TIMERS
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
     RESET WHEN ZAPPING
  ======================================================= */

  useEffect(() => {
    setSrcIdx(0);

    setError(null);

    setBuffering(true);

    clearAdTimers();

    setAdPackage(null);

    setOverlayVisible(false);

    setOverlayIndex(-1);

    setOverlayAssetUrl("");

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
     FETCH CINEPUB LIVE ADS
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
          apiUrl.includes("?")
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
          const response =
            await fetch(
              endpoint,
              {
                cache:
                  "no-store",
              }
            );

          if (!response.ok) {
            console.warn(
              "CinePub API HTTP:",
              response.status
            );

            return;
          }

          const data =
            (await response.json()) as AdServerResponse;

          if (!active) {
            return;
          }

          if (
            data?.status !==
              "success" ||
            !Array.isArray(
              data.ads
            ) ||
            data.ads.length ===
              0
          ) {
            return;
          }

          /**
           * SECURITE :
           * LivePlayer accepte
           * uniquement LIVE.
           */
          const liveAds =
            data.ads.filter(
              (ad) =>
                ad.regie_type ===
                "live"
            );

          if (
            !liveAds.length
          ) {
            return;
          }

          setAdPackage({
            ...data,
            ads: liveAds,
          });
        } catch (err) {
          console.warn(
            "CinePub LIVE fetch error:",
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

              keepalive: true,

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
          /**
           * Analytics ne doit
           * jamais casser le Live.
           */
        }
      },
      [device]
    );

  /* =======================================================
     SHOW OVERLAY
  ======================================================= */

  const showOverlay =
    useCallback(
      (index: number) => {
        const currentPackage =
          adPackageRef.current;

        const ads =
          currentPackage?.ads ||
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

        /**
         * HARD RULE
         *
         * LIVE ADS = AUDIO OFF
         */
        setTimeout(() => {
          const overlay =
            overlayVideoRef.current;

          if (overlay) {
            overlay.muted =
              true;

            overlay.defaultMuted =
              true;

            overlay.volume =
              0;
          }
        }, 0);
      },
      [sendAdEvent]
    );

  /* =======================================================
     FINISH OVERLAY
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
        currentPackage?.ads ||
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

      if (currentAd) {
        sendAdEvent(
          currentAd,
          "complete"
        );
      }

      const nextIndex =
        currentIndex + 1;

      /**
       * SCENARIO LIVE :
       * spot suivant
       *
       * le direct continue.
       */
      if (
        currentPackage?.mode ===
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

      setOverlayAssetUrl("");
    }, [
      sendAdEvent,
      showOverlay,
    ]);

  /* =======================================================
     SCHEDULE AD PACKAGE
  ======================================================= */

  useEffect(() => {
    if (
      !adPackage ||
      !adPackage.ads?.length
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

    /**
     * Manual =
     * pas de déclenchement
     * automatique.
     */
    if (
      triggerType ===
      "manual"
    ) {
      return;
    }

    /**
     * post n'a pas de sens
     * pour un live infini.
     */
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
     OVERLAY DURATION
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
        duration * 1000
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
     HARD MUTE LIVE ADS
  ======================================================= */

  useEffect(() => {
    if (
      !overlayVisible
    ) {
      return;
    }

    const overlay =
      overlayVideoRef.current;

    if (!overlay) {
      return;
    }

    overlay.muted = true;

    overlay.defaultMuted =
      true;

    overlay.volume = 0;
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
     ATTACH LIVE STREAM
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

    (async () => {
      try {
        engineRef.current?.destroy();

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
        } catch {
          /**
           * autoplay
           * navigateur
           */
        }
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
      sources.length - 1;

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
      cancelled = true;

      clearTimeout(
        watchdog
      );

      engineRef.current?.destroy();

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
     MAIN LIVE EVENTS
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
  }, [tryFallback]);

  /* =======================================================
     FULLSCREEN STATE
  ======================================================= */

  useEffect(() => {
    const handler =
      () =>
        setFullscreen(
          !!document
            .fullscreenElement
        );

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        handler
      );
  }, []);

  /* =======================================================
     PLAY / PAUSE
     UNIQUEMENT LIVE
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
     MUTE LIVE
     NE TOUCHE PAS A LA PUB
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

  /* =======================================================
     VOLUME LIVE
  ======================================================= */

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

        /**
         * PUB LIVE
         *
         * TOUJOURS SILENCIEUSE
         */
        const overlay =
          overlayVideoRef.current;

        if (overlay) {
          overlay.volume =
            0;

          overlay.muted =
            true;

          overlay.defaultMuted =
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
     FULLSCREEN
  ======================================================= */

  const toggleFs =
    useCallback(() => {
      if (
        document
          .fullscreenElement
      ) {
        document
          .exitFullscreen()
          .catch(
            () => {}
          );
      } else {
        wrapRef.current
          ?.requestFullscreen()
          .catch(
            () => {}
          );
      }
    }, []);

  /* =======================================================
     PICTURE IN PICTURE
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
      } catch {
        /**
         * PiP non supporté
         */
      }
    };

  /* =======================================================
     AUTO HIDE CONTROLS
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
              !video.paused
            ) {
              setControlsOn(
                false
              );
            }
          },
          3000
        );
    }, []);

  /* =======================================================
     KEYBOARD
  ======================================================= */

  useEffect(() => {
    const handler =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          [
            "INPUT",
            "TEXTAREA",
          ].includes(
            (
              event.target as HTMLElement
            )?.tagName
          )
        ) {
          return;
        }

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
            toggleFs();

            break;

          case "m":
            toggleMute();

            break;

          case "Escape":
            if (
              !document
                .fullscreenElement
            ) {
              onBack?.();
            }

            break;
        }

        showControls();
      };

    window.addEventListener(
      "keydown",
      handler
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handler
      );
  }, [
    volume,
    hasNext,
    onNext,
    onBack,
    togglePlay,
    toggleFs,
    toggleMute,
    changeVolume,
    showControls,
  ]);

  /* =======================================================
     CLICK PUB
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

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      ref={wrapRef}
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
        `,
        controlsOn
          ? "cursor-default"
          : "cursor-none"
      )}
    >
      {/* ==================================================
          MAIN LIVE VIDEO

          IMPORTANT :
          JAMAIS MASQUE
          JAMAIS PAUSE PAR LA PUB
      ================================================== */}

      <video
        ref={videoRef}
        poster={
          activePoster
        }
        playsInline
        onClick={
          togglePlay
        }
        onDoubleClick={
          toggleFs
        }
        className="
          absolute
          inset-0
          h-full
          w-full
          object-contain
        "
      />

      {/* ==================================================
          LIVE AD OVERLAY
      ================================================== */}

      {overlayVisible &&
        activeOverlay &&
        overlayAssetUrl && (
          <div
            style={
              overlayStyle
            }
            className={cn(
              `
              z-[15]
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

                  /**
                   * LIVE AD
                   * AUDIO OFF
                   */
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
                    adVideo.volume !==
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
                onEnded={() => {
                  finishOverlay();
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
                className="
                  h-full
                  w-full
                  object-contain
                "
              />
            )}
          </div>
        )}

      {/* ==================================================
          BUFFERING
      ================================================== */}

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
                h-11
                w-11
                animate-spin
                text-[#d8ccff]
              "
            />
          </div>
        )}

      {/* ==================================================
          ERROR
      ================================================== */}

      {error && (
        <div
          className="
            absolute
            inset-0
            z-30
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
              Flux Live
              interrompu
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
                  font-medium
                  hover:bg-white/10
                "
              >
                Retour
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================
          TOP BAR
      ================================================== */}

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
          from-black/80
          to-transparent
          px-5
          pb-12
          pt-5
          transition-opacity
          sm:px-8
          `,
          controlsOn
            ? "opacity-100"
            : "opacity-0"
        )}
      >
        {onBack && (
          <button
            onClick={
              onBack
            }
            className="
              pointer-events-auto
              grid
              h-10
              w-10
              place-items-center
              rounded-full
              border
              border-white/10
              bg-black/40
              text-white
              backdrop-blur-xl
              transition
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

      {/* ==================================================
          BOTTOM CONTROLS
      ================================================== */}

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
          controlsOn
            ? "opacity-100"
            : `
              pointer-events-none
              opacity-0
              `
        )}
      >
        <div
          className="
            flex
            items-center
            gap-4
          "
        >
          <button
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

          {/* NEXT CHANNEL */}

          {hasNext && (
            <button
              onClick={
                onNext
              }
              className="
                text-white/90
                transition-transform
                hover:scale-110
              "
              title="Chaîne suivante"
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
              ml-2
              flex
              items-center
              gap-2.5
            "
          >
            <button
              onClick={
                toggleMute
              }
              className="
                shrink-0
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
              min={0}
              max={1}
              step={0.05}
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
                appearance-none
                rounded-full
                bg-white/25
                accent-[#d8ccff]
                sm:w-24

                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white
              "
            />
          </div>
        </div>

        {/* RIGHT CONTROLS */}

        <div
          className="
            flex
            items-center
            gap-4
          "
        >
          <button
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
            onClick={
              toggleFs
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