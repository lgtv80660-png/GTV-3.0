"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

import { attach, type EngineHandle } from "@/lib/player/engine";
import { cn, formatTime } from "@/lib/utils";

/* =========================================================
   TYPES
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
};

/* =========================================================
   CONFIG
========================================================= */

let liveZapCount = 0;

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
}: LivePlayerProps) {
  /* =======================================================
     REFS
  ======================================================= */
  const videoRef = useRef<HTMLVideoElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlayingAdRef = useRef(false);
  const recoveringFromAdRef = useRef(false);
  const postAdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* =======================================================
     STABLE KEYS & POSTER
  ======================================================= */
  const sourcesKey = sources.join("||");
  const activePoster = poster || channelIcon;

  /* =======================================================
     ADS STATE
  ======================================================= */
  const [adConfig, setAdConfig] = useState<{ url: string; triggerTime: number } | null>(null);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [adPlayed, setAdPlayed] = useState(false);
  const [adDuration, setAdDuration] = useState(0);
  const [adCurrentTime, setAdCurrentTime] = useState(0);

  /* =======================================================
     PLAYER STATE
  ======================================================= */
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsOn, setControlsOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [srcIdx, setSrcIdx] = useState(0);

  /* =======================================================
     REF SYNC
  ======================================================= */
  useEffect(() => {
    isPlayingAdRef.current = isPlayingAd;
  }, [isPlayingAd]);

  /* =======================================================
     SOURCE RESOLUTION (Simplifiée pour le Live)
  ======================================================= */
  const src = sources[srcIdx] || "";

  /* =======================================================
     RESET MEDIA (Zapping)
  ======================================================= */
  useEffect(() => {
    setSrcIdx(0);
    setError(null);
    setBuffering(true);

    // Reset Ads
    setAdPlayed(false);
    setIsPlayingAd(false);
    setAdConfig(null);
    isPlayingAdRef.current = false;
    recoveringFromAdRef.current = false;
    setAdDuration(0);
    setAdCurrentTime(0);

    if (postAdTimerRef.current) clearTimeout(postAdTimerRef.current);

    // Incrémenter le zap pour la règle du "1er zap gratuit"
    liveZapCount += 1;
  }, [sourcesKey]);

  /* =======================================================
     ADSERVER
  ======================================================= */
  useEffect(() => {
    let active = true;

    const fetchAd = async () => {
      // 1er zap gratuit !
      if (liveZapCount === 1) return;

      const apiUrl = process.env.NEXT_PUBLIC_ADSERVER_API || "/api/ad";
      const baseUrl = apiUrl.startsWith("http") ? apiUrl : `${window.location.origin}${apiUrl}`;
      const endpoint = `${baseUrl}?media=live&slot=Mid-Roll`;

      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        if (active && data?.status === "success" && data?.ad?.video_url) {
          setAdConfig({
            url: data.ad.video_url,
            triggerTime: Number(data.ad.trigger_time) || 10, // Pub 10s après le zapping par défaut
          });
        }
      } catch {}
    };

    fetchAd();
    return () => { active = false; };
  }, [sourcesKey]);

  /* =======================================================
     FALLBACK
  ======================================================= */
  const tryFallback = useCallback((message: string) => {
    setSrcIdx((index) => {
      if (index < sources.length - 1) {
        setError(null);
        setBuffering(true);
        return index + 1;
      }
      setError(message);
      return index;
    });
  }, [sources.length]);

  /* =======================================================
     ATTACH STREAM (HLSSG / Live)
  ======================================================= */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let cancelled = false;
    setBuffering(true);

    (async () => {
      try {
        engineRef.current?.destroy();
        engineRef.current = await attach(video, { url: src, ext, isLive: true });

        if (cancelled) return;

        if (recoveringFromAdRef.current) {
          recoveringFromAdRef.current = false;
          try { await video.play(); } catch {}
          return;
        }

        if (!isPlayingAdRef.current) {
          try { await video.play(); } catch {}
        }
      } catch (err) {
        if (!cancelled) {
          tryFallback((err as Error).message || "Playback failed");
        }
      }
    })();

    const isLastSource = srcIdx >= sources.length - 1;
    const watchdog = setTimeout(() => {
      const activeVideo = videoRef.current;
      if (cancelled || !activeVideo || activeVideo.readyState >= 3) return;
      if (!isLastSource) {
        tryFallback("Stream slow to start — switching backup.");
      } else {
        setError("Flux Live indisponible actuellement.");
      }
    }, isLastSource ? 30000 : 12000);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [src, ext, srcIdx, sources.length, tryFallback]);

  /* =======================================================
     MAIN VIDEO EVENTS
  ======================================================= */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setError(null); };

    const onTime = () => {
      const localTime = video.currentTime || 0;

      // Déclencheur de pub basé sur le temps passé sur la chaîne (localTime)
      if (
        adConfig &&
        !adPlayed &&
        !isPlayingAdRef.current &&
        localTime >= adConfig.triggerTime
      ) {
        isPlayingAdRef.current = true;
        video.pause();
        setAdPlayed(true);
        setIsPlayingAd(true);
      }
    };

    const onErr = () => {
      if (isPlayingAdRef.current) return;
      tryFallback("Erreur de lecture du direct.");
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", onErr);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onErr);
    };
  }, [tryFallback, adConfig, adPlayed]);

  /* =======================================================
     FULLSCREEN STATE
  ======================================================= */
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* =======================================================
     PLAY / PAUSE
  ======================================================= */
  const togglePlay = useCallback(() => {
    if (isPlayingAdRef.current) {
      const ad = adVideoRef.current;
      if (!ad) return;
      if (ad.paused) ad.play().catch(() => {});
      else ad.pause();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  /* =======================================================
     VOLUME
  ======================================================= */
  const toggleMute = useCallback(() => {
    const video = isPlayingAdRef.current ? adVideoRef.current : videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const changeVolume = (value: number) => {
    const main = videoRef.current;
    const ad = adVideoRef.current;
    if (main) { main.volume = value; main.muted = value === 0; }
    if (ad) { ad.volume = value; ad.muted = value === 0; }
    setVolume(value);
    setMuted(value === 0);
  };

  /* =======================================================
     FULLSCREEN & PIP
  ======================================================= */
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else wrapRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {}
  };

  /* =======================================================
     CONTROLS AUTO HIDE
  ======================================================= */
  const showControls = useCallback(() => {
    setControlsOn(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const video = isPlayingAdRef.current ? adVideoRef.current : videoRef.current;
      if (video && !video.paused) setControlsOn(false);
    }, 3000);
  }, []);

  /* =======================================================
     KEYBOARD (Flèches pour Zapper)
  ======================================================= */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          // Flèche droite = Chaîne suivante (Zapping)
          if (hasNext && !isPlayingAdRef.current) onNext?.();
          break;
        case "ArrowUp":
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case "f":
          toggleFs();
          break;
        case "m":
          toggleMute();
          break;
        case "Escape":
          if (!document.fullscreenElement) onBack?.();
          break;
      }
      showControls();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [volume, hasNext, onNext, onBack, togglePlay, toggleFs, toggleMute, showControls]);

  /* =======================================================
     AD EVENTS & RECOVERY
  ======================================================= */
  const handleAdEnded = () => {
    const video = videoRef.current;
    isPlayingAdRef.current = false;
    setIsPlayingAd(false);
    setAdCurrentTime(0);

    if (!video) return;
    if (postAdTimerRef.current) clearTimeout(postAdTimerRef.current);

    postAdTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v) v.play().catch(() => {});
    }, 80);
  };

  const adRemainingTime = Math.max(0, adDuration - adCurrentTime);

  /* =======================================================
     UI
  ======================================================= */
  return (
    <div
      ref={wrapRef}
      onMouseMove={showControls}
      onClick={showControls}
      className={cn(
        "group relative h-full min-h-0 w-full select-none overflow-hidden bg-black",
        controlsOn ? "cursor-default" : "cursor-none"
      )}
    >
      {/* MAIN VIDEO */}
      <video
        ref={videoRef}
        poster={activePoster}
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFs}
        className={cn(
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
          isPlayingAd ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      />

      {/* PUBLICITÉ */}
      {isPlayingAd && adConfig?.url && (
        <div className="absolute inset-0 z-10 bg-black">
          <video
            ref={adVideoRef}
            src={adConfig.url}
            autoPlay
            playsInline
            onLoadedMetadata={() => setAdDuration(Math.floor(adVideoRef.current?.duration || 0))}
            onTimeUpdate={() => setAdCurrentTime(Math.floor(adVideoRef.current?.currentTime || 0))}
            onEnded={handleAdEnded}
            className="h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute bottom-10 left-8 z-30 flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
            <span>Publicité</span>
            <span className="text-white/30">•</span>
            <span className="font-mono text-amber-300">{formatTime(adRemainingTime)}</span>
          </div>
        </div>
      )}

      {/* BUFFER & ERRORS */}
      {buffering && !error && !isPlayingAd && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <Loader2 className="h-11 w-11 animate-spin text-[#d8ccff]" />
        </div>
      )}

      {error && !isPlayingAd && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#060608]/95 px-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-[#d8ccff]" />
            <p className="text-lg font-semibold">Flux Live interrompu</p>
            <p className="mt-2 text-sm text-white/40">{error}</p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium hover:bg-white/10"
              >
                Retour
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent px-5 pb-12 pt-5 transition-opacity sm:px-8",
          controlsOn ? "opacity-100" : "opacity-0"
        )}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 pt-1">
          {!isPlayingAd && (
            <span className="mb-1 inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Direct
            </span>
          )}
          <h2 className="truncate text-lg font-semibold drop-shadow">{title}</h2>
        </div>
      </div>

      {/* BOTTOM CONTROLS (Live simplifié) */}
      {!isPlayingAd && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/95 via-black/60 to-transparent px-5 pb-5 pt-16 transition-opacity sm:px-8",
            controlsOn ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white transition-transform hover:scale-110">
              {playing ? <Pause className="h-7 w-7 fill-white" /> : <Play className="h-7 w-7 fill-white" />}
            </button>

            {/* Bouton Chaîne Suivante */}
            {hasNext && (
              <button onClick={onNext} className="text-white/90 transition-transform hover:scale-110" title="Chaîne suivante">
                <SkipForward className="h-6 w-6 fill-white/90" />
              </button>
            )}

            <div className="flex items-center gap-2.5 ml-2">
              <button onClick={toggleMute} className="shrink-0 text-white">
                {muted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[#d8ccff] sm:w-24 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={togglePip} className="text-white/90 transition-transform hover:scale-110">
              <PictureInPicture2 className="h-6 w-6" />
            </button>
            <button onClick={toggleFs} className="text-white/90 transition-transform hover:scale-110">
              {fullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LivePlayer;