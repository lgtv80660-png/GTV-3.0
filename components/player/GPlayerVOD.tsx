"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { attach, type EngineHandle } from "@/lib/player/engine";
import { isVodHlsSource, vodHlsSource } from "@/lib/vod-hls";

import { GPlayerCore } from "./GPlayerCore";
import { GPlayerState } from "./GPlayerState";
import { GPlayerPersistence } from "./GPlayerPersistence";
import GPlayerControls from "./GPlayerControls";

const PHP_ADSERVER_URL =
  "https://gmz.alwaysdata.net/cinepub-studio/api.php";

type AdCampaign = {
  id: string;
  asset_url: string;
  trigger_time: number;
  duration_seconds: number | null;
};

type Props = {
  id: string;
  src: string;
  ext?: string;
  title?: string;
  poster?: string;
  titleLogo?: string;
  titleLogoReady?: boolean;
  startTime?: number;
  onProgress?: (
    position: number,
    duration: number
  ) => void;
  onEnded?: () => void;
};

function dispose(
  engine: EngineHandle | null,
  video: HTMLVideoElement
) {
  if (engine && "destroy" in engine) {
    engine.destroy();
  } else {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

export default function GPlayerVOD(
  props: Props
) {
  return (
    <VODSession
      key={JSON.stringify([
        props.id,
        props.src,
        props.ext,
      ])}
      {...props}
    />
  );
}

function VODSession({
  id,
  src,
  ext,
  title,
  poster,
  titleLogo,
  onProgress,
  onEnded,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const coreRef =
    useRef<GPlayerCore | null>(null);

  const loadChain =
    useRef<Promise<void>>(Promise.resolve());

  const callbacks =
    useRef({
      onProgress,
      onEnded,
    });

  callbacks.current = {
    onProgress,
    onEnded,
  };

  const userPositionChosen =
    useRef(false);

  const metadataReady =
    useRef(false);

  const seekingRef =
    useRef(false);

  const [snapshot, setSnapshot] =
    useState(() =>
      new GPlayerState().get()
    );

  const [ready, setReady] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [playPrompt, setPlayPrompt] =
    useState(false);

  const [showIntro, setShowIntro] =
    useState(true);

  const adVideoRef = useRef<HTMLVideoElement>(null);
  const adsRef = useRef<AdCampaign[]>([]);
  const playedAdsRef = useRef(new Set<string>());
  const adPlayingRef = useRef(false);
  const adWasPlayingRef = useRef(false);

  const [adPlaying, setAdPlaying] = useState(false);
  const [activeAd, setActiveAd] = useState<AdCampaign | null>(null);
  const [adRemaining, setAdRemaining] = useState<number | null>(null);
  const [adError, setAdError] = useState<string | null>(null);
  const [adNeedsPlay, setAdNeedsPlay] = useState(false);

  const play = useCallback(() => {
    if (adPlayingRef.current) return;

    const core =
      coreRef.current;

    if (!core) {
      return;
    }

    setPlayPrompt(false);

    void core.play().catch(() => {
      if (coreRef.current === core) {
        setPlayPrompt(true);
      }
    });
  }, []);

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) return;

    const sessionAbort = new AbortController();
    let cancelled = false;
    const playback=crypto.randomUUID().replaceAll("-","");
    const stopBackend=()=>{void fetch("/api/vod-jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"stop",p:playback}),credentials:"same-origin",keepalive:true}).catch(()=>{});};
    window.addEventListener("pagehide",stopBackend);
    const heartbeat=window.setInterval(()=>{void fetch('/api/vod-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'touch',p:playback}),credentials:'same-origin'}).catch(()=>{});},15000);
    let engine: EngineHandle | null = null;

    let completed = false;
    let launchReady = false;
    let lastSave = 0;

    const persistence =
      new GPlayerPersistence();

    metadataReady.current = false;
    userPositionChosen.current = false;

    setReady(false);
    setPlayPrompt(false);
    setShowIntro(true);
    seekingRef.current = false;

    setError(
      src
        ? null
        : "Aucune source vidéo disponible."
    );

    const save = (force = false) => {
      const core =
        coreRef.current;

      if (
        cancelled ||
        !metadataReady.current ||
        !core ||
        video.readyState < 1
      ) {
        return;
      }

      const position =
        core.getCurrentTime();

      const duration =
        Number.isFinite(core.getDuration()) &&
        core.getDuration() > 0
          ? core.getDuration()
          : core.getDuration();

      callbacks.current.onProgress?.(
        position,
        duration
      );

      if (
        force ||
        Date.now() - lastSave >= 2000
      ) {
        persistence.save(
          id,
          position,
          duration
        );

        lastSave = Date.now();
      }
    };

    const core =
      new GPlayerCore(
        video,
        {
          onStateChange: state => {
            if (!cancelled) {
              setSnapshot({
                ...state,

                currentTime:
                  Number.isFinite(coreRef.current?.getCurrentTime() ?? video.currentTime)
                    ? (coreRef.current?.getCurrentTime() ?? video.currentTime)
                    : 0,

                duration:
                  Number.isFinite(coreRef.current?.getDuration() ?? video.duration) &&
                  (coreRef.current?.getDuration() ?? video.duration) > 0
                    ? (coreRef.current?.getDuration() ?? video.duration)
                    : state.duration,
              });

              setReady(
                metadataReady.current &&
                video.readyState >= 1
              );
            }
          },

          onMetadata: () => {
            if (
              cancelled ||
              video.readyState < 1
            ) {
              return;
            }

            setError(null);
          },

          onReady: () => {
            if (
              cancelled ||
              launchReady ||
              !metadataReady.current ||
              video.seeking ||
              video.readyState < 3
            ) {
              return;
            }

            launchReady = true;

            setReady(true);

            play();
          },

          onTimeUpdate: () => {
            save();
          },

          onPause: () => {
            save(true);
          },

          onPlay: () => {
            completed = false;

            setPlayPrompt(false);
          },

          onEnded: () => {
            completed = true;

            persistence.clear(id);

            callbacks.current.onEnded?.();
          },

          onError: () => {
            setError(
              "Lecture impossible. Vérifiez le flux ou le format vidéo."
            );
          },
        }
      );

    coreRef.current = core;

    const handlePlaying = () => {
      if (
        cancelled ||
        video.paused ||
        video.seeking ||
        video.readyState < 3
      ) {
        return;
      }

      seekingRef.current = false;
      setShowIntro(false);
    };

    const handleSeeking = () => {
      if (!cancelled) {
        seekingRef.current = true;
        setShowIntro(true);
      }
    };

    const seeked = () => {
      save(true);

      if (
        !cancelled &&
        metadataReady.current &&
        video.readyState >= 3
      ) {
        setReady(true);

        if (!launchReady) {
          launchReady = true;

          play();
        }
      }
    };

    loadChain.current =
      loadChain.current.then(async () => {
        if (
          cancelled ||
          !src
        ) {
          return;
        }

        try {
          const sourceUrl =
            vodHlsSource(src);

          const sourceExt =
            isVodHlsSource(sourceUrl)
              ? "m3u8"
              : ext || "mp4";

          if (cancelled) {
            return;
          }

          if (engine) {
            dispose(
              engine,
              video
            );
          }

          engine = null;

          video.pause();

          video.removeAttribute("src");

          video.load();

          metadataReady.current = false;

          setReady(false);

          setSnapshot(state => ({
            ...state,
            currentTime: 0,
            duration: 0
          }));

          core.setSource({
            url: (()=>{const u=new URL(sourceUrl,window.location.origin);if(u.origin===window.location.origin&&u.pathname.startsWith("/api/")){u.searchParams.set("p",playback);return u.pathname+u.search;}return sourceUrl;})(),
          });

          const handle =
            await attach(
              video,
              {
                url: (()=>{const u=new URL(sourceUrl,window.location.origin);if(u.origin===window.location.origin&&u.pathname.startsWith("/api/")){u.searchParams.set("p",playback);return u.pathname+u.search;}return sourceUrl;})(),
                ext: sourceExt,
                isLive: false,
                desktopSource: src,
                signal: sessionAbort.signal,
              }
            );

          if (cancelled) {
            dispose(
              handle,
              video
            );

            return;
          }

          engine = handle;
          core.setEngine(handle);

          if (
            metadataReady.current &&
            video.readyState >= 3 &&
            !launchReady
          ) {
            launchReady = true;

            play();
          }
        } catch (failure) {
          if (!cancelled) {
            setError(
              failure instanceof Error && failure.name==='MediaPolicyError' ? failure.message : "Impossible de charger la vidéo. Rouvrez le film pour réessayer."
            );
          }
        }
      });

    const handleDuration = () => {
      const duration = core.getDuration() || video.duration;

      if (cancelled) {
        return;
      }

      if (
        Number.isFinite(duration) &&
        duration > 0
      ) {
        setSnapshot(state => ({
          ...state,
          duration,
        }));
      }

      setReady(
        metadataReady.current &&
        video.readyState >= 1
      );
    };

    const handleMetadata = () => {
      if (cancelled) {
        return;
      }

      if (
        !metadataReady.current &&
        !userPositionChosen.current && engine?.kind !== "desktop"
      ) {
        video.currentTime = 0;
      }

      metadataReady.current = true;

      handleDuration();

      if (
        video.readyState >= 3 &&
        !launchReady
      ) {
        launchReady = true;

        play();
      }
    };

    video.addEventListener(
      "loadedmetadata",
      handleMetadata
    );

    video.addEventListener(
      "durationchange",
      handleDuration
    );

    video.addEventListener(
      "seeked",
      seeked
    );

    video.addEventListener(
      "seeking",
      handleSeeking
    );

    video.addEventListener(
      "playing",
      handlePlaying
    );

    return () => {
      save(true);

      cancelled = true;
      window.removeEventListener("pagehide",stopBackend);
      window.clearInterval(heartbeat);
      stopBackend();
      sessionAbort.abort();

      metadataReady.current = false;

      core.destroy();

      coreRef.current = null;

      video.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

      video.removeEventListener(
        "durationchange",
        handleDuration
      );

      video.removeEventListener(
        "seeked",
        seeked
      );

      video.removeEventListener(
        "seeking",
        handleSeeking
      );

      video.removeEventListener(
        "playing",
        handlePlaying
      );

      if (engine) {
        dispose(
          engine,
          video
        );
      }
    };
  }, [
    id,
    src,
    ext,
    play
  ]);

  useEffect(() => {
    const update = () => {
      setFullscreen(
        document.fullscreenElement ===
        containerRef.current
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const controller = new AbortController();
    const sessionAbort = new AbortController();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    adsRef.current = [];
    playedAdsRef.current.clear();
    adPlayingRef.current = false;
    adWasPlayingRef.current = false;
    setAdPlaying(false);
    setActiveAd(null);
    setAdRemaining(null);
    setAdError(null);
    setAdNeedsPlay(false);

    const checkAds = () => {
      if (
        cancelled ||
        adPlayingRef.current ||
        !metadataReady.current ||
        video.paused ||
        video.seeking ||
        video.ended ||
        video.readyState < 3
      ) {
        return;
      }

      const campaign = adsRef.current.find(ad =>
        !playedAdsRef.current.has(ad.id) &&
        video.currentTime >= ad.trigger_time
      );

      if (!campaign) return;

      adWasPlayingRef.current = !video.paused;
      adPlayingRef.current = true;
      playedAdsRef.current.add(campaign.id);

      video.pause();

      setActiveAd(campaign);
      setAdRemaining(campaign.duration_seconds);
      setAdError(null);
      setAdNeedsPlay(false);
      setAdPlaying(true);
    };

    const guardMoviePlayback = () => {
      if (adPlayingRef.current) {
        video.pause();
        return;
      }

      checkAds();
    };

    const fetchAds = async () => {
      try {
        const response = await fetch(PHP_ADSERVER_URL, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Ad server: ${response.status}`);
        }

        const payload: unknown = await response.json();

        if (
          !payload ||
          typeof payload !== "object" ||
          !("ads" in payload) ||
          !Array.isArray(payload.ads)
        ) {
          throw new Error("Réponse publicitaire invalide.");
        }

        const campaigns: AdCampaign[] = [];

        for (const item of payload.ads) {
          if (!item || typeof item !== "object") continue;

          const raw = item as Record<string, unknown>;

          if (
            typeof raw.asset_url !== "string" ||
            !raw.asset_url.trim() ||
            (raw.regie_type != null && raw.regie_type !== "vod") ||
            (raw.format != null && raw.format !== "full_video") ||
            (raw.trigger_type != null && raw.trigger_type !== "time") ||
            !["number", "string"].includes(typeof raw.trigger_time) ||
            String(raw.trigger_time).trim() === ""
          ) {
            continue;
          }

          const triggerTime = Number(raw.trigger_time);
          if (!Number.isFinite(triggerTime) || triggerTime < 0) continue;

          let assetUrl: URL;
          try {
            assetUrl = new URL(raw.asset_url, PHP_ADSERVER_URL);
          } catch {
            continue;
          }

          if (!["https:", "http:"].includes(assetUrl.protocol)) continue;

          const duration = Number(raw.duration_seconds);
          const campaignId =
            typeof raw.id === "string" || typeof raw.id === "number"
              ? String(raw.id)
              : `${assetUrl.href}:${triggerTime}`;

          if (campaigns.some(ad => ad.id === campaignId)) continue;

          campaigns.push({
            id: campaignId,
            asset_url: assetUrl.href,
            trigger_time: triggerTime,
            duration_seconds:
              Number.isFinite(duration) && duration > 0
                ? duration
                : null,
          });
        }

        if (cancelled) return;

        adsRef.current = campaigns.sort(
          (a, b) => a.trigger_time - b.trigger_time
        );

        checkAds();
      } catch (failure) {
        if (!cancelled && !controller.signal.aborted) {
          retryTimer = setTimeout(() => {
            void fetchAds();
          }, 5000);
        }
      }
    };

    video.addEventListener("timeupdate", checkAds);
    video.addEventListener("seeked", checkAds);
    video.addEventListener("play", guardMoviePlayback);
    video.addEventListener("playing", guardMoviePlayback);

    void fetchAds();

    return () => {
      cancelled = true;
      sessionAbort.abort();
      controller.abort();
      if (retryTimer !== null) clearTimeout(retryTimer);

      video.removeEventListener("timeupdate", checkAds);
      video.removeEventListener("seeked", checkAds);
      video.removeEventListener("play", guardMoviePlayback);
      video.removeEventListener("playing", guardMoviePlayback);

      adVideoRef.current?.pause();
      adPlayingRef.current = false;
    };
  }, [id, src, ext]);

  const startAdPlayback = useCallback(() => {
    const adVideo = adVideoRef.current;
    const movie = videoRef.current;
    if (!adVideo || !adPlayingRef.current) return;

    if (movie) {
      adVideo.volume = movie.volume;
      adVideo.muted = movie.muted;
    }

    setAdError(null);
    setAdNeedsPlay(false);

    void adVideo.play().catch(() => {
      if (
        adPlayingRef.current &&
        adVideoRef.current === adVideo
      ) {
        setAdNeedsPlay(true);
      }
    });
  }, []);

  useEffect(() => {
    if (activeAd) startAdPlayback();
  }, [activeAd, startAdPlayback]);

  const updateAdCountdown = () => {
    const adVideo = adVideoRef.current;
    if (!adVideo || !adPlayingRef.current) return;

    const duration =
      Number.isFinite(adVideo.duration) && adVideo.duration > 0
        ? adVideo.duration
        : activeAd?.duration_seconds;

    setAdRemaining(
      duration != null
        ? Math.ceil(Math.max(0, duration - adVideo.currentTime))
        : null
    );
  };

  const finishAd = () => {
    const movie = videoRef.current;
    const adVideo = adVideoRef.current;

    if (
      !adPlayingRef.current ||
      !movie ||
      !adVideo?.ended
    ) {
      return;
    }

    // The separate ad element leaves the paused movie at its original position.
    // Reloading stream-vod here would cancel play() and capture the ad pause.
    const shouldResume = adWasPlayingRef.current;
    adWasPlayingRef.current = false;

    adPlayingRef.current = false;
    setAdPlaying(false);
    setActiveAd(null);
    setAdRemaining(null);
    setAdError(null);
    setAdNeedsPlay(false);

    if (shouldResume) play();
  };

  const toggleFullscreen = () => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const video =
      videoRef.current as
      (
        HTMLVideoElement &
        {
          webkitEnterFullscreen?: () => void
        }
      ) | null;

    try {
      const operation =
        document.fullscreenElement
          ? document.exitFullscreen()
          : container.requestFullscreen
            ? container.requestFullscreen()
            : null;

      if (operation) {
        void operation.catch(
          () => setPlayPrompt(false)
        );
      } else {
        video?.webkitEnterFullscreen?.();
      }
    } catch {}
  };

  const togglePlay = () => {
    if (!ready || adPlayingRef.current) {
      return;
    }

    if (videoRef.current?.paused) {
      play();
    } else {
      coreRef.current?.pause();
    }
  };

  const seek = (
    position: number
  ) => {
    if (!ready || adPlayingRef.current) {
      return;
    }

    userPositionChosen.current = true;

    seekingRef.current = true;

    setShowIntro(true);

    coreRef.current?.seek(
      position
    );
  };

  const skip = (
    delta: number
  ) => {
    if (!ready || adPlayingRef.current) {
      return;
    }

    userPositionChosen.current = true;

    seekingRef.current = true;

    setShowIntro(true);

    coreRef.current?.skip(
      delta
    );
  };

  const keydown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const target =
      event.target as HTMLElement;

    if (adPlayingRef.current) {
      if (
        !target.closest("button") &&
        (
          event.code === "Space" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key.toLowerCase() === "f"
        )
      ) {
        event.preventDefault();
      }
      return;
    }

    if (
      target.closest(
        "input, textarea, select, [contenteditable='true']"
      ) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    if (
      event.code === "Space" &&
      target.closest("button")
    ) {
      return;
    }

    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      togglePlay();
    } else if (
      event.key === "ArrowLeft"
    ) {
      event.preventDefault();

      skip(-10);
    } else if (
      event.key === "ArrowRight"
    ) {
      event.preventDefault();

      skip(10);
    } else if (
      event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();

      toggleFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={keydown}
      className="relative h-full w-full overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      role="region"
      aria-label={
        title
          ? `Lecteur : ${title}`
          : "Lecteur VOD"
      }
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        aria-label={
          title || "Vidéo"
        }
        onDoubleClick={
          toggleFullscreen
        }
      />

      <GPlayerControls
        state={snapshot}
        fullscreen={fullscreen}
        disabled={
          !ready ||
          !!error ||
          adPlaying
        }
        onTogglePlay={
          togglePlay
        }
        onSeek={
          seek
        }
        onSkip={
          skip
        }
        onVolume={
          value =>
            coreRef.current?.setVolume(
              value
            )
        }
        onMute={() =>
          coreRef.current?.mute(
            !videoRef.current?.muted
          )
        }
        onFullscreen={
          toggleFullscreen
        }
      />

      {adPlaying && activeAd && (
        <div
          className="absolute inset-0 z-[60] flex flex-col bg-black"
          style={{ background: "black", opacity: 1 }}
          role="region"
          aria-label="Publicité obligatoire"
        >
          <video
            key={activeAd.id}
            ref={adVideoRef}
            src={activeAd.asset_url}
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload nofullscreen noremoteplayback"
            className="h-full w-full object-contain"
            aria-label="Vidéo publicitaire"
            onLoadedMetadata={updateAdCountdown}
            onDurationChange={updateAdCountdown}
            onTimeUpdate={updateAdCountdown}
            onPlaying={() => {
              setAdNeedsPlay(false);
              setAdError(null);
              updateAdCountdown();
            }}
            onEnded={finishAd}
            onError={() => {
              setAdError("Impossible de charger la publicité.");
              setAdNeedsPlay(false);
            }}
          />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 bg-black/80 px-5 py-4 text-white"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.25em]">
              PUBLICITÉ
            </span>
            <span className="text-sm tabular-nums" role="timer">
              {adRemaining === null
                ? "Chargement…"
                : `${adRemaining} s`}
            </span>
          </div>

          {(adError || adNeedsPlay) && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white"
              role="status"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.25em]">
                PUBLICITÉ
              </span>
              {adError && <p className="text-sm">{adError}</p>}
              <button
                type="button"
                className="rounded-full border border-white/30 px-6 py-3 text-sm"
                onClick={() => {
                  if (adError) adVideoRef.current?.load();
                  startAdPlayback();
                }}
              >
                {adError ? "Réessayer la publicité" : "Lancer la publicité"}
              </button>
            </div>
          )}
        </div>
      )}

      {showIntro && !error && (
<div
  className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black px-6"
  style={{
    background: "black",
    opacity: 1,
  }}
>
  <div
    className="text-center text-[10px] font-medium uppercase tracking-[0.45em] text-white/80 sm:text-xs"
    style={{
      fontFamily:
        '"Inter", "Helvetica Neue", Arial, sans-serif',
    }}
  >
    VOUS ALLEZ REGARDER
  </div>

  {titleLogo && (
    <img
      src={titleLogo}
      alt="title"
      className="max-h-28 w-auto max-w-[min(300px,75%)] object-contain drop-shadow-2xl"
    />
  )}

  <div
    className="flex justify-center"
    aria-hidden="true"
  >
    <video
      src="/intro/popcorn.webm"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className="h-24 w-24 object-contain"
    />
  </div>
</div>
      )}

      {(
        !ready ||
        error ||
        playPrompt
      ) && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-20
            flex
            items-center
            justify-center
            px-6
            text-center
            text-white
          "
          role="status"
        >
          {
            error ||
            (
              playPrompt
                ?
                <button
                  type="button"
                  onClick={play}
                  className="
                    pointer-events-auto
                    rounded-full
                    border
                    border-amber-100/40
                    bg-black/80
                    px-6
                    py-3
                  "
                >
                  Lancer la lecture
                </button>
                :
                "Chargement GPlayer…"
            )
          }
        </div>
      )}
    </div>
  );
}
