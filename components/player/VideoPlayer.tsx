"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  Captions,
  Check,
  Gauge,
  Loader2,
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

  poster?: string;

  channelIcon?: string;

  startTime?: number;

  hasNext?: boolean;

  onNext?: () => void;

  onBack?: () => void;

  onProgress?: (
    position: number,
    duration: number
  ) => void;

  onEnded?: () => void;

  subtitles?: SubtitleItem[];

  knownDuration?: number;
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

const EMPTY_SUBTITLES: SubtitleItem[] = [];

let liveZapCount = 0;

/* =========================================================
   SRT -> VTT
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

/* =========================================================
   PLAYER
========================================================= */

export function VideoPlayer({
  sources,
  ext,
  isLive,
  mediaType,
  title,
  poster,
  channelIcon,

  startTime = 0,

  hasNext,
  onNext,
  onBack,

  onProgress,
  onEnded,

  subtitles = EMPTY_SUBTITLES,

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

  const adResumePositionRef =
    useRef(0);

  const beforeAdLocalTimeRef =
    useRef(0);

  const seekInProgressRef =
    useRef(false);

  const recoveringFromAdRef =
    useRef(false);

  const postAdTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const postAdFallbackRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  /* =======================================================
     STABLE KEYS
  ======================================================= */

  const sourcesKey =
    sources.join("||");

  const subtitlesKey =
    subtitles
      .map(
        (
          sub
        ) =>
          `${sub.src}|${sub.label}|${sub.lang || ""}`
      )
      .join("||");

  const activePoster =
    poster ||
    channelIcon;

  /* =======================================================
     ADS
  ======================================================= */

  const [
    adConfig,
    setAdConfig,
  ] =
    useState<{
      url: string;
      triggerTime: number;
    } | null>(null);

  const [
    isPlayingAd,
    setIsPlayingAd,
  ] =
    useState(false);

  const [
    adPlayed,
    setAdPlayed,
  ] =
    useState(false);

  const [
    adDuration,
    setAdDuration,
  ] =
    useState(0);

  const [
    adCurrentTime,
    setAdCurrentTime,
  ] =
    useState(0);

  /* =======================================================
     PLAYER STATE
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
    fullscreen,
    setFullscreen,
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

  /* =======================================================
     SEEK STATE
  ======================================================= */

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
     REF SYNC
  ======================================================= */

  useEffect(() => {
    isPlayingAdRef.current =
      isPlayingAd;
  }, [
    isPlayingAd,
  ]);

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

      if (
        !isTranscode
      ) {
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

        if (
          seekBase >
          0
        ) {
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
          streamNonce >
          0
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
        const params: string[] =
          [];

        if (
          seekBase >
          0
        ) {
          params.push(
            `t=${Math.floor(
              seekBase
            )}`
          );
        }

        if (
          streamNonce >
          0
        ) {
          params.push(
            `_r=${streamNonce}`
          );
        }

        if (
          params.length ===
          0
        ) {
          return rawSrc;
        }

        return `${rawSrc}${
          rawSrc.includes("?")
            ? "&"
            : "?"
        }${params.join("&")}`;
      }
    }, [
      rawSrc,
      isTranscode,
      seekBase,
      streamNonce,
    ]);

  /* =======================================================
     MEDIA TYPE
  ======================================================= */

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
     DURATION
  ======================================================= */

  const htmlDuration =
    Number.isFinite(
      duration
    ) &&
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

  /* =======================================================
     RESET MEDIA
  ======================================================= */

  useEffect(() => {
    setSrcIdx(0);

    setCurrent(0);

    setDuration(0);

    setSeekBase(
      Math.max(
        0,
        startTime ||
          0
      )
    );

    setStreamNonce(0);

    setScrub(null);

    setError(null);

    setBuffering(
      true
    );

    setAdPlayed(
      false
    );

    setIsPlayingAd(
      false
    );

    setAdConfig(
      null
    );

    isPlayingAdRef.current =
      false;

    recoveringFromAdRef.current =
      false;

    seekInProgressRef.current =
      false;

    adResumePositionRef.current =
      0;

    beforeAdLocalTimeRef.current =
      0;

    setAdDuration(0);

    setAdCurrentTime(0);

    if (
      postAdTimerRef.current
    ) {
      clearTimeout(
        postAdTimerRef.current
      );
    }

    if (
      postAdFallbackRef.current
    ) {
      clearTimeout(
        postAdFallbackRef.current
      );
    }

    if (
      isLive
    ) {
      liveZapCount +=
        1;
    }
  }, [
    sourcesKey,
    startTime,
    isLive,
  ]);

  /* =======================================================
     ADSERVER
  ======================================================= */

  useEffect(() => {
    let active =
      true;

    const fetchAd =
      async () => {
        if (
          isLive &&
          liveZapCount ===
            1
        ) {
          return;
        }

        const apiUrl =
          process.env
            .NEXT_PUBLIC_ADSERVER_API ||
          "/api/ad";

        const baseUrl =
          apiUrl.startsWith(
            "http"
          )
            ? apiUrl
            : `${window.location.origin}${apiUrl}`;

        const endpoint =
          `${baseUrl}?media=${currentMedia}&slot=Mid-Roll`;

        try {
          const response =
            await fetch(
              endpoint,
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

          const data =
            await response.json();

          if (
            active &&
            data?.status ===
              "success" &&
            data?.ad
              ?.video_url
          ) {
            setAdConfig({
              url:
                data.ad
                  .video_url,

              triggerTime:
                Number(
                  data.ad
                    .trigger_time
                ) || 30,
            });
          }
        } catch {}
      };

    fetchAd();

    return () => {
      active =
        false;
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
          (
            index
          ) => {
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
     ATTACH STREAM
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

    setBuffering(
      true
    );

    if (
      isTranscode
    ) {
      setCurrent(0);
    }

    (async () => {
      try {
        engineRef.current?.destroy();

        engineRef.current =
          await attach(
            video,
            {
              url:
                src,

              ext,

              isLive,
            }
          );

        if (
          cancelled
        ) {
          return;
        }

        seekInProgressRef.current =
          false;

        if (
          recoveringFromAdRef.current
        ) {
          recoveringFromAdRef.current =
            false;

          try {
            await video.play();
          } catch {}

          return;
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
            activeVideo.readyState >=
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
              "Stream inaccessible actuellement."
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
      () => {
        setPlaying(
          true
        );
      };

    const onPause =
      () => {
        setPlaying(
          false
        );
      };

    const onWaiting =
      () => {
        setBuffering(
          true
        );
      };

    const onStalled =
      () => {
        setBuffering(
          true
        );
      };

    const onPlaying =
      () => {
        setBuffering(
          false
        );

        setError(
          null
        );

        seekInProgressRef.current =
          false;
      };

    const onCanPlay =
      () => {
        setBuffering(
          false
        );
      };

    const onLoaded =
      () => {
        if (
          Number.isFinite(
            video.duration
          ) &&
          video.duration >
            0
        ) {
          setDuration(
            video.duration
          );
        }

        if (
          !isLive &&
          !isTranscode &&
          startTime >
            0 &&
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
          video.duration >
            0
        ) {
          setDuration(
            video.duration
          );
        }
      };

    const onTime =
      () => {
        const localTime =
          video.currentTime ||
          0;

        setCurrent(
          localTime
        );

        if (
          !isTranscode &&
          Number.isFinite(
            video.duration
          ) &&
          video.duration >
            0
        ) {
          setDuration(
            video.duration
          );
        }

        const absoluteTime =
          isTranscode
            ? seekBase +
              localTime
            : localTime;

        if (
          !isLive &&
          adConfig &&
          !adPlayed &&
          !isPlayingAdRef.current &&
          absoluteTime >=
            adConfig.triggerTime
        ) {
          adResumePositionRef.current =
            absoluteTime;

          beforeAdLocalTimeRef.current =
            localTime;

          isPlayingAdRef.current =
            true;

          video.pause();

          setAdPlayed(
            true
          );

          setIsPlayingAd(
            true
          );

          return;
        }

        if (
          !isLive
        ) {
          onProgress?.(
            absoluteTime,
            total
          );
        }
      };

    const onEnd =
      () => {
        onEnded?.();
      };

    const onErr =
      () => {
        if (
          isPlayingAdRef.current
        ) {
          return;
        }

        tryFallback(
          "Erreur de lecture de la source."
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
    adConfig,
    adPlayed,
  ]);

  /* =======================================================
     FULLSCREEN STATE
  ======================================================= */

  useEffect(() => {
    const handler =
      () => {
        setFullscreen(
          !!document.fullscreenElement
        );
      };

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handler
      );
    };
  }, []);

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

        if (!ad) {
          return;
        }

        if (
          ad.paused
        ) {
          ad
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

      if (!video) {
        return;
      }

      if (
        video.ended &&
        isTranscode
      ) {
        const position =
          Math.max(
            0,
            displayCurrent
          );

        recoveringFromAdRef.current =
          true;

        setBuffering(
          true
        );

        setCurrent(
          0
        );

        setSeekBase(
          position
        );

        setStreamNonce(
          (
            value
          ) =>
            value +
            1
        );

        return;
      }

      if (
        video.paused
      ) {
        video
          .play()
          .catch(
            () => {
              if (
                isTranscode
              ) {
                const resumeAt =
                  Math.max(
                    0,
                    displayCurrent
                  );

                recoveringFromAdRef.current =
                  true;

                setBuffering(
                  true
                );

                setCurrent(
                  0
                );

                setSeekBase(
                  resumeAt
                );

                setStreamNonce(
                  (
                    value
                  ) =>
                    value +
                    1
                );
              }
            }
          );
      } else {
        video.pause();
      }
    }, [
      displayCurrent,
      isTranscode,
    ]);

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
              total >
                0
                ? total
                : requested
            )
          );

        const video =
          videoRef.current;

        if (!video) {
          return;
        }

        if (
          !isTranscode
        ) {
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
          localTarget >=
          0
        ) {
          try {
            for (
              let i = 0;
              i <
              video.buffered
                .length;
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

        if (
          buffered
        ) {
          try {
            video.currentTime =
              localTarget;

            setCurrent(
              localTarget
            );

            video
              .play()
              .catch(
                () => {}
              );
          } catch {}

          return;
        }

        seekInProgressRef.current =
          true;

        setBuffering(
          true
        );

        setCurrent(
          0
        );

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
            (
              value
            ) =>
              value +
              1
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
      const video =
        isPlayingAdRef.current
          ? adVideoRef.current
          : videoRef.current;

      if (!video) {
        return;
      }

      video.muted =
        !video.muted;

      setMuted(
        video.muted
      );
    }, []);

  const changeVolume = (
    value: number
  ) => {
    const main =
      videoRef.current;

    const ad =
      adVideoRef.current;

    if (
      main
    ) {
      main.volume =
        value;

      main.muted =
        value ===
        0;
    }

    if (
      ad
    ) {
      ad.volume =
        value;

      ad.muted =
        value ===
        0;
    }

    setVolume(
      value
    );

    setMuted(
      value ===
        0
    );
  };

  /* =======================================================
     FULLSCREEN
  ======================================================= */

  const toggleFs =
    useCallback(() => {
      if (
        document.fullscreenElement
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

    if (
      video
    ) {
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
    setSpeed(
      value
    );

    setSpeedMenu(
      false
    );

    const video =
      videoRef.current;

    if (
      video
    ) {
      video.playbackRate =
        value;
    }
  };

  /* =======================================================
     SUBTITLE TRACK
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
          video.textTracks
            .length;
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

  /* =======================================================
     LOCAL SUBTITLE
  ======================================================= */

  const loadSubtitleFile = (
    file: File
  ) => {
    const reader =
      new FileReader();

    reader.onload =
      () => {
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
          (
            previous
          ) => {
            if (
              previous
            ) {
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

        setTimeout(
          () => {
            const video =
              videoRef.current;

            if (
              video &&
              video.textTracks
                .length
            ) {
              selectTrack(
                video
                  .textTracks
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

  /* =======================================================
     TRACK LIST
     FIX MAXIMUM UPDATE DEPTH
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    let disposed =
      false;

    const refresh =
      () => {
        if (
          disposed
        ) {
          return;
        }

        const list: Array<{
          index: number;
          label: string;
        }> = [];

        for (
          let i = 0;
          i <
          video.textTracks
            .length;
          i++
        ) {
          const track =
            video.textTracks[
              i
            ];

          list.push({
            index:
              i,

            label:
              track.label ||
              track.language ||
              `Track ${
                i + 1
              }`,
          });
        }

        setTrackList(
          (
            previous
          ) => {
            const same =
              previous.length ===
                list.length &&
              previous.every(
                (
                  item,
                  index
                ) =>
                  item.index ===
                    list[
                      index
                    ]?.index &&
                  item.label ===
                    list[
                      index
                    ]?.label
              );

            if (
              same
            ) {
              return previous;
            }

            return list;
          }
        );
      };

    refresh();

    const timer =
      setTimeout(
        refresh,
        400
      );

    const tracks =
      video.textTracks;

    tracks.addEventListener?.(
      "addtrack",
      refresh
    );

    tracks.addEventListener?.(
      "removetrack",
      refresh
    );

    return () => {
      disposed =
        true;

      clearTimeout(
        timer
      );

      tracks.removeEventListener?.(
        "addtrack",
        refresh
      );

      tracks.removeEventListener?.(
        "removetrack",
        refresh
      );
    };
  }, [
    subUrl,
    subtitlesKey,
    src,
  ]);

  /* =======================================================
     CONTROLS AUTO HIDE
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
              isPlayingAdRef.current
                ? adVideoRef.current
                : videoRef.current;

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
    const handler = (
      event: KeyboardEvent
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
            seekable &&
            !isPlayingAdRef.current
          ) {
            seek(
              displayCurrent +
                10
            );
          }

          break;

        case "ArrowLeft":
          if (
            seekable &&
            !isPlayingAdRef.current
          ) {
            seek(
              displayCurrent -
                10
            );
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

        case "n":
          if (
            hasNext &&
            !isPlayingAdRef.current
          ) {
            onNext?.();
          }

          break;

        case "Escape":
          if (
            !document.fullscreenElement
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

    return () => {
      window.removeEventListener(
        "keydown",
        handler
      );
    };
  }, [
    seekable,
    displayCurrent,
    volume,
    hasNext,
    onNext,
    onBack,
    seek,
    togglePlay,
    toggleFs,
    toggleMute,
    showControls,
  ]);

  /* =======================================================
     AD EVENTS
  ======================================================= */

  const handleAdLoadedMetadata =
    () => {
      const ad =
        adVideoRef.current;

      if (!ad) {
        return;
      }

      if (
        Number.isFinite(
          ad.duration
        ) &&
        ad.duration >
          0
      ) {
        setAdDuration(
          Math.floor(
            ad.duration
          )
        );
      }

      ad.volume =
        volume;

      ad.muted =
        muted;
    };

  const handleAdTimeUpdate =
    () => {
      const ad =
        adVideoRef.current;

      if (!ad) {
        return;
      }

      setAdCurrentTime(
        Math.floor(
          ad.currentTime
        )
      );

      if (
        !adDuration &&
        Number.isFinite(
          ad.duration
        ) &&
        ad.duration >
          0
      ) {
        setAdDuration(
          Math.floor(
            ad.duration
          )
        );
      }
    };

  /* =======================================================
     AD END
     FAST RESUME + FALLBACK
  ======================================================= */

  const handleAdEnded =
    () => {
      const video =
        videoRef.current;

      const resumeAt =
        adResumePositionRef.current;

      const localBeforeAd =
        beforeAdLocalTimeRef.current;

      isPlayingAdRef.current =
        false;

      setIsPlayingAd(
        false
      );

      setAdCurrentTime(
        0
      );

      if (!video) {
        return;
      }

      if (
        postAdTimerRef.current
      ) {
        clearTimeout(
          postAdTimerRef.current
        );
      }

      if (
        postAdFallbackRef.current
      ) {
        clearTimeout(
          postAdFallbackRef.current
        );
      }

      postAdTimerRef.current =
        setTimeout(
          () => {
            const v =
              videoRef.current;

            if (!v) {
              return;
            }

            v.play()
              .catch(
                () => {}
              );

            postAdFallbackRef.current =
              setTimeout(
                () => {
                  const currentVideo =
                    videoRef.current;

                  if (
                    !currentVideo
                  ) {
                    return;
                  }

                  const advanced =
                    currentVideo.currentTime >
                    localBeforeAd +
                      0.35;

                  const actuallyPlaying =
                    !currentVideo.paused &&
                    currentVideo.readyState >=
                      2 &&
                    advanced;

                  if (
                    actuallyPlaying
                  ) {
                    return;
                  }

                  if (
                    !isTranscode
                  ) {
                    try {
                      currentVideo.currentTime =
                        resumeAt;

                      currentVideo
                        .play()
                        .catch(
                          () => {}
                        );
                    } catch {}

                    return;
                  }

                  recoveringFromAdRef.current =
                    true;

                  seekInProgressRef.current =
                    true;

                  setBuffering(
                    true
                  );

                  setCurrent(
                    0
                  );

                  setSeekBase(
                    resumeAt
                  );

                  setStreamNonce(
                    (
                      value
                    ) =>
                      value +
                      1
                  );
                },
                1200
              );
          },
          80
        );
    };

  /* =======================================================
     AD DISPLAY
  ======================================================= */

  const adRemainingTime =
    Math.max(
      0,
      adDuration -
        adCurrentTime
    );

  /* =======================================================
     TIMELINE %
  ======================================================= */

  const progressPercent =
    total >
    0
      ? Math.max(
          0,
          Math.min(
            100,
            (
              (
                scrub ??
                displayCurrent
              ) /
              total
            ) *
              100
          )
        )
      : 0;

  /* =======================================================
     UNMOUNT CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      if (
        hideTimer.current
      ) {
        clearTimeout(
          hideTimer.current
        );
      }

      if (
        postAdTimerRef.current
      ) {
        clearTimeout(
          postAdTimerRef.current
        );
      }

      if (
        postAdFallbackRef.current
      ) {
        clearTimeout(
          postAdFallbackRef.current
        );
      }

      engineRef.current?.destroy();

      engineRef.current =
        null;
    };
  }, []);

  /* =======================================================
     SUB URL CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      if (
        subUrl
      ) {
        URL.revokeObjectURL(
          subUrl
        );
      }
    };
  }, [
    subUrl,
  ]);

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      ref={
        wrapRef
      }
      onMouseMove={
        showControls
      }
      onClick={
        showControls
      }
      className={cn(
        "group relative h-full min-h-0 w-full select-none overflow-hidden bg-black",

        controlsOn
          ? "cursor-default"
          : "cursor-none"
      )}
    >
      {/* =================================================
          MAIN VIDEO
      ================================================= */}

      <video
        ref={
          videoRef
        }
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
        className={cn(
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",

          isPlayingAd
            ? "pointer-events-none opacity-0"
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
              kind="subtitles"
              src={
                subtitle.src
              }
              label={
                subtitle.label
              }
              srcLang={
                subtitle.lang
              }
            />
          )
        )}

        {subUrl && (
          <track
            kind="subtitles"
            src={
              subUrl
            }
            label={
              subName ||
              "Sous-titre"
            }
          />
        )}
      </video>

      {/* =================================================
          AD
      ================================================= */}

      {isPlayingAd &&
        adConfig?.url && (
          <div className="absolute inset-0 z-10 bg-black">
            <video
              ref={
                adVideoRef
              }
              src={
                adConfig.url
              }
              autoPlay
              playsInline
              onLoadedMetadata={
                handleAdLoadedMetadata
              }
              onTimeUpdate={
                handleAdTimeUpdate
              }
              onEnded={
                handleAdEnded
              }
              className="h-full w-full object-contain"
            />

            <div className="pointer-events-none absolute bottom-10 left-8 z-30 flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />

              <span>
                Publicité
              </span>

              <span className="text-white/30">
                •
              </span>

              <span className="font-mono text-amber-300">
                {formatTime(
                  adRemainingTime
                )}
              </span>
            </div>
          </div>
        )}

      {/* =================================================
          SUB FILE INPUT
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

          if (
            file
          ) {
            loadSubtitleFile(
              file
            );
          }

          event.target.value =
            "";
        }}
      />

      {/* =================================================
          BUFFER
      ================================================= */}

      {buffering &&
        !error &&
        !isPlayingAd && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <Loader2 className="h-11 w-11 animate-spin text-[#d8ccff]" />
          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error &&
        !isPlayingAd && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-[#060608]/95 px-6 text-center">
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
                  onClick={
                    onBack
                  }
                  className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium hover:bg-white/10"
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

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent px-5 pb-12 pt-5 transition-opacity sm:px-8",

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
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0 pt-1">
          {isLive &&
            !isPlayingAd && (
              <span className="mb-1 inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />

                Live
              </span>
            )}

          <h2 className="truncate text-lg font-semibold drop-shadow">
            {title}
          </h2>

          {!isLive &&
            isTranscode &&
            total >
              0 && (
              <p className="mt-0.5 text-[10px] text-white/30">
                Audio optimisé web ·{" "}
                {formatTime(
                  total
                )}
              </p>
            )}
        </div>
      </div>

      {/* =================================================
          BOTTOM CONTROLS
      ================================================= */}

      {!isPlayingAd && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-5 pb-5 pt-16 transition-opacity sm:px-8",

            controlsOn
              ? "opacity-100"
              : "opacity-0"
          )}
        >
          {/* =============================================
              TIMELINE
          ============================================= */}

          {!isLive && (
            <div className="mb-3 flex items-center gap-3 text-xs tabular-nums text-white/60">
              <span className="w-12 text-right">
                {formatTime(
                  scrub ??
                    displayCurrent
                )}
              </span>

              <input
                type="range"
                min={
                  0
                }
                max={
                  total ||
                  0
                }
                step={
                  1
                }
                value={
                  total >
                  0
                    ? Math.min(
                        scrub ??
                          displayCurrent,
                        total
                      )
                    : 0
                }
                disabled={
                  !seekable ||
                  total <=
                    0
                }
                onInput={(
                  event
                ) => {
                  setScrub(
                    Number(
                      (
                        event.target as HTMLInputElement
                      ).value
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
                onKeyUp={(
                  event
                ) => {
                  if (
                    event.key ===
                      "ArrowLeft" ||
                    event.key ===
                      "ArrowRight" ||
                    event.key ===
                      "Home" ||
                    event.key ===
                      "End"
                  ) {
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
                  }
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#d8ccff] disabled:cursor-default disabled:opacity-40 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d8ccff]"
                style={
                  total >
                  0
                    ? {
                        background: `linear-gradient(to right, #d8ccff ${progressPercent}%, rgba(255,255,255,.20) ${progressPercent}%)`,
                      }
                    : undefined
                }
              />

              <span className="w-12">
                {total >
                0
                  ? formatTime(
                      total
                    )
                  : "—:—"}
              </span>
            </div>
          )}

          {/* =============================================
              BUTTONS
          ============================================= */}

          <div className="flex items-center gap-3 sm:gap-4">
            {/* PLAY */}

            <button
              onClick={
                togglePlay
              }
              className="text-white transition-transform hover:scale-110"
              title="Lecture / Pause"
            >
              {playing ? (
                <Pause className="h-7 w-7 fill-white" />
              ) : (
                <Play className="h-7 w-7 fill-white" />
              )}
            </button>

            {/* SEEK */}

            {seekable && (
              <>
                <button
                  onClick={() =>
                    seek(
                      displayCurrent -
                        10
                    )
                  }
                  className="relative text-white/90 transition-transform hover:scale-110"
                  title="-10 sec"
                >
                  <RotateCcw className="h-6 w-6" />

                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">
                    10
                  </span>
                </button>

                <button
                  onClick={() =>
                    seek(
                      displayCurrent +
                        10
                    )
                  }
                  className="relative text-white/90 transition-transform hover:scale-110"
                  title="+10 sec"
                >
                  <RotateCw className="h-6 w-6" />

                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">
                    10
                  </span>
                </button>
              </>
            )}

            {/* NEXT */}

            {!isLive &&
              hasNext && (
                <button
                  onClick={
                    onNext
                  }
                  className="text-white/90 transition-transform hover:scale-110"
                  title="Suivant"
                >
                  <SkipForward className="h-6 w-6 fill-white/90" />
                </button>
              )}

            {/* VOLUME */}

            <div className="flex items-center gap-2.5">
              <button
                onClick={
                  toggleMute
                }
                className="shrink-0 text-white"
                title="Muet"
              >
                {muted ||
                volume ===
                  0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
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
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[#d8ccff] sm:w-24 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              {/* =========================================
                  SUBTITLES
              ========================================= */}

              <div className="relative">
                <button
                  onClick={() =>
                    setCapMenu(
                      (
                        value
                      ) =>
                        !value
                    )
                  }
                  className={cn(
                    "transition-transform hover:scale-110",

                    activeTrack >=
                      0
                      ? "text-[#d8ccff]"
                      : "text-white/90"
                  )}
                  title="Sous-titres"
                >
                  <Captions className="h-6 w-6" />
                </button>

                {capMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() =>
                        setCapMenu(
                          false
                        )
                      }
                    />

                    <div className="absolute bottom-10 right-0 z-20 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111116]/95 py-1 text-sm backdrop-blur-2xl">
                      <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/30">
                        Sous-titres
                      </p>

                      <button
                        onClick={() => {
                          selectTrack(
                            -1
                          );

                          setCapMenu(
                            false
                          );
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10"
                      >
                        <span>
                          Off
                        </span>

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
                            key={
                              `${track.index}-${track.label}`
                            }
                            onClick={() => {
                              selectTrack(
                                track.index
                              );

                              setCapMenu(
                                false
                              );
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-white/10"
                          >
                            <span className="truncate">
                              {
                                track.label
                              }
                            </span>

                            {activeTrack ===
                              track.index && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#d8ccff]" />
                            )}
                          </button>
                        )
                      )}

                      {trackList.length ===
                        0 && (
                        <p className="px-3 py-2 text-xs text-white/30">
                          Aucun sous-titre intégré.
                        </p>
                      )}

                      <div className="my-1 h-px bg-white/10" />

                      <button
                        onClick={() => {
                          subFileRef.current?.click();

                          setCapMenu(
                            false
                          );
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[#d8ccff] hover:bg-white/10"
                      >
                        <Upload className="h-3.5 w-3.5" />

                        Charger un fichier…
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* =========================================
                  SPEED
              ========================================= */}

              {!isLive && (
                <div className="relative">
                  <button
                    onClick={() =>
                      setSpeedMenu(
                        (
                          value
                        ) =>
                          !value
                      )
                    }
                    className={cn(
                      "flex items-center gap-1 transition-transform hover:scale-110",

                      speed !==
                        1
                        ? "text-[#d8ccff]"
                        : "text-white/90"
                    )}
                    title="Vitesse"
                  >
                    <Gauge className="h-6 w-6" />

                    {speed !==
                      1 && (
                      <span className="text-xs font-semibold">
                        {speed}x
                      </span>
                    )}
                  </button>

                  {speedMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() =>
                          setSpeedMenu(
                            false
                          )
                        }
                      />

                      <div className="absolute bottom-10 right-0 z-20 w-28 overflow-hidden rounded-xl border border-white/10 bg-[#111116]/95 py-1 text-sm backdrop-blur-2xl">
                        {SPEEDS.map(
                          (
                            value
                          ) => (
                            <button
                              key={
                                value
                              }
                              onClick={() =>
                                applySpeed(
                                  value
                                )
                              }
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10"
                            >
                              <span>
                                {value ===
                                1
                                  ? "Normal"
                                  : `${value}x`}
                              </span>

                              {speed ===
                                value && (
                                <Check className="h-3.5 w-3.5 text-[#d8ccff]" />
                              )}
                            </button>
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PIP */}

              <button
                onClick={
                  togglePip
                }
                className="text-white/90 transition-transform hover:scale-110"
                title="Picture in Picture"
              >
                <PictureInPicture2 className="h-6 w-6" />
              </button>

              {/* FULLSCREEN */}

              <button
                onClick={
                  toggleFs
                }
                className="text-white/90 transition-transform hover:scale-110"
                title="Plein écran"
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
    </div>
  );
}

export default VideoPlayer;