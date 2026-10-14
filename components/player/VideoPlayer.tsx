"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  AlertTriangle,
  ArrowLeft,
  Captions,
  Check,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  attach,
  type EngineHandle,
} from "@/lib/player/engine";

import {
  cn,
  formatTime,
} from "@/lib/utils";

/* =========================================================
   TYPES
========================================================= */

type MediaType =
  | "movie"
  | "series"
  | "live";

type SubtitleItem = {
  label: string;
  src: string;
  lang?: string;
};

type VideoPlayerProps = {
  sources: string[];
  ext: string;
  isLive: boolean;
  mediaType?: MediaType;
  title: string;
  titleLogo?: string;
  poster?: string;
  channelIcon?: string;
  startTime?: number;
  hasNext?: boolean;
  onNext?: () => void;
  onBack?: () => void;

  onFullscreenChange?: (
    fullscreen: boolean
  ) => void;

  onProgress?: (
    position: number,
    duration: number
  ) => void;

  onEnded?: () => void;

  subtitles?: SubtitleItem[];

  resumeData?: {
    id: string | number;
    seriesId?:
      | string
      | number
      | null;
    season?:
      | string
      | number
      | null;
    episode?:
      | string
      | number
      | null;
    image?: string | null;
    title?: string | null;
  };

  knownDuration?: number;
};

type CinePubAd = {
  id: string;
  assetUrl: string;
  client?: string;
  name?: string;
  triggerTime: number;
  triggerType?: string;
  durationSeconds?: number;
  audio: boolean;
};

/* =========================================================
   CONFIG
========================================================= */

const SPEEDS = [
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  2,
];

const EMPTY_SUBTITLES:
  SubtitleItem[] = [];

const WAITING_VIDEO =
  "/cinema-waiting.mp4";

/* =========================================================
   HELPERS
========================================================= */

function srtToVtt(
  text: string
): string {
  const body = text
    .replace(/\r+/g, "")
    .replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      "$1.$2"
    );

  return /^WEBVTT/.test(
    body.trimStart()
  )
    ? body
    : `WEBVTT\n\n${body}`;
}

function detectAdDevice() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "web";
  }

  const width =
    window.innerWidth;

  if (width < 768) {
    return "mobile";
  }

  if (width < 1180) {
    return "tablet";
  }

  return "desktop";
}

function normalizeAds(
  data: any
): CinePubAd[] {
  const sourceAds: any[] =
    Array.isArray(data?.ads)
      ? data.ads
      : data?.ad
      ? [data.ad]
      : [];

  return sourceAds
    .map<CinePubAd | null>(
      (
        ad: any,
        index: number
      ) => {
        const assetUrl =
          String(
            ad?.asset_url ||
              ad?.video_url ||
              ad?.url ||
              ""
          ).trim();

        if (!assetUrl) {
          return null;
        }

        return {
          id: String(
            ad?.id ||
              `${index}-${assetUrl}`
          ),

          assetUrl,

          client:
            ad?.client ||
            undefined,

          name:
            ad?.name ||
            undefined,

          triggerTime:
            Math.max(
              0,
              Number(
                ad?.trigger_time ??
                  ad?.triggerTime ??
                  30
              ) || 0
            ),

          triggerType:
            ad?.trigger_type ||
            ad?.triggerType ||
            undefined,

          durationSeconds:
            Number(
              ad?.duration_seconds ||
                ad?.duration ||
                0
            ) || undefined,

          audio:
            ad?.audio !== false,
        };
      }
    )
    .filter(
      (
        ad:
          CinePubAd | null
      ): ad is CinePubAd =>
        ad !== null
    );
}

/* =========================================================
   PLAYER
========================================================= */

export function VideoPlayer({
  sources,
  ext,
  isLive,
  mediaType,
  title,
  titleLogo,
  poster,
  channelIcon,

  startTime = 0,

  hasNext,
  onNext,
  onBack,
  onFullscreenChange,

  onProgress,
  onEnded,

  subtitles = EMPTY_SUBTITLES,

  resumeData,

  knownDuration = 0,
}: VideoPlayerProps) {
  /* =======================================================
     REFS
  ======================================================= */

  const videoRef =
    useRef<HTMLVideoElement>(
      null
    );

  const adVideoRef =
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

  const subFileRef =
    useRef<HTMLInputElement>(
      null
    );

  const isPlayingAdRef =
    useRef(false);

  const seekInProgressRef =
    useRef(false);

  const recoveringFromAdRef =
    useRef(false);

  const beforeAdPositionRef =
    useRef(0);

  const playedAdIdsRef =
    useRef<Set<string>>(
      new Set()
    );

  const adQueueRef =
    useRef<number[]>([]);

  const lastTapRef =
    useRef(0);

  const lastResumeSaveRef =
    useRef(0);

  const previousBodyStyles =
    useRef<{
      overflow: string;
      touchAction: string;
      position: string;
      width: string;
      top: string;
      rootOverflow: string;
      scrollX: number;
      scrollY: number;
    } | null>(null);

    const appleHlsErrorTimerRef =
  useRef<number | null>(null);

const appleHlsLastTimeRef =
  useRef(0);

const appleHlsRecoveryCountRef =
  useRef(0);

/*
 * APPLE FULLSCREEN RECOVERY
 */

const appleRestoreTimersRef =
  useRef<number[]>([]);

const appleFullscreenSnapshotRef =
  useRef<{
    mainTime: number;
    mainWasPlaying: boolean;
    adTime: number;
    adWasPlaying: boolean;
  } | null>(null);

 

  /* =======================================================
     KEYS
  ======================================================= */

  const sourcesKey =
    sources.join("||");

  const subtitlesKey =
    subtitles
      .map(
        (sub) =>
          `${sub.src}|${sub.label}|${sub.lang || ""}`
      )
      .join("||");

  const activePoster =
    poster ||
    channelIcon;

  /* =======================================================
     STATES
  ======================================================= */

  const [
    playing,
    setPlaying,
  ] =
    useState(false);

  const [
    muted,
    setMuted,
  ] =
    useState(false);

  const [
    volume,
    setVolume,
  ] =
    useState(1);

  const [
    current,
    setCurrent,
  ] =
    useState(0);

  const [
    duration,
    setDuration,
  ] =
    useState(0);

  const [
    buffering,
    setBuffering,
  ] =
    useState(true);

  const [
    hasStartedPlayback,
    setHasStartedPlayback,
  ] =
    useState(false);

  const [
    nativeFullscreen,
    setNativeFullscreen,
  ] =
    useState(false);

  const [
    iosLandscapeFullscreen,
    setIosLandscapeFullscreen,
  ] =
    useState(false);

  const [
    viewportPortrait,
    setViewportPortrait,
  ] =
    useState(false);

  const [
    controlsOn,
    setControlsOn,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    srcIdx,
    setSrcIdx,
  ] =
    useState(0);

  const [
    speed,
    setSpeed,
  ] =
    useState(1);

  const [
    speedMenu,
    setSpeedMenu,
  ] =
    useState(false);

  const [
    capMenu,
    setCapMenu,
  ] =
    useState(false);

  const [
    subUrl,
    setSubUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    subName,
    setSubName,
  ] =
    useState<string | null>(
      null
    );

  const [
    trackList,
    setTrackList,
  ] =
    useState<
      Array<{
        index: number;
        label: string;
      }>
    >([]);

  const [
    activeTrack,
    setActiveTrack,
  ] =
    useState(-1);

  const [
    seekBase,
    setSeekBase,
  ] =
    useState(
      Math.max(
        0,
        startTime
      )
    );

  const [
    scrub,
    setScrub,
  ] =
    useState<
      number | null
    >(null);

  const [
    streamNonce,
    setStreamNonce,
  ] =
    useState(0);

  /* =======================================================
     ADS
  ======================================================= */

  const [
    vodAds,
    setVodAds,
  ] =
    useState<CinePubAd[]>(
      []
    );

  const [
    activeAdIndex,
    setActiveAdIndex,
  ] =
    useState<number | null>(
      null
    );

  const [
    isPlayingAd,
    setIsPlayingAd,
  ] =
    useState(false);

  const [
    adCurrentTime,
    setAdCurrentTime,
  ] =
    useState(0);

  const [
    adDuration,
    setAdDuration,
  ] =
    useState(0);

  const activeAd =
    activeAdIndex == null
      ? null
      : vodAds[
          activeAdIndex
        ] || null;

  /* =======================================================
     DEVICE / APPLE
  ======================================================= */

  const appleMobile =
    useMemo(() => {
      if (
        typeof navigator ===
        "undefined"
      ) {
        return false;
      }

      const ua =
        navigator.userAgent;

      const platform =
        navigator.platform;

      return (
        /iPhone|iPad|iPod/i.test(
          ua
        ) ||
        (
          platform ===
            "MacIntel" &&
          navigator.maxTouchPoints >
            1
        )
      );
    }, []);

  const touchDevice =
    useMemo(() => {
      if (
        typeof navigator ===
        "undefined"
      ) {
        return false;
      }

      return (
        navigator.maxTouchPoints >
          0 ||
        (
          typeof window !==
            "undefined" &&
          window.matchMedia(
            "(pointer: coarse)"
          ).matches
        )
      );
    }, []);

  const [
    appleOrientationPrompt,
    setAppleOrientationPrompt,
  ] =
    useState(false);

  const [
    mobileLandscape,
    setMobileLandscape,
  ] =
    useState(false);

  const orientationCancelRef =
    useRef<HTMLButtonElement>(
      null
    );

  const fullscreenBusyRef =
    useRef(false);

  const fullscreenGenerationRef =
    useRef(0);

  const fullscreenCallbackRef =
    useRef(
      onFullscreenChange
    );

  const reportedFullscreenRef =
    useRef<
      boolean | null
    >(null);

  const fullscreen =
    nativeFullscreen ||
    iosLandscapeFullscreen;

  useEffect(() => {
    fullscreenCallbackRef.current =
      onFullscreenChange;
  }, [
    onFullscreenChange,
  ]);

  useEffect(() => {
    if (
      reportedFullscreenRef.current !==
      fullscreen
    ) {
      reportedFullscreenRef.current =
        fullscreen;

      fullscreenCallbackRef.current?.(
        fullscreen
      );
    }
  }, [
    fullscreen,
  ]);

  useEffect(
    () => () => {
      if (
        reportedFullscreenRef.current ===
        true
      ) {
        reportedFullscreenRef.current =
          false;

        fullscreenCallbackRef.current?.(
          false
        );
      }
    },
    []
  );

  /* =======================================================
     SOURCE
  ======================================================= */

  let rawSrc =
    sources[srcIdx] ??
    sources[0];

  if (
    rawSrc &&
    (
      rawSrc.includes(
        "/api/transcode"
      ) ||
      rawSrc.includes(
        "/api/show"
      )
    )
  ) {
    rawSrc =
      rawSrc.replace(
        /\/api\/(transcode|show)/,
        "/api/stream-vod"
      );
  }

  const isTranscode =
    !!rawSrc &&
    rawSrc.includes(
      "/api/stream-vod"
    );

  const src =
    useMemo(() => {
      if (!rawSrc) {
        return "";
      }

      if (!isTranscode) {
        return rawSrc;
      }

      try {
        const origin =
          typeof window !==
          "undefined"
            ? window.location.origin
            : "http://localhost";

        const url =
          new URL(
            rawSrc,
            origin
          );

        if (seekBase > 0) {
          url.searchParams.set(
            "t",
            String(
              Math.floor(
                seekBase
              )
            )
          );
        } else {
          url.searchParams.delete(
            "t"
          );
        }

        if (
          streamNonce > 0
        ) {
          url.searchParams.set(
            "_r",
            String(
              streamNonce
            )
          );
        }

        if (
          rawSrc.startsWith(
            "http://"
          ) ||
          rawSrc.startsWith(
            "https://"
          )
        ) {
          return url.toString();
        }

        return (
          url.pathname +
          url.search
        );
      } catch {
        return rawSrc;
      }
    }, [
      rawSrc,
      isTranscode,
      seekBase,
      streamNonce,
    ]);

  const currentMedia:
    MediaType =
    isLive
      ? "live"
      : mediaType ||
        (
          rawSrc?.includes(
            "type=series"
          )
            ? "series"
            : "movie"
        );

  /* =======================================================
     TIME
  ======================================================= */

  const htmlDuration =
    Number.isFinite(duration) &&
    duration > 0
      ? duration
      : 0;

  const apiDuration =
    Number.isFinite(
      knownDuration
    ) &&
    knownDuration > 0
      ? knownDuration
      : 0;

  const total =
    isTranscode
      ? apiDuration
      : (
          htmlDuration ||
          apiDuration ||
          0
        );

  const absoluteCurrent =
    isTranscode
      ? seekBase +
        current
      : current;

  const displayCurrent =
    total > 0
      ? Math.min(
          absoluteCurrent,
          total
        )
      : absoluteCurrent;

  const seekable =
    !isLive;

  const progressPercent =
    total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              displayCurrent /
              total
            ) * 100
          )
        )
      : 0;

  /* =======================================================
     RESET
  ======================================================= */

  useEffect(() => {
    setSrcIdx(0);
    setCurrent(0);
    setDuration(0);

    setSeekBase(
      Math.max(
        0,
        startTime || 0
      )
    );

    setStreamNonce(0);
    setScrub(null);
    setError(null);
    setBuffering(true);

    setHasStartedPlayback(
      false
    );

    setVodAds([]);
    setActiveAdIndex(null);
    setIsPlayingAd(false);
    setAdDuration(0);
    setAdCurrentTime(0);

    playedAdIdsRef.current =
      new Set();

    adQueueRef.current = [];

    isPlayingAdRef.current =
      false;

    recoveringFromAdRef.current =
      false;

    seekInProgressRef.current =
      false;

    appleFullscreenSnapshotRef.current =
      null;

    for (
      const timer of
      appleRestoreTimersRef.current
    ) {
      window.clearTimeout(
        timer
      );
    }

    appleRestoreTimersRef.current =
      [];

    if (
      appleHlsErrorTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        appleHlsErrorTimerRef.current
      );
      appleHlsErrorTimerRef.current =
        null;
    }

    appleHlsLastTimeRef.current = 0;
    appleHlsRecoveryCountRef.current = 0;


  }, [
    sourcesKey,
    startTime,
  ]);

  /* =======================================================
     VIEWPORT
  ======================================================= */

  useEffect(() => {
    const update = () => {
      const mobileInput =
        appleMobile ||
        window.matchMedia(
          "(pointer: coarse)"
        ).matches ||
        /Android|iPhone|iPad|iPod/i.test(
          navigator.userAgent
        );

      setMobileLandscape(
        touchDevice &&
          mobileInput &&
          window.innerWidth >
            window.innerHeight
      );

      setViewportPortrait(
        window.innerHeight >
          window.innerWidth
      );
    };

    update();

    window.addEventListener(
      "resize",
      update
    );

    window.addEventListener(
      "orientationchange",
      update
    );

    return () => {
      window.removeEventListener(
        "resize",
        update
      );

      window.removeEventListener(
        "orientationchange",
        update
      );
    };
  }, [
    touchDevice,
    appleMobile,
  ]);

  /* =======================================================
     ADSERVER / CINEPUB
  ======================================================= */

  useEffect(() => {
    if (isLive) {
      setVodAds([]);
      return;
    }

    let active = true;

    const run =
      async () => {
        try {
          const params =
            new URLSearchParams({
              media:
                currentMedia,

              device:
                detectAdDevice(),
            });

          const response =
            await fetch(
              `/api/ad?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            return;
          }

          const json =
            await response.json();

          if (!active) {
            return;
          }

          setVodAds(
            normalizeAds(json)
          );
        } catch {}
      };

    void run();

    return () => {
      active = false;
    };
  }, [
    currentMedia,
    sourcesKey,
    isLive,
  ]);

  /* =======================================================
     FALLBACK
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
              setError(null);

              setBuffering(
                true
              );

              return index + 1;
            }

            setError(message);

            return index;
          }
        );
      },
      [
        sources.length,
      ]
    );

  /* =======================================================
     ATTACH
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

    let cancelled = false;
    const sessionAbort=new AbortController(),playback=crypto.randomUUID().replaceAll('-','');
    const source=new URL(src,window.location.origin);
    if(!isLive&&source.origin===window.location.origin&&source.pathname.startsWith('/api/'))source.searchParams.set('p',playback);
    const attachedSource=source.origin===window.location.origin?source.pathname+source.search:src;
    const stop=()=>{if(!isLive)void fetch('/api/vod-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',p:playback}),credentials:'same-origin',keepalive:true}).catch(()=>{});};
    window.addEventListener('pagehide',stop);
    const heartbeat=window.setInterval(()=>{if(!isLive)void fetch('/api/vod-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'touch',p:playback}),credentials:'same-origin'}).catch(()=>{});},15000);

    setBuffering(true);

    if (isTranscode) {
      setCurrent(0);
    }

    void (async () => {
      try {
        engineRef.current?.destroy();

        engineRef.current =
          await attach(
            video,
            {
              url: attachedSource,
              desktopSource:src,signal:sessionAbort.signal,
              ext,
              isLive,
            }
          );

        if (cancelled) {
          return;
        }

        seekInProgressRef.current =
          false;

        if (
          recoveringFromAdRef.current
        ) {
          recoveringFromAdRef.current =
            false;
        }

        if (
          !isPlayingAdRef.current
        ) {
          try {
            await video.play();
          } catch {}
        }
      } catch (
        err
      ) {
        seekInProgressRef.current =
          false;

        if (!cancelled) {
          tryFallback(
            (
              err as Error
            ).message ||
              "Playback failed"
          );
        }
      }
    })();

    const lastSource =
      srcIdx >=
      sources.length - 1;

    const appleVodHls =
      appleMobile &&
      !isLive &&
      !!src &&
      src.includes(
        "/api/vod-hls"
      );

    const watchdog =
      window.setTimeout(
        () => {
          const currentVideo =
            videoRef.current;

          if (
            cancelled ||
            !currentVideo ||
            currentVideo.readyState >=
              3
          ) {
            return;
          }

          /*
           * Apple VOD HLS : ne jamais changer de source
           * pendant que Railway/FFmpeg reconnecte Xtream.
           */
          if (appleVodHls) {
            setError(null);
            setBuffering(true);
            return;
          }

          if (!lastSource) {
            tryFallback(
              "Stream lent, passage à la source suivante."
            );
          } else {
            setError(
              "Stream inaccessible actuellement."
            );
          }
        },
        lastSource
          ? 30000
          : 12000
      );

    return () => {
      cancelled = true;
      sessionAbort.abort();window.removeEventListener("pagehide",stop);window.clearInterval(heartbeat);stop();

      window.clearTimeout(
        watchdog
      );

      engineRef.current?.destroy();

      engineRef.current =
        null;
    };
  }, [
    src,
    ext,
    isLive,
    srcIdx,
    sources.length,
    tryFallback,
    isTranscode,
    appleMobile,
  ]);

  /* =======================================================
     ADS
  ======================================================= */

  const startAdQueue =
    useCallback(
      (
        indexes: number[]
      ) => {
        if (
          indexes.length === 0
        ) {
          return;
        }

        const video =
          videoRef.current;

        beforeAdPositionRef.current =
          displayCurrent;

        video?.pause();

        adQueueRef.current =
          indexes.slice(1);

        setActiveAdIndex(
          indexes[0]
        );

        setAdCurrentTime(0);
        setAdDuration(0);

        isPlayingAdRef.current =
          true;

        setIsPlayingAd(true);
      },
      [
        displayCurrent,
      ]
    );

  const playDueAds =
    useCallback(
      (
        position: number
      ) => {
        if (
          isLive ||
          isPlayingAdRef.current
        ) {
          return;
        }

        const due =
          vodAds
            .map(
              (
                ad,
                index
              ) => ({
                ad,
                index,
              })
            )
            .filter(
              ({
                ad,
              }) =>
                !playedAdIdsRef.current.has(
                  ad.id
                ) &&
                position >=
                  ad.triggerTime
            )
            .map(
              ({
                index,
              }) =>
                index
            );

        if (
          due.length > 0
        ) {
          startAdQueue(due);
        }
      },
      [
        isLive,
        vodAds,
        startAdQueue,
      ]
    );

  const resumeMainVideo =
    useCallback(() => {
      const video =
        videoRef.current;

      if (!video) {
        return;
      }

      isPlayingAdRef.current =
        false;

      setIsPlayingAd(false);
      setActiveAdIndex(null);
      setAdCurrentTime(0);
      setAdDuration(0);

      const resumeAt =
        beforeAdPositionRef.current;

      void video
        .play()
        .catch(() => {
          if (
            !isTranscode
          ) {
            return;
          }

          recoveringFromAdRef.current =
            true;

          setBuffering(true);
          setCurrent(0);

          setSeekBase(
            Math.max(
              0,
              resumeAt
            )
          );

          setStreamNonce(
            (value) =>
              value + 1
          );
        });

      if (isTranscode) {
        window.setTimeout(
          () => {
            const activeVideo =
              videoRef.current;

            if (
              !activeVideo ||
              isPlayingAdRef.current
            ) {
              return;
            }

            if (
              activeVideo.paused &&
              activeVideo.readyState <
                3
            ) {
              recoveringFromAdRef.current =
                true;

              setBuffering(true);
              setCurrent(0);

              setSeekBase(
                Math.max(
                  0,
                  resumeAt
                )
              );

              setStreamNonce(
                (value) =>
                  value + 1
              );
            }
          },
          1200
        );
      }
    }, [
      isTranscode,
    ]);

  const handleAdEnded =
    useCallback(() => {
      if (activeAd) {
        playedAdIdsRef.current.add(
          activeAd.id
        );
      }

      const next =
        adQueueRef.current.shift();

      if (
        next != null
      ) {
        setActiveAdIndex(
          next
        );

        setAdCurrentTime(0);
        setAdDuration(0);

        return;
      }

      resumeMainVideo();
    }, [
      activeAd,
      resumeMainVideo,
    ]);

  /* =======================================================
     CONTINUE WATCHING
  ======================================================= */

  const saveContinueWatching =
    useCallback(
      (
        position: number,
        durationValue: number,
        force = false
      ) => {
        if (
          isLive ||
          !resumeData?.id ||
          typeof window ===
            "undefined" ||
          !Number.isFinite(
            position
          ) ||
          position < 15
        ) {
          return;
        }

        const now =
          Date.now();

        if (
          !force &&
          now -
            lastResumeSaveRef.current <
            3000
        ) {
          return;
        }

        lastResumeSaveRef.current =
          now;

        const safePosition =
          Math.max(
            0,
            Number(position) || 0
          );

        const safeDuration =
          Number.isFinite(
            durationValue
          ) &&
          durationValue > 0
            ? durationValue
            : 0;

        const completed =
          safeDuration > 0 &&
          safePosition /
            safeDuration >=
            0.97;

        const data = {
          type:
            currentMedia ===
            "series"
              ? "series"
              : "movie",

          id:
            resumeData.id,

          title:
            resumeData.title ||
            title,

          image:
            resumeData.image ||
            poster ||
            channelIcon ||
            null,

          seriesId:
            resumeData.seriesId ??
            null,

          season:
            resumeData.season ??
            null,

          episode:
            resumeData.episode ??
            null,

          ext:
            ext || "mp4",

          position:
            Math.floor(
              safePosition
            ),

          duration:
            Math.floor(
              safeDuration
            ),

          updatedAt:
            now,
        };

        try {
          if (completed) {
            const legacyRaw =
              localStorage.getItem(
                "gtv_last_played"
              );

            if (legacyRaw) {
              try {
                const legacy =
                  JSON.parse(
                    legacyRaw
                  );

                if (
                  String(
                    legacy?.id
                  ) ===
                  String(
                    resumeData.id
                  )
                ) {
                  localStorage.removeItem(
                    "gtv_last_played"
                  );
                }
              } catch {}
            }
          } else {
            localStorage.setItem(
              "gtv_last_played",
              JSON.stringify(
                data
              )
            );
          }

          if (
            currentMedia ===
              "series" &&
            resumeData.seriesId
          ) {
            const key =
              "gtv_continue_series";

            let items: any[] =
              [];

            try {
              const raw =
                localStorage.getItem(
                  key
                );

              const parsed =
                raw
                  ? JSON.parse(
                      raw
                    )
                  : [];

              if (
                Array.isArray(
                  parsed
                )
              ) {
                items =
                  parsed;
              }
            } catch {
              items = [];
            }

            const seriesId =
              String(
                resumeData.seriesId
              );

            items =
              items.filter(
                (item) =>
                  String(
                    item?.seriesId ??
                      ""
                  ) !==
                  seriesId
              );

            if (!completed) {
              items.unshift(
                data
              );
            }

            items =
              items
                .filter(
                  (item) =>
                    item?.type ===
                      "series" &&
                    item?.seriesId &&
                    item?.id
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    Number(
                      b?.updatedAt ||
                        0
                    ) -
                    Number(
                      a?.updatedAt ||
                        0
                    )
                )
                .slice(
                  0,
                  3
                );

            localStorage.setItem(
              key,
              JSON.stringify(
                items
              )
            );
          }

          if (
            currentMedia ===
            "movie"
          ) {
            const key =
              "gtv_continue_movies";

            let items: any[] =
              [];

            try {
              const raw =
                localStorage.getItem(
                  key
                );

              const parsed =
                raw
                  ? JSON.parse(
                      raw
                    )
                  : [];

              if (
                Array.isArray(
                  parsed
                )
              ) {
                items =
                  parsed;
              }
            } catch {
              items = [];
            }

            const movieId =
              String(
                resumeData.id
              );

            items =
              items.filter(
                (item) =>
                  !(
                    item?.type ===
                      "movie" &&
                    String(
                      item?.id ??
                        ""
                    ) ===
                      movieId
                  )
              );

            if (!completed) {
              items.unshift({
                ...data,
                type:
                  "movie",
                seriesId:
                  null,
                season:
                  null,
                episode:
                  null,
              });
            }

            items =
              items
                .filter(
                  (item) =>
                    item?.type ===
                      "movie" &&
                    item?.id &&
                    item?.title
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    Number(
                      b?.updatedAt ||
                        0
                    ) -
                    Number(
                      a?.updatedAt ||
                        0
                    )
                )
                .slice(
                  0,
                  3
                );

            localStorage.setItem(
              key,
              JSON.stringify(
                items
              )
            );
          }

          window.dispatchEvent(
            new Event(
              "gtv-continue-updated"
            )
          );
        } catch {}
      },
      [
        isLive,
        resumeData,
        currentMedia,
        title,
        poster,
        channelIcon,
        ext,
      ]
    );

  /* =======================================================
     MAIN VIDEO EVENTS
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    const onPlay = () => {
      setPlaying(true);
    };

    const onPause = () => {
      setPlaying(false);

      if (!isLive) {
        const local =
          video.currentTime ||
          0;

        const absolute =
          isTranscode
            ? seekBase +
              local
            : local;

        const durationValue =
          total > 0
            ? total
            : (
                Number.isFinite(
                  video.duration
                ) &&
                video.duration >
                  0
                  ? video.duration
                  : 0
              );

        saveContinueWatching(
          absolute,
          durationValue,
          true
        );
      }
    };

    const onWaiting = () => {
      setBuffering(true);
    };

    const onStalled = () => {
      setBuffering(true);
    };

    const onPlaying = () => {
      setBuffering(false);
      setError(null);

      setHasStartedPlayback(
        true
      );

      seekInProgressRef.current =
        false;
    };

    const onCanPlay = () => {
      setBuffering(false);
    };

    const onLoaded =
      () => {
        if (
          Number.isFinite(
            video.duration
          ) &&
          video.duration > 0
        ) {
          setDuration(
            video.duration
          );
        }

        if (
          !isLive &&
          !isTranscode &&
          startTime > 0 &&
          startTime <
            (
              video.duration ||
              Infinity
            )
        ) {
          video.currentTime =
            startTime;
        }
      };

    const onDurationChange =
      () => {
        if (
          Number.isFinite(
            video.duration
          ) &&
          video.duration > 0
        ) {
          setDuration(
            video.duration
          );
        }
      };

    const onTime = () => {
      const local =
        video.currentTime ||
        0;

      setCurrent(local);

      if (
        appleMobile &&
        !isLive &&
        src?.includes(
          "/api/vod-hls"
        ) &&
        Number.isFinite(
          video.currentTime
        )
      ) {
        appleHlsLastTimeRef.current =
          Math.max(
            appleHlsLastTimeRef.current,
            video.currentTime
          );

        appleHlsRecoveryCountRef.current =
          0;
      }

      const absolute =
        isTranscode
          ? seekBase +
            local
          : local;

      if (!isLive) {
        onProgress?.(
          absolute,
          total
        );

        saveContinueWatching(
          absolute,
          total
        );

        playDueAds(
          absolute
        );
      }
    };

    const onEnd = () => {
      onEnded?.();
    };

    /*
     * APPLE NATIVE HLS RECOVERY
     *
     * Safari peut envoyer un event "error"
     * alors que /api/vod-hls-seg continue
     * de servir correctement les segments.
     *
     * Une erreur transitoire après démarrage
     * ne doit PAS changer srcIdx, src,
     * streamNonce ou recréer le moteur.
     */
    const onErr = () => {
      if (
        isPlayingAdRef.current
      ) {
        return;
      }

      const appleVodHls =
        appleMobile &&
        !isLive &&
        !!src &&
        src.includes(
          "/api/vod-hls"
        );

      if (
        !appleVodHls
      ) {
        tryFallback(
          "Erreur de lecture de la source."
        );
        return;
      }

      const recoveryTime =
        Number.isFinite(
          video.currentTime
        )
          ? video.currentTime
          : appleHlsLastTimeRef.current;

      if (
        recoveryTime >
        appleHlsLastTimeRef.current
      ) {
        appleHlsLastTimeRef.current =
          recoveryTime;
      }

      const mediaError =
        video.error;

      console.warn(
        "[GTV APPLE HLS ERROR]",
        {
          code:
            mediaError?.code ??
            null,
          message:
            mediaError?.message ??
            "",
          currentTime:
            recoveryTime,
          readyState:
            video.readyState,
          networkState:
            video.networkState,
          recovery:
            appleHlsRecoveryCountRef.current,
        }
      );

      /*
       * Safari peut signaler une erreur pendant que
       * FFmpeg reconnecte l'upstream Xtream. On garde
       * strictement le même src et la même session HLS.
       */
      setError(null);
      setBuffering(true);

      if (
        appleHlsErrorTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          appleHlsErrorTimerRef.current
        );
      }

      appleHlsErrorTimerRef.current =
        window.setTimeout(
          () => {
            appleHlsErrorTimerRef.current =
              null;

            const currentVideo =
              videoRef.current;

            if (!currentVideo) {
              return;
            }

            appleHlsRecoveryCountRef.current +=
              1;

            const restoreTime =
              appleHlsLastTimeRef.current;

            if (
              restoreTime > 1 &&
              (
                !Number.isFinite(
                  currentVideo.currentTime
                ) ||
                currentVideo.currentTime <
                  restoreTime - 1
              )
            ) {
              try {
                currentVideo.currentTime =
                  restoreTime;
                setCurrent(
                  restoreTime
                );
              } catch {}
            }

            void currentVideo
              .play()
              .then(() => {
                setError(null);
                setBuffering(false);
                appleHlsRecoveryCountRef.current =
                  0;
              })
              .catch(() => {
                setError(null);
                setBuffering(true);
              });
          },
          5000
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
      "stalled",
      onStalled
    );

    video.addEventListener(
      "playing",
      onPlaying
    );

    video.addEventListener(
      "canplay",
      onCanPlay
    );

    video.addEventListener(
      "loadedmetadata",
      onLoaded
    );

    video.addEventListener(
      "durationchange",
      onDurationChange
    );

    video.addEventListener(
      "timeupdate",
      onTime
    );

    video.addEventListener(
      "ended",
      onEnd
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
        "stalled",
        onStalled
      );

      video.removeEventListener(
        "playing",
        onPlaying
      );

      video.removeEventListener(
        "canplay",
        onCanPlay
      );

      video.removeEventListener(
        "loadedmetadata",
        onLoaded
      );

      video.removeEventListener(
        "durationchange",
        onDurationChange
      );

      video.removeEventListener(
        "timeupdate",
        onTime
      );

      video.removeEventListener(
        "ended",
        onEnd
      );

      video.removeEventListener(
        "error",
        onErr
      );

      if (
        appleHlsErrorTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          appleHlsErrorTimerRef.current
        );
        appleHlsErrorTimerRef.current =
          null;
      }
    };
  }, [
    isLive,
    isTranscode,
    startTime,
    seekBase,
    total,
    onProgress,
    onEnded,
    tryFallback,
    playDueAds,
    saveContinueWatching,
    appleMobile,
    src,
  ]);

  /* =======================================================
     CONTINUE WATCHING - SAFETY SAVE
  ======================================================= */

  useEffect(() => {
    if (
      isLive ||
      !resumeData?.id ||
      typeof window ===
        "undefined"
    ) {
      return;
    }

    const saveCurrentPosition =
      () => {
        const video =
          videoRef.current;

        if (!video) {
          return;
        }

        const local =
          Number(
            video.currentTime
          ) || 0;

        const absolute =
          isTranscode
            ? seekBase +
              local
            : local;

        const durationValue =
          total > 0
            ? total
            : (
                Number.isFinite(
                  video.duration
                ) &&
                video.duration >
                  0
                  ? video.duration
                  : 0
              );

        saveContinueWatching(
          absolute,
          durationValue,
          true
        );
      };

    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          saveCurrentPosition();
        }
      };

    const intervalId =
      window.setInterval(
        saveCurrentPosition,
        5000
      );

    window.addEventListener(
      "pagehide",
      saveCurrentPosition
    );

    window.addEventListener(
      "beforeunload",
      saveCurrentPosition
    );

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      saveCurrentPosition();

      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        "pagehide",
        saveCurrentPosition
      );

      window.removeEventListener(
        "beforeunload",
        saveCurrentPosition
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [
    isLive,
    resumeData?.id,
    isTranscode,
    seekBase,
    total,
    saveContinueWatching,
  ]);

  /* =======================================================
     PLAY / PAUSE
  ======================================================= */

  const togglePlay =
    useCallback(() => {
      if (
        isPlayingAdRef.current
      ) {
        const ad =
          adVideoRef.current;

        if (!ad) return;

        if (ad.paused) {
          void ad
            .play()
            .catch(
              () => {}
            );
        } else {
          ad.pause();
        }

        return;
      }

      const video =
        videoRef.current;

      if (!video) return;

      if (video.paused) {
        void video
          .play()
          .catch(
            () => {}
          );
      } else {
        video.pause();
      }
    }, []);

  /* =======================================================
     SEEK
  ======================================================= */

  const seek =
    useCallback(
      (
        requested: number
      ) => {
        if (
          isLive ||
          isPlayingAdRef.current ||
          seekInProgressRef.current
        ) {
          return;
        }

        const target =
          Math.max(
            0,
            Math.min(
              requested,
              total > 0
                ? total
                : requested
            )
          );

        const video =
          videoRef.current;

        if (!video) {
          return;
        }

        if (!isTranscode) {
          try {
            video.currentTime =
              target;
          } catch {}

          return;
        }

        const localTarget =
          target -
          seekBase;

        let buffered =
          false;

        if (
          localTarget >= 0
        ) {
          try {
            for (
              let i = 0;
              i <
              video.buffered.length;
              i++
            ) {
              const start =
                video.buffered.start(
                  i
                );

              const end =
                video.buffered.end(
                  i
                );

              if (
                localTarget >=
                  start &&
                localTarget <=
                  end -
                    0.15
              ) {
                buffered =
                  true;

                break;
              }
            }
          } catch {}
        }

        if (buffered) {
          try {
            video.currentTime =
              localTarget;

            setCurrent(
              localTarget
            );

            void video
              .play()
              .catch(
                () => {}
              );
          } catch {}

          return;
        }

        seekInProgressRef.current =
          true;

        setBuffering(true);
        setCurrent(0);

        setSeekBase(
          target
        );

        if (
          Math.abs(
            target -
              seekBase
          ) <
          0.5
        ) {
          setStreamNonce(
            (value) =>
              value + 1
          );
        }
      },
      [
        isLive,
        isTranscode,
        total,
        seekBase,
      ]
    );
      /* =======================================================
     VOLUME
  ======================================================= */

  const toggleMute =
    useCallback(() => {
      const activeVideo =
        isPlayingAdRef.current
          ? adVideoRef.current
          : videoRef.current;

      if (!activeVideo) {
        return;
      }

      activeVideo.muted =
        !activeVideo.muted;

      setMuted(
        activeVideo.muted
      );
    }, []);

  const changeVolume = (
    value: number
  ) => {
    const main =
      videoRef.current;

    const ad =
      adVideoRef.current;

    if (main) {
      main.volume = value;

      main.muted =
        value === 0;
    }

    if (ad) {
      ad.volume = value;

      ad.muted =
        value === 0;
    }

    setVolume(value);

    setMuted(
      value === 0
    );
  };

  /* =======================================================
     FULLSCREEN / LANDSCAPE
  ======================================================= */

  const restoreBody =
    useCallback(() => {
      const previous =
        previousBodyStyles.current;

      if (!previous) {
        return;
      }

      previousBodyStyles.current =
        null;

      Object.assign(
        document.body.style,
        {
          overflow:
            previous.overflow,

          touchAction:
            previous.touchAction,

          position:
            previous.position,

          width:
            previous.width,

          top:
            previous.top,
        }
      );

      document.documentElement.style.overflow =
        previous.rootOverflow;

      window.scrollTo(
        previous.scrollX,
        previous.scrollY
      );
    }, []);

  const clearAppleRestoreTimers =
    useCallback(() => {
      for (
        const timer of
        appleRestoreTimersRef.current
      ) {
        window.clearTimeout(
          timer
        );
      }

      appleRestoreTimersRef.current =
        [];
    }, []);

  const snapshotApplePlayback =
    useCallback(() => {
      const main =
        videoRef.current;

      const ad =
        adVideoRef.current;

      appleFullscreenSnapshotRef.current =
        {
          mainTime:
            main &&
            Number.isFinite(
              main.currentTime
            )
              ? main.currentTime
              : 0,

          mainWasPlaying:
            !!main &&
            !main.paused &&
            !main.ended,

          adTime:
            ad &&
            Number.isFinite(
              ad.currentTime
            )
              ? ad.currentTime
              : 0,

          adWasPlaying:
            !!ad &&
            !ad.paused &&
            !ad.ended,
        };
    }, []);

  const restoreApplePlayback =
    useCallback(() => {
      const snapshot =
        appleFullscreenSnapshotRef.current;

      if (!snapshot) {
        return;
      }

      const main =
        videoRef.current;

      const ad =
        adVideoRef.current;

      /*
       * Safari peut temporairement remettre
       * currentTime en arrière pendant la rotation.
       *
       * On garde exactement le même élément vidéo,
       * la même source et la même session HLS.
       */
      if (
        main &&
        snapshot.mainTime > 1 &&
        Number.isFinite(
          main.currentTime
        ) &&
        main.currentTime <
          snapshot.mainTime -
            1.5
      ) {
        try {
          main.currentTime =
            snapshot.mainTime;

          setCurrent(
            snapshot.mainTime
          );
        } catch {}
      }

      if (
        ad &&
        snapshot.adTime >
          0.25 &&
        Number.isFinite(
          ad.currentTime
        ) &&
        ad.currentTime <
          snapshot.adTime -
            0.75
      ) {
        try {
          ad.currentTime =
            snapshot.adTime;
        } catch {}
      }

      if (
        snapshot.mainWasPlaying &&
        main &&
        !isPlayingAdRef.current &&
        main.paused &&
        !main.ended
      ) {
        void main
          .play()
          .catch(
            () => {}
          );
      }

      if (
        snapshot.adWasPlaying &&
        ad &&
        isPlayingAdRef.current &&
        ad.paused &&
        !ad.ended
      ) {
        void ad
          .play()
          .catch(
            () => {}
          );
      }
    }, []);

  const scheduleApplePlaybackRestore =
    useCallback(() => {
      clearAppleRestoreTimers();

      restoreApplePlayback();

      appleRestoreTimersRef.current =
        [
          0,
          180,
          450,
          900,
          1500,
        ].map(
          (delay) =>
            window.setTimeout(
              restoreApplePlayback,
              delay
            )
        );
    }, [
      clearAppleRestoreTimers,
      restoreApplePlayback,
    ]);

  const enterIosLandscape =
    useCallback(() => {
      setAppleOrientationPrompt(
        false
      );

      setIosLandscapeFullscreen(
        true
      );

      setControlsOn(true);

      /*
       * Pas de reload.
       * Pas de changement de src.
       * Pas de nouveau moteur.
       */
      scheduleApplePlaybackRestore();
    }, [
      scheduleApplePlaybackRestore,
    ]);

  const exitIosLandscape =
    useCallback(() => {
      setAppleOrientationPrompt(
        false
      );

      setIosLandscapeFullscreen(
        false
      );

      clearAppleRestoreTimers();

      appleFullscreenSnapshotRef.current =
        null;
    }, [
      clearAppleRestoreTimers,
    ]);

  const cssFullscreenActive =
    appleOrientationPrompt ||
    iosLandscapeFullscreen;

  useEffect(() => {
    const wrapper =
      wrapRef.current;

    if (!wrapper) {
      return;
    }

    const update = () => {
      wrapper.style.setProperty(
        "--gtv-player-height",
        `${wrapper.clientHeight}px`
      );
    };

    update();

    if (
      typeof ResizeObserver ===
      "undefined"
    ) {
      window.addEventListener(
        "resize",
        update
      );

      return () =>
        window.removeEventListener(
          "resize",
          update
        );
    }

    const observer =
      new ResizeObserver(
        update
      );

    observer.observe(
      wrapper
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      !cssFullscreenActive
    ) {
      return;
    }

    const body =
      document.body.style;

    if (
      previousBodyStyles.current ==
      null
    ) {
      previousBodyStyles.current =
        {
          overflow:
            body.overflow,

          touchAction:
            body.touchAction,

          position:
            body.position,

          width:
            body.width,

          top:
            body.top,

          rootOverflow:
            document
              .documentElement
              .style
              .overflow,

          scrollX:
            window.scrollX,

          scrollY:
            window.scrollY,
        };
    }

    const scrollY =
      previousBodyStyles.current
        ?.scrollY ?? 0;

    body.overflow =
      "hidden";

    body.touchAction =
      "none";

    body.position =
      "fixed";

    body.top =
      `-${scrollY}px`;

    body.width =
      "100%";

    document.documentElement.style.overflow =
      "hidden";

    return () => {
      /*
       * Pendant prompt -> fullscreen,
       * ne pas restaurer la page Série.
       */
      window.setTimeout(
        () => {
          const stillActive =
            document.body.dataset
              .gtvAppleFullscreen ===
            "1";

          if (!stillActive) {
            restoreBody();
          }
        },
        0
      );
    };
  }, [
    cssFullscreenActive,
    restoreBody,
  ]);

  useEffect(() => {
    if (
      cssFullscreenActive
    ) {
      document.body.dataset.gtvAppleFullscreen =
        "1";
    } else {
      delete document.body.dataset
        .gtvAppleFullscreen;

      restoreBody();
    }

    return () => {
      if (
        !appleOrientationPrompt &&
        !iosLandscapeFullscreen
      ) {
        delete document.body
          .dataset
          .gtvAppleFullscreen;
      }
    };
  }, [
    cssFullscreenActive,
    appleOrientationPrompt,
    iosLandscapeFullscreen,
    restoreBody,
  ]);

  useEffect(() => {
    if (
      appleOrientationPrompt &&
      !viewportPortrait &&
      window.innerWidth >
        window.innerHeight
    ) {
      /*
       * Le bouton fullscreen a déjà été pressé.
       * Dès que l'iPhone est tourné :
       * passage direct au pseudo-fullscreen.
       */
      enterIosLandscape();
    }
  }, [
    appleOrientationPrompt,
    viewportPortrait,
    enterIosLandscape,
  ]);

  useEffect(() => {
    if (
      !appleMobile ||
      !iosLandscapeFullscreen
    ) {
      return;
    }

    /*
     * La rotation ne démonte pas le player.
     * On conserve la session vidéo actuelle.
     */
    scheduleApplePlaybackRestore();
  }, [
    appleMobile,
    iosLandscapeFullscreen,
    viewportPortrait,
    scheduleApplePlaybackRestore,
  ]);

  useEffect(() => {
    return () => {
      clearAppleRestoreTimers();

      
    };
  }, [
    clearAppleRestoreTimers,
  ]);

  useEffect(() => {
    if (
      !appleOrientationPrompt
    ) {
      return;
    }

    const previousFocus =
      document.activeElement;

    orientationCancelRef.current?.focus();

    return () => {
      if (
        previousFocus instanceof
          HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus({
          preventScroll:
            true,
        });
      }
    };
  }, [
    appleOrientationPrompt,
  ]);

  const enterSmartFullscreen =
    useCallback(async () => {
      const wrapper =
        wrapRef.current;

      if (
        !wrapper ||
        fullscreenBusyRef.current
      ) {
        return;
      }

      /*
       * iPHONE / iPAD
       */
      if (appleMobile) {
        /*
         * Sauvegarde AVANT le prompt et
         * AVANT la rotation.
         */
        snapshotApplePlayback();

        const portrait =
          window.innerHeight >=
          window.innerWidth;

        setViewportPortrait(
          portrait
        );

        if (portrait) {
          setAppleOrientationPrompt(
            true
          );
        } else {
          enterIosLandscape();
        }

        return;
      }

      /*
       * ANDROID / DESKTOP
       */
      fullscreenBusyRef.current =
        true;

      const generation =
        ++fullscreenGenerationRef.current;

      try {
        if (
          document.fullscreenElement !==
          wrapper
        ) {
          await wrapper.requestFullscreen();
        }

        if (
          generation !==
            fullscreenGenerationRef.current ||
          document.fullscreenElement !==
            wrapper
        ) {
          return;
        }

        if (touchDevice) {
          try {
            const orientation =
              screen.orientation as
                ScreenOrientation & {
                  lock?: (
                    orientation:
                      string
                  ) =>
                    Promise<void>;

                  unlock?: () =>
                    void;
                };

            await orientation?.lock?.(
              "landscape"
            );

            if (
              generation !==
                fullscreenGenerationRef.current ||
              document.fullscreenElement !==
                wrapper
            ) {
              orientation?.unlock?.();
            }
          } catch {}
        }
      } catch {
        if (
          generation ===
            fullscreenGenerationRef.current &&
          touchDevice
        ) {
          enterIosLandscape();
        }
      } finally {
        fullscreenBusyRef.current =
          false;
      }
    }, [
      appleMobile,
      touchDevice,
      enterIosLandscape,
      snapshotApplePlayback,
    ]);

  const exitSmartFullscreen =
    useCallback(async () => {
      ++fullscreenGenerationRef.current;

      exitIosLandscape();

      try {
        if (
          document.fullscreenElement ===
          wrapRef.current
        ) {
          await document.exitFullscreen();
        }
      } catch {}

      try {
        screen.orientation?.unlock?.();
      } catch {}
    }, [
      exitIosLandscape,
    ]);

  const toggleFullscreen =
    useCallback(() => {
      if (
        fullscreen ||
        appleOrientationPrompt
      ) {
        void exitSmartFullscreen();
      } else {
        void enterSmartFullscreen();
      }
    }, [
      fullscreen,
      appleOrientationPrompt,
      enterSmartFullscreen,
      exitSmartFullscreen,
    ]);

  useEffect(() => {
    const wrapper =
      wrapRef.current;

    let owned =
      document.fullscreenElement ===
      wrapper;

    const handler = () => {
      const active =
        document.fullscreenElement ===
        wrapper;

      setNativeFullscreen(
        active
      );

      if (
        owned &&
        !active
      ) {
        ++fullscreenGenerationRef.current;

        try {
          screen.orientation?.unlock?.();
        } catch {}
      }

      owned = active;
    };

    handler();

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () => {
      ++fullscreenGenerationRef.current;

      document.removeEventListener(
        "fullscreenchange",
        handler
      );

      if (owned) {
        try {
          screen.orientation?.unlock?.();
        } catch {}

        void document
          .exitFullscreen()
          .catch(
            () => {}
          );
      }
    };
  }, []);

  useEffect(() => {
    if (
      !cssFullscreenActive
    ) {
      return;
    }

    const keyHandler = (
      event:
        KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        exitIosLandscape();
      }

      if (
        appleOrientationPrompt &&
        event.key ===
          "Tab"
      ) {
        event.preventDefault();

        orientationCancelRef.current?.focus();
      }
    };

    window.addEventListener(
      "keydown",
      keyHandler
    );

    return () =>
      window.removeEventListener(
        "keydown",
        keyHandler
      );
  }, [
    cssFullscreenActive,
    appleOrientationPrompt,
    exitIosLandscape,
  ]);

  /* =======================================================
     DOUBLE TAP / DOUBLE CLICK
  ======================================================= */

  const handlePointerUp =
    useCallback(
      (
        event:
          React.PointerEvent<HTMLDivElement>
      ) => {
        const target =
          event.target as
            HTMLElement;

        if (
          target.closest(
            "button,input,[role='button'],[data-player-control='true']"
          )
        ) {
          return;
        }

        const now =
          Date.now();

        const elapsed =
          now -
          lastTapRef.current;

        lastTapRef.current =
          now;

        if (
          elapsed > 0 &&
          elapsed < 320
        ) {
          lastTapRef.current =
            0;

          void enterSmartFullscreen();
        }
      },
      [
        enterSmartFullscreen,
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
          document.pictureInPictureElement
        ) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch {}
    };

  /* =======================================================
     SPEED
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (video) {
      video.playbackRate =
        speed;
    }
  }, [
    speed,
    src,
  ]);

  const applySpeed = (
    value: number
  ) => {
    setSpeed(value);

    setSpeedMenu(false);

    const video =
      videoRef.current;

    if (video) {
      video.playbackRate =
        value;
    }
  };

  /* =======================================================
     SUBTITLES
  ======================================================= */

  const selectTrack =
    useCallback(
      (
        index: number
      ) => {
        const video =
          videoRef.current;

        if (!video) {
          return;
        }

        for (
          let i = 0;
          i <
          video.textTracks.length;
          i++
        ) {
          video.textTracks[
            i
          ].mode =
            i === index
              ? "showing"
              : "disabled";
        }

        setActiveTrack(
          index
        );
      },
      []
    );

  const loadSubtitleFile = (
    file: File
  ) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      const raw =
        String(
          reader.result ||
            ""
        );

      const vtt =
        file.name
          .toLowerCase()
          .endsWith(
            ".vtt"
          )
          ? raw
          : srtToVtt(
              raw
            );

      const url =
        URL.createObjectURL(
          new Blob(
            [vtt],
            {
              type:
                "text/vtt",
            }
          )
        );

      setSubUrl(
        (previous) => {
          if (previous) {
            URL.revokeObjectURL(
              previous
            );
          }

          return url;
        }
      );

      setSubName(
        file.name
      );

      window.setTimeout(
        () => {
          const video =
            videoRef.current;

          if (
            video &&
            video.textTracks
              .length
          ) {
            selectTrack(
              video.textTracks
                .length -
                1
            );
          }
        },
        250
      );
    };

    reader.readAsText(
      file
    );
  };

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    const refresh = () => {
      const list:
        Array<{
          index: number;
          label: string;
        }> = [];

      for (
        let i = 0;
        i <
        video.textTracks.length;
        i++
      ) {
        const track =
          video.textTracks[
            i
          ];

        list.push({
          index: i,

          label:
            track.label ||
            track.language ||
            `Track ${i + 1}`,
        });
      }

      setTrackList(
        list
      );
    };

    refresh();

    const timer =
      window.setTimeout(
        refresh,
        500
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    src,
    subtitlesKey,
    subUrl,
  ]);

  /* =======================================================
     CONTROLS AUTO HIDE
  ======================================================= */

  const revealControls =
    useCallback(() => {
      setControlsOn(true);

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
            if (playing) {
              setControlsOn(
                false
              );
            }
          },
          2800
        );
    }, [
      playing,
    ]);

  useEffect(() => {
    revealControls();

    return () => {
      if (
        hideTimer.current
      ) {
        clearTimeout(
          hideTimer.current
        );
      }
    };
  }, [
    revealControls,
  ]);

  /* =======================================================
     IOS PSEUDO FULLSCREEN STYLE
  ======================================================= */

  const iosFullscreenStyle:
    React.CSSProperties | undefined =
    iosLandscapeFullscreen
      ? viewportPortrait
        ? {
            position:
              "fixed",

            left:
              "50%",

            top:
              "50%",

            width:
              "100dvh",

            height:
              "100dvw",

            transform:
              "translate(-50%, -50%) rotate(90deg)",

            zIndex:
              2147483000,

            borderRadius:
              0,
          }
        : {
            position:
              "fixed",

            inset:
              0,

            width:
              "100dvw",

            height:
              "100dvh",

            zIndex:
              2147483000,

            borderRadius:
              0,
          }
      : undefined;

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div
      ref={wrapRef}
      onMouseMove={
        revealControls
      }
      onPointerUp={
        handlePointerUp
      }
      onDoubleClick={(
        event
      ) => {
        const target =
          event.target as
            HTMLElement;

        if (
          target.closest(
            "button,input,[role='button'],[data-player-control='true']"
          )
        ) {
          return;
        }

        toggleFullscreen();
      }}
      style={
        iosFullscreenStyle
      }
      className={cn(
        `
        relative
        h-full
        w-full
        overflow-hidden
        bg-black
        text-white
        select-none
        `,

        mobileLandscape &&
          "gtv-mobile-landscape",

        iosLandscapeFullscreen &&
          "rounded-none"
      )}
    >
      <style>{`
        .gtv-mobile-landscape .gtv-player-controls {
          padding: 16px max(8px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
        }

        .gtv-mobile-landscape .gtv-player-timeline {
          gap: 6px;
          margin-bottom: 4px;
        }

        .gtv-mobile-landscape .gtv-player-timeline input {
          min-width: 0;
          width: 0;
        }

        .gtv-mobile-landscape .gtv-player-timeline span {
          width: auto;
          flex-shrink: 0;
          font-size: 10px;
        }

        .gtv-mobile-landscape .gtv-player-buttons {
          flex-wrap: wrap;
          gap: 2px;
          position: relative;
          padding-right: 36px;
        }

        .gtv-mobile-landscape .gtv-player-actions {
          display: contents;
        }

        .gtv-mobile-landscape .gtv-player-buttons > button,
        .gtv-mobile-landscape .gtv-player-actions > button,
        .gtv-mobile-landscape .gtv-player-actions > div > button,
        .gtv-mobile-landscape .gtv-player-volume > button {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
        }

        .gtv-mobile-landscape .gtv-player-buttons button > svg {
          width: 20px;
          height: 20px;
        }

        .gtv-mobile-landscape .gtv-player-volume {
          gap: 0;
          flex: 0 0 32px;
        }

        .gtv-mobile-landscape .gtv-player-volume input {
          display: none;
        }

        .gtv-mobile-landscape .gtv-player-actions > div {
          position: static;
          flex: 0 0 32px;
        }

        .gtv-mobile-landscape .gtv-player-fullscreen {
          position: absolute;
          right: 0;
          top: 0;
        }

        .gtv-mobile-landscape .gtv-player-menu {
          right: 0;
          bottom: calc(100% + 4px);
          max-width: 100%;
          max-height: max(
            32px,
            min(
              128px,
              calc(
                var(--gtv-player-height, 200px) - 100px
              )
            )
          );
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .gtv-apple-orientation {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          overflow: auto;
          touch-action: pan-y;
          padding:
            max(24px, env(safe-area-inset-top))
            max(24px, env(safe-area-inset-right))
            max(24px, env(safe-area-inset-bottom))
            max(24px, env(safe-area-inset-left));
          color: #f6f4ff;
          background:
            radial-gradient(
              ellipse at 50% 20%,
              #30233e,
              #0b0b10 65%
            );
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .gtv-apple-orientation-card {
          width: min(100%, 420px);
          box-sizing: border-box;
          text-align: center;
          padding: 28px 20px;
          border: 1px solid #d8ccff26;
          border-radius: 28px;
          background: #ffffff06;
          backdrop-filter: blur(24px);
          box-shadow: 0 24px 80px #0008;
        }

        .gtv-apple-brand {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          font-size: 20px;
        }

        .gtv-apple-brand-apple {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .gtv-apple-logo {
          display: block;
          width: 21px;
          height: 25px;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .gtv-apple-brand strong {
          color: #d8ccff;
          letter-spacing: 4px;
        }

        .gtv-apple-phone-space {
          height: 120px;
          display: grid;
          place-items: center;
        }

        .gtv-apple-phone {
          width: 40px;
          height: 72px;
          border: 2px solid #d8ccff;
          border-radius: 9px;
          position: relative;
          box-shadow: 0 0 24px #a780ff26;
          animation: gtv-phone-turn 3.2s ease-in-out infinite;
        }

        .gtv-apple-phone::after {
          content: "";
          position: absolute;
          width: 14px;
          height: 3px;
          border-radius: 4px;
          background: #d8ccff;
          bottom: 5px;
          left: 11px;
        }

        .gtv-apple-orientation h2 {
          margin: 0 0 16px;
          font-size: 25px;
          font-weight: 600;
        }

        .gtv-apple-orientation p {
          margin: 0;
          color: #d0ccd9;
          font-size: 14px;
          line-height: 1.7;
        }

        .gtv-apple-orientation .gtv-apple-hint {
          margin-top: 22px;
          color: #d8ccff;
          font-size: 13px;
        }

        .gtv-apple-cancel {
          margin-top: 22px;
          min-height: 44px;
          padding: 8px 22px;
          border: 1px solid #ffffff26;
          border-radius: 999px;
          background: #ffffff08;
          color: #e4dfef;
          cursor: pointer;
        }

        .gtv-apple-cancel:focus-visible {
          outline: 2px solid #d8ccff;
          outline-offset: 4px;
        }

        @keyframes gtv-phone-turn {
          0%,
          15% {
            transform: rotate(0);
          }

          55%,
          85% {
            transform: rotate(90deg);
          }

          100% {
            transform: rotate(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gtv-apple-phone {
            animation: none;
            transform: rotate(90deg);
          }
        }
      `}</style>

      {appleOrientationPrompt &&
        createPortal(
          <div
            className="gtv-apple-orientation"
            role="dialog"
            aria-modal="true"
            aria-label="Passez en mode paysage"
            onPointerUp={(
              event
            ) =>
              event.stopPropagation()
            }
            onDoubleClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="gtv-apple-orientation-card">
              <div className="gtv-apple-brand">
                <span className="gtv-apple-brand-apple">
                  <img
                    src="/apple-w.svg"
                    alt=""
                    aria-hidden="true"
                    className="gtv-apple-logo"
                  />

                  <span>
                    Apple
                  </span>
                </span>

                <span
                  aria-hidden="true"
                >
                  ·
                </span>

                <strong>
                  GTV
                </strong>
              </div>

              <div
                className="gtv-apple-phone-space"
                aria-hidden="true"
              >
                <div className="gtv-apple-phone" />
              </div>

              <h2>
                Passez en mode paysage
              </h2>

              <p>
                Cher utilisateur Apple, veuillez orienter votre appareil horizontalement pour profiter d’une expérience cinéma immersive et de toutes les commandes du lecteur.
              </p>

              <p className="gtv-apple-hint">
                Tournez votre appareil pour continuer
              </p>

              <button
                ref={
                  orientationCancelRef
                }
                type="button"
                className="gtv-apple-cancel"
                onClick={
                  exitIosLandscape
                }
              >
                Annuler
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* =================================================
          MAIN VIDEO
      ================================================= */}

      <video
        ref={videoRef}
        poster={
          activePoster
        }
        playsInline
        preload="auto"
        className={cn(
          `
          absolute
          inset-0
          h-full
          w-full
          object-contain
          bg-black
          `,

          isPlayingAd
            ? "opacity-0"
            : "opacity-100"
        )}
      >
        {subtitles.map(
          (
            subtitle,
            index
          ) => (
            <track
              key={`${subtitle.src}-${index}`}
              src={
                subtitle.src
              }
              label={
                subtitle.label
              }
              srcLang={
                subtitle.lang ||
                "fr"
              }
              kind="subtitles"
            />
          )
        )}

        {subUrl && (
          <track
            src={subUrl}
            label={
              subName ||
              "Local"
            }
            kind="subtitles"
            srcLang="fr"
          />
        )}
      </video>
            {/* =================================================
          CINEMA WAITING
      ================================================= */}

      {!isLive &&
        !hasStartedPlayback &&
        !error &&
        !isPlayingAd && (
          <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden bg-[#060608]">
            <video
              src={
                WAITING_VIDEO
              }
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />

            {activePoster && (
              <img
                src={
                  activePoster
                }
                alt=""
                className="absolute inset-0 h-full w-full scale-[1.04] object-cover opacity-25 blur-[2px]"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/30" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

            <div className="absolute inset-0 flex items-center justify-center px-[8%] text-center">
              <div className="flex max-w-[72%] flex-col items-center justify-center">
                <p className="mb-3 text-[clamp(7px,1vw,11px)] font-semibold uppercase tracking-[0.32em] text-white/45">
                  Vous allez regarder
                </p>

                {titleLogo ? (
                  <img
                    src={
                      titleLogo
                    }
                    alt={
                      title
                    }
                    className="max-h-[100px] max-w-full object-contain object-center drop-shadow-[0_16px_30px_rgba(0,0,0,.55)]"
                  />
                ) : (
                  <h2 className="text-center text-[clamp(22px,4vw,52px)] font-semibold tracking-[-0.04em] text-white">
                    {title}
                  </h2>
                )}
              </div>
            </div>
          </div>
        )}

      {/* =================================================
          AD VIDEO
      ================================================= */}

      {isPlayingAd &&
        activeAd && (
          <div className="absolute inset-0 z-[40] bg-black">
            <video
              key={
                activeAd.id
              }
              ref={
                adVideoRef
              }
              src={
                activeAd.assetUrl
              }
              autoPlay
              playsInline
              muted={
                !activeAd.audio ||
                muted
              }
              onLoadedMetadata={(
                event
              ) => {
                const d =
                  event.currentTarget
                    .duration;

                if (
                  Number.isFinite(
                    d
                  )
                ) {
                  setAdDuration(
                    d
                  );
                }
              }}
              onTimeUpdate={(
                event
              ) => {
                setAdCurrentTime(
                  event
                    .currentTarget
                    .currentTime
                );
              }}
              onEnded={
                handleAdEnded
              }
              onError={
                handleAdEnded
              }
              className="absolute inset-0 h-full w-full object-contain"
            />

            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Publicité
            </div>

            {activeAd.client && (
              <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-white/50">
                {
                  activeAd.client
                }
              </div>
            )}

            {adDuration > 0 && (
              <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/45 px-3 py-1 text-[10px] tabular-nums text-white/65">
                {Math.max(
                  0,
                  Math.ceil(
                    adDuration -
                      adCurrentTime
                  )
                )}{" "}
                s
              </div>
            )}
          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error &&
        !isPlayingAd && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-[#060608]/95 px-6 text-center">
            <div className="max-w-md">
              <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-[#d8ccff]" />

              <p className="text-lg font-semibold">
                Impossible de lire ce flux
              </p>

              <p className="mt-2 text-sm text-white/40">
                {error}
              </p>

              {onBack && (
                <button
                  type="button"
                  onClick={
                    onBack
                  }
                  className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium"
                >
                  Retour
                </button>
              )}
            </div>
          </div>
        )}

      {/* =================================================
          TOP BAR
      ================================================= */}

      {!isPlayingAd && (
        <div
          className={cn(
            `
            pointer-events-none
            absolute
            inset-x-0
            top-0
            z-30
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
              type="button"
              data-player-control="true"
              onClick={
                onBack
              }
              className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="min-w-0 pt-1">
            {isLive && (
              <span className="mb-1 inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Live
              </span>
            )}

            <h2 className="truncate text-lg font-semibold drop-shadow">
              {title}
            </h2>
          </div>
        </div>
      )}

      {/* =================================================
          BOTTOM CONTROLS
      ================================================= */}

      {!isPlayingAd && (
        <div
          data-player-control="true"
          className={cn(
            `
            gtv-player-controls
            absolute
            inset-x-0
            bottom-0
            z-30
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

            (
              controlsOn ||
              mobileLandscape
            )
              ? "opacity-100"
              : "opacity-0"
          )}
        >
          {/* TIMELINE */}

          {!isLive && (
            <div className="gtv-player-timeline mb-3 flex items-center gap-3 text-xs tabular-nums text-white/60">
              <span className="w-12 text-right">
                {formatTime(
                  scrub ??
                    displayCurrent
                )}
              </span>

              <input
                type="range"
                min={0}
                max={
                  total || 0
                }
                step={1}
                value={
                  total > 0
                    ? Math.min(
                        scrub ??
                          displayCurrent,
                        total
                      )
                    : 0
                }
                disabled={
                  !seekable ||
                  total <= 0
                }
                onInput={(
                  event
                ) => {
                  setScrub(
                    Number(
                      event
                        .currentTarget
                        .value
                    )
                  );
                }}
                onPointerUp={(
                  event
                ) => {
                  const value =
                    Number(
                      event
                        .currentTarget
                        .value
                    );

                  setScrub(
                    null
                  );

                  seek(
                    value
                  );
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#d8ccff]"
                style={{
                  background:
                    total > 0
                      ? `linear-gradient(to right,#d8ccff ${progressPercent}%,rgba(255,255,255,.20) ${progressPercent}%)`
                      : undefined,
                }}
              />

              <span className="w-12">
                {total > 0
                  ? formatTime(
                      total
                    )
                  : "—:—"}
              </span>
            </div>
          )}

          {/* BUTTON ROW */}

          <div className="gtv-player-buttons flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              data-player-control="true"
              onClick={
                togglePlay
              }
              className="text-white"
            >
              {playing ? (
                <Pause className="h-7 w-7 fill-white" />
              ) : (
                <Play className="h-7 w-7 fill-white" />
              )}
            </button>

            {seekable && (
              <>
                <button
                  type="button"
                  data-player-control="true"
                  onClick={() =>
                    seek(
                      displayCurrent -
                        10
                    )
                  }
                  className="relative text-white/90"
                >
                  <RotateCcw className="h-6 w-6" />

                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">
                    10
                  </span>
                </button>

                <button
                  type="button"
                  data-player-control="true"
                  onClick={() =>
                    seek(
                      displayCurrent +
                        10
                    )
                  }
                  className="relative text-white/90"
                >
                  <RotateCw className="h-6 w-6" />

                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">
                    10
                  </span>
                </button>
              </>
            )}

            {!isLive &&
              hasNext && (
                <button
                  type="button"
                  data-player-control="true"
                  onClick={
                    onNext
                  }
                  className="text-white/90"
                >
                  <SkipForward className="h-6 w-6 fill-white/90" />
                </button>
              )}

            {/* VOLUME */}

            <div className="gtv-player-volume flex items-center gap-2.5">
              <button
                type="button"
                data-player-control="true"
                onClick={
                  toggleMute
                }
                className="text-white"
              >
                {muted ||
                volume === 0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
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
                      event.target
                        .value
                    )
                  )
                }
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[#d8ccff] sm:w-24"
              />
            </div>

            <div className="gtv-player-actions ml-auto flex items-center gap-3 sm:gap-4">
              {/* CAPTIONS */}

              <div className="relative">
                <button
                  type="button"
                  data-player-control="true"
                  onClick={() =>
                    setCapMenu(
                      (
                        value
                      ) =>
                        !value
                    )
                  }
                  className={cn(
                    activeTrack >=
                      0
                      ? "text-[#d8ccff]"
                      : "text-white/90"
                  )}
                >
                  <Captions className="h-6 w-6" />
                </button>

                {capMenu && (
                  <div className="gtv-player-menu absolute bottom-10 right-0 z-50 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111116]/95 py-1 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        selectTrack(
                          -1
                        );

                        setCapMenu(
                          false
                        );
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/10"
                    >
                      Off

                      {activeTrack ===
                        -1 && (
                        <Check className="h-3.5 w-3.5 text-[#d8ccff]" />
                      )}
                    </button>

                    {trackList.map(
                      (
                        track
                      ) => (
                        <button
                          type="button"
                          key={`${track.index}-${track.label}`}
                          onClick={() => {
                            selectTrack(
                              track.index
                            );

                            setCapMenu(
                              false
                            );
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 hover:bg-white/10"
                        >
                          <span className="truncate">
                            {
                              track.label
                            }
                          </span>

                          {activeTrack ===
                            track.index && (
                            <Check className="h-3.5 w-3.5 text-[#d8ccff]" />
                          )}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        subFileRef.current?.click();

                        setCapMenu(
                          false
                        );
                      }}
                      className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-[#d8ccff]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Charger…
                    </button>
                  </div>
                )}
              </div>

              {/* SPEED */}

              {!isLive && (
                <div className="relative">
                  <button
                    type="button"
                    data-player-control="true"
                    onClick={() =>
                      setSpeedMenu(
                        (
                          value
                        ) =>
                          !value
                      )
                    }
                    className={cn(
                      speed !==
                        1
                        ? "text-[#d8ccff]"
                        : "text-white/90"
                    )}
                  >
                    <Gauge className="h-6 w-6" />
                  </button>

                  {speedMenu && (
                    <div className="gtv-player-menu absolute bottom-10 right-0 z-50 w-28 overflow-hidden rounded-xl border border-white/10 bg-[#111116]/95 py-1 text-sm">
                      {SPEEDS.map(
                        (
                          value
                        ) => (
                          <button
                            type="button"
                            key={
                              value
                            }
                            onClick={() =>
                              applySpeed(
                                value
                              )
                            }
                            className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/10"
                          >
                            {value ===
                            1
                              ? "Normal"
                              : `${value}x`}

                            {speed ===
                              value && (
                              <Check className="h-3.5 w-3.5 text-[#d8ccff]" />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PIP */}

              <button
                type="button"
                data-player-control="true"
                onClick={
                  togglePip
                }
                className="text-white/90"
              >
                <PictureInPicture2 className="h-6 w-6" />
              </button>

              {/* FULLSCREEN */}

              <button
                type="button"
                data-player-control="true"
                onClick={
                  toggleFullscreen
                }
                aria-label={
                  fullscreen
                    ? "Quitter le plein écran"
                    : "Plein écran"
                }
                className="gtv-player-fullscreen text-white/90"
              >
                {fullscreen ? (
                  <Minimize className="h-6 w-6" />
                ) : (
                  <Maximize className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          SUBTITLE FILE INPUT
      ================================================= */}

      <input
        ref={
          subFileRef
        }
        type="file"
        accept=".srt,.vtt,text/vtt"
        className="hidden"
        onChange={(
          event
        ) => {
          const file =
            event.target
              .files?.[0];

          if (file) {
            loadSubtitleFile(
              file
            );
          }

          event.target.value =
            "";
        }}
      />
    </div>
  );
}

export default VideoPlayer;