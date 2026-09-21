"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  PictureInPicture2, Loader2, AlertTriangle, SkipForward, ArrowLeft,
  RotateCcw, RotateCw, Captions, Gauge, Check, Upload,
} from "lucide-react";
import { attach, type EngineHandle } from "@/lib/player/engine";
import { cn, formatTime } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

let liveZapCount = 0;

function srtToVtt(text: string): string {
  const body = text
    .replace(/\r+/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return /^WEBVTT/.test(body.trimStart()) ? body : `WEBVTT\n\n${body}`;
}

export function VideoPlayer({
  sources,
  ext,
  isLive,
  title,
  poster,
  channelIcon,
  startTime = 0,
  hasNext,
  onNext,
  onBack,
  onProgress,
  onEnded,
  subtitles = [],
  knownDuration = 0,
}: {
  sources: string[];
  ext: string;
  isLive: boolean;
  title: string;
  poster?: string;
  channelIcon?: string;
  startTime?: number;
  hasNext?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  subtitles?: Array<{ label: string; src: string; lang?: string }>;
  knownDuration?: number;
}) {
  const extSubs = subtitles;
  const videoRef = useRef<HTMLVideoElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subFileRef = useRef<HTMLInputElement>(null);

  const activePoster = poster || channelIcon;

  // --- ÉTATS ADSERVER ---
  const [adConfig, setAdConfig] = useState<{ url: string; triggerTime: number } | null>(null);
  const [isPlayingAd, setIsPlayingAd] = useState<boolean>(false);
  const [adPlayed, setAdPlayed] = useState<boolean>(false);
  const [adDuration, setAdDuration] = useState<number>(0);
  const [adCurrentTime, setAdCurrentTime] = useState<number>(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsOn, setControlsOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [srcIdx, setSrcIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speedMenu, setSpeedMenu] = useState(false);
  const [subUrl, setSubUrl] = useState<string | null>(null);
  const [subName, setSubName] = useState<string | null>(null);
  const [capMenu, setCapMenu] = useState(false);
  const [trackList, setTrackList] = useState<Array<{ index: number; label: string }>>([]);
  const [activeTrack, setActiveTrack] = useState<number>(-1);

  const [seekBase, setSeekBase] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  // --- RESOLUTION SOURCE DE LECTURE ---
  let rawSrc = sources[srcIdx] ?? sources[0];

  if (rawSrc && (rawSrc.includes("/api/transcode") || rawSrc.includes("/api/show"))) {
    rawSrc = rawSrc.replace(/\/api\/(transcode|show)/, "/api/stream-vod");
  }

  const isTranscode = !!rawSrc && rawSrc.includes("/api/stream-vod");
  const src = isTranscode && seekBase > 0 ? `${rawSrc}&t=${Math.floor(seekBase)}` : rawSrc;

  const seekable = !isLive;
  const total = isTranscode ? (knownDuration || 0) : duration;
  const displayCurrent = isTranscode ? seekBase + current : current;

  const currentMedia = isLive ? "live" : (ext === "series" ? "series" : "movie");

  // COMPTEUR DE ZAPPING LIVE
  useEffect(() => {
    setSrcIdx(0);
    setSeekBase(startTime || 0);
    setAdPlayed(false);
    setIsPlayingAd(false);
    setAdCurrentTime(0);
    setAdDuration(0);

    if (isLive) {
      liveZapCount += 1;
    }
  }, [sources, startTime, isLive]);

  // --- REQUÊTE ADSERVER ---
  useEffect(() => {
    let active = true;

    const fetchAd = async () => {
      if (isLive && liveZapCount === 1) {
        if (active) setIsPlayingAd(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_ADSERVER_API || "/api/ad";
      const baseUrl = apiUrl.startsWith("http")
        ? apiUrl
        : `${window.location.origin}${apiUrl}`;
      
      const endpoint = `${baseUrl}?media=${currentMedia}&slot=Mid-Roll`;

      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();

        if (active && data.status === "success" && data.ad && data.ad.video_url) {
          setAdConfig({
            url: data.ad.video_url,
            triggerTime: Number(data.ad.trigger_time) || 30,
          });
        }
      } catch (err) {
        console.error("Erreur AdServer:", err);
      }
    };

    fetchAd();

    return () => {
      active = false;
    };
  }, [currentMedia, sources, isLive]);

  // --- MINUTEUR PUB CHAÎNES LIVE ---
  useEffect(() => {
    if (!isLive || liveZapCount <= 1 || !adConfig || adPlayed) return;

    const timer = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlayingAd(true);
      setAdPlayed(true);
    }, (adConfig.triggerTime || 30) * 1000);

    return () => clearTimeout(timer);
  }, [isLive, adConfig, adPlayed]);

  const tryFallback = useCallback(
    (msg: string) => {
      setSrcIdx((i) => {
        if (i < sources.length - 1) {
          setError(null);
          setBuffering(true);
          return i + 1;
        }
        setError(msg);
        return i;
      });
    },
    [sources.length],
  );

  // --- ATTACHEMENT DU FLUX PRINCIPAL ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cancelled = false;
    setBuffering(true);

    (async () => {
      try {
        engineRef.current?.destroy();
        engineRef.current = await attach(video, { url: src, ext, isLive });
        if (cancelled) return;
        if (!isPlayingAd) {
          video.play().catch(() => {});
        }
      } catch (e) {
        if (!cancelled) tryFallback((e as Error).message || "Playback failed");
      }
    })();

    const isLastSource = srcIdx >= sources.length - 1;
    const watchdog = setTimeout(
      () => {
        const v = videoRef.current;
        if (cancelled || !v || v.readyState >= 3) return;
        if (!isLastSource) {
          tryFallback("Stream slow to start — switching backup.");
        } else {
          setError("Stream inaccessible actuellement.");
        }
      },
      isLastSource ? 30000 : 12000,
    );

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [src, ext, isLive, tryFallback, srcIdx, sources.length, isPlayingAd]);

  // --- SUIVI TEMPS VOD / SÉRIES ---
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setError(null);
    };
    const onLoaded = () => {
      setDuration(v.duration || 0);
      if (!isLive && !isTranscode && startTime > 0 && startTime < (v.duration || Infinity)) {
        v.currentTime = startTime;
      }
    };

    const onTime = () => {
      const curTime = v.currentTime;
      setCurrent(curTime);
      setDuration(v.duration || 0);

      if (
        !isLive &&
        adConfig &&
        !adPlayed &&
        !isPlayingAd &&
        curTime >= adConfig.triggerTime &&
        curTime < adConfig.triggerTime + 2
      ) {
        v.pause();
        setIsPlayingAd(true);
        setAdPlayed(true);
      }

      if (isTranscode) {
        if (knownDuration > 0) onProgress?.(seekBase + curTime, knownDuration);
      } else {
        onProgress?.(curTime, v.duration || 0);
      }
    };

    const onEnd = () => onEnded?.();
    const onErr = () => tryFallback("Erreur de lecture de la source.");

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    v.addEventListener("error", onErr);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("error", onErr);
    };
  }, [ext, isLive, startTime, onProgress, onEnded, tryFallback, isTranscode, knownDuration, seekBase, adConfig, adPlayed, isPlayingAd]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingAd) {
      const adV = adVideoRef.current;
      if (!adV) return;
      if (adV.paused) adV.play().catch(() => {});
      else adV.pause();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, [isPlayingAd]);

  const seek = useCallback(
    (t: number) => {
      if (isLive || isPlayingAd) return;
      const target = Math.max(0, Math.min(t, total || Infinity));
      if (isTranscode) {
        setCurrent(0);
        setSeekBase(target);
      } else {
        const v = videoRef.current;
        if (v) v.currentTime = target;
      }
    },
    [isLive, isPlayingAd, isTranscode, total],
  );

  const toggleMute = useCallback(() => {
    const v = isPlayingAd ? adVideoRef.current : videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, [isPlayingAd]);

  const changeVolume = (val: number) => {
    const v = isPlayingAd ? adVideoRef.current : videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const togglePip = async () => {
    const v = isPlayingAd ? adVideoRef.current : videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {}
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed, src]);

  const applySpeed = (s: number) => {
    setSpeed(s);
    setSpeedMenu(false);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const loadSubtitleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const vtt = file.name.toLowerCase().endsWith(".vtt") ? raw : srtToVtt(raw);
      const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
      setSubUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setSubName(file.name);
      setTimeout(() => {
        const v = videoRef.current;
        if (v && v.textTracks.length) selectTrack(v.textTracks.length - 1);
      }, 250);
    };
    reader.readAsText(file);
  };

  const selectTrack = useCallback((idx: number) => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === idx ? "showing" : "disabled";
    }
    setActiveTrack(idx);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const refresh = () => {
      const list: Array<{ index: number; label: string }> = [];
      for (let i = 0; i < v.textTracks.length; i++) {
        const t = v.textTracks[i];
        list.push({ index: i, label: t.label || t.language || `Track ${i + 1}` });
      }
      setTrackList(list);
    };
    refresh();
    const t = setTimeout(refresh, 400);
    v.textTracks.addEventListener?.("addtrack", refresh);
    v.textTracks.addEventListener?.("removetrack", refresh);
    return () => {
      clearTimeout(t);
      v.textTracks.removeEventListener?.("addtrack", refresh);
      v.textTracks.removeEventListener?.("removetrack", refresh);
    };
  }, [subUrl, extSubs, src]);

  const showControls = useCallback(() => {
    setControlsOn(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const activeV = isPlayingAd ? adVideoRef.current : videoRef.current;
      if (!activeV?.paused) setControlsOn(false);
    }, 3000);
  }, [isPlayingAd]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      switch (e.key) {
        case " ": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": if (seekable && !isPlayingAd) seek(displayCurrent + 10); break;
        case "ArrowLeft": if (seekable && !isPlayingAd) seek(displayCurrent - 10); break;
        case "ArrowUp": changeVolume(Math.min(1, volume + 0.1)); break;
        case "ArrowDown": changeVolume(Math.max(0, volume - 0.1)); break;
        case "f": toggleFs(); break;
        case "m": toggleMute(); break;
        case "c":
          if (trackList.length && !isPlayingAd) selectTrack(activeTrack >= 0 ? -1 : 0);
          break;
        case "n": if (hasNext && !isPlayingAd) onNext?.(); break;
        case "Escape": if (!document.fullscreenElement) onBack?.(); break;
      }
      showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayCurrent, volume, seekable, isPlayingAd, togglePlay, seek, toggleFs, toggleMute, onBack, showControls, trackList, activeTrack, selectTrack, hasNext, onNext]);

  const handleAdLoadedMetadata = () => {
    if (adVideoRef.current) {
      const dur = adVideoRef.current.duration;
      if (dur && !isNaN(dur)) {
        setAdDuration(Math.floor(dur));
      }
    }
  };

  const handleAdTimeUpdate = () => {
    if (adVideoRef.current) {
      setAdCurrentTime(Math.floor(adVideoRef.current.currentTime));
      if (!adDuration && adVideoRef.current.duration) {
        setAdDuration(Math.floor(adVideoRef.current.duration));
      }
    }
  };

  const handleAdEnded = () => {
    setIsPlayingAd(false);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const adRemainingTime = Math.max(0, adDuration - adCurrentTime);

  return (
    <div
      ref={wrapRef}
      onMouseMove={showControls}
      onClick={showControls}
      className={cn(
        "group relative h-dvh w-full select-none bg-black",
        controlsOn ? "cursor-default" : "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        poster={activePoster}
        className={cn(
          "absolute inset-0 h-full w-full object-contain",
          isPlayingAd ? "hidden" : "block"
        )}
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFs}
      >
        {extSubs.map((s, i) => (
          <track key={`ext-${i}`} kind="subtitles" src={s.src} label={s.label} srcLang={s.lang} />
        ))}
        {subUrl && <track kind="subtitles" src={subUrl} label={subName || "Loaded file"} />}
      </video>

      {isPlayingAd && adConfig?.url && (
        <div className="relative h-full w-full bg-black z-10">
          <video
            ref={adVideoRef}
            src={adConfig.url}
            autoPlay
            playsInline
            onLoadedMetadata={handleAdLoadedMetadata}
            onTimeUpdate={handleAdTimeUpdate}
            onEnded={handleAdEnded}
            className="h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute bottom-10 left-8 z-30 flex items-center gap-3 rounded-lg border border-white/10 bg-black/60 px-4 py-2 font-sans text-sm font-semibold tracking-wide text-white backdrop-blur-md shadow-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Publicité</span>
            <span className="text-zinc-500">•</span>
            <span className="font-mono text-amber-400">{formatTime(adRemainingTime)}</span>
          </div>
        </div>
      )}

      <input
        ref={subFileRef}
        type="file"
        accept=".srt,.vtt,text/vtt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadSubtitleFile(f);
          e.target.value = "";
        }}
      />

      {buffering && !error && !isPlayingAd && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-12 w-12 animate-spin text-iris-400" />
        </div>
      )}

      {error && !isPlayingAd && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/90 px-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-iris-400" />
            <p className="text-lg font-semibold">Can’t play this stream</p>
            <p className="mt-2 text-sm text-fog-400">{error}</p>
            <button
              onClick={onBack}
              className="mt-6 rounded-xl bg-ink-700 px-5 py-2.5 text-sm font-medium hover:bg-ink-600"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent px-5 pb-12 pt-5 transition-opacity sm:px-8 z-20",
          controlsOn ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          onClick={onBack}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 pt-1">
          {isLive && !isPlayingAd && (
            <span className="mb-1 inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live
            </span>
          )}
          <h2 className="truncate text-lg font-semibold drop-shadow">{title}</h2>
        </div>
      </div>

      {!isPlayingAd && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-5 pt-16 transition-opacity sm:px-8 z-20",
            controlsOn ? "opacity-100" : "opacity-0",
          )}
        >
          {!isLive && (
            <div className="mb-3 flex items-center gap-3 text-xs tabular-nums text-fog-300">
              <span className="w-12 text-right">{formatTime(scrub ?? displayCurrent)}</span>
              <input
                type="range"
                min={0}
                max={total || 0}
                step={1}
                value={scrub ?? displayCurrent}
                disabled={!seekable || !total}
                onInput={(e) => setScrub(Number((e.target as HTMLInputElement).value))}
                onChange={(e) => {
                  seek(Number(e.target.value));
                  setScrub(null);
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-iris-400 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-iris-400"
                style={{
                  background: `linear-gradient(to right, var(--color-iris-400) ${
                    total ? ((scrub ?? displayCurrent) / total) * 100 : 0
                  }%, rgba(255,255,255,0.2) 0%)`,
                }}
              />
              <span className="w-12">{total ? formatTime(total) : "—:—"}</span>
            </div>
          )}

          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={togglePlay} className="text-white transition-transform hover:scale-110" title="Play/Pause (space)">
              {playing ? <Pause className="h-7 w-7 fill-white" /> : <Play className="h-7 w-7 fill-white" />}
            </button>

            {seekable && (
              <>
                <button onClick={() => seek(displayCurrent - 10)} className="relative text-white/90 transition-transform hover:scale-110" title="Back 10s (←)">
                  <RotateCcw className="h-6 w-6" />
                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">10</span>
                </button>
                <button onClick={() => seek(displayCurrent + 10)} className="relative text-white/90 transition-transform hover:scale-110" title="Forward 10s (→)">
                  <RotateCw className="h-6 w-6" />
                  <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">10</span>
                </button>
              </>
            )}

            {!isLive && hasNext && (
              <button onClick={onNext} className="text-white/90 transition-transform hover:scale-110" title="Next episode (n)">
                <SkipForward className="h-6 w-6 fill-white/90" />
              </button>
            )}

            <div className="flex items-center gap-2.5">
              <button onClick={toggleMute} className="shrink-0 text-white" title="Mute (m)">
                {muted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-iris-400 sm:w-24 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <div className="relative">
                <button
                  onClick={() => setCapMenu((v) => !v)}
                  className={cn("transition-transform hover:scale-110", activeTrack >= 0 ? "text-iris-400" : "text-white/90")}
                  title="Subtitles (c)"
                >
                  <Captions className="h-6 w-6" />
                </button>
                {capMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCapMenu(false)} />
                    <div className="absolute bottom-10 right-0 z-20 max-h-72 w-56 overflow-y-auto rounded-xl panel py-1 text-sm">
                      <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-fog-500">Subtitles</p>
                      <button
                        onClick={() => { selectTrack(-1); setCapMenu(false); }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10"
                      >
                        <span>Off</span>
                        {activeTrack === -1 && <Check className="h-3.5 w-3.5 text-iris-400" />}
                      </button>
                      {trackList.map((t) => (
                        <button
                          key={t.index}
                          onClick={() => { selectTrack(t.index); setCapMenu(false); }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-white/10"
                        >
                          <span className="truncate">{t.label}</span>
                          {activeTrack === t.index && <Check className="h-3.5 w-3.5 shrink-0 text-iris-400" />}
                        </button>
                      ))}
                      {trackList.length === 0 && (
                        <p className="px-3 py-1.5 text-xs text-fog-500">No embedded captions found.</p>
                      )}
                      <div className="my-1 h-px bg-white/10" />
                      <button
                        onClick={() => { subFileRef.current?.click(); setCapMenu(false); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-iris-300 hover:bg-white/10"
                      >
                        <Upload className="h-3.5 w-3.5" /> Load from file…
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!isLive && (
                <div className="relative">
                  <button
                    onClick={() => setSpeedMenu((v) => !v)}
                    className={cn("flex items-center gap-1 transition-transform hover:scale-110", speed !== 1 ? "text-iris-400" : "text-white/90")}
                    title="Playback speed"
                  >
                    <Gauge className="h-6 w-6" />
                    {speed !== 1 && <span className="text-xs font-semibold">{speed}x</span>}
                  </button>
                  {speedMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSpeedMenu(false)} />
                      <div className="absolute bottom-10 right-0 z-20 w-28 overflow-hidden rounded-xl panel py-1 text-sm">
                        {SPEEDS.map((s) => (
                          <button
                            key={s}
                            onClick={() => applySpeed(s)}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10"
                          >
                            <span>{s === 1 ? "Normal" : `${s}x`}</span>
                            {speed === s && <Check className="h-3.5 w-3.5 text-iris-400" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button onClick={togglePip} className="text-white/90 transition-transform hover:scale-110" title="Picture in picture">
                <PictureInPicture2 className="h-6 w-6" />
              </button>
              <button onClick={toggleFs} className="text-white/90 transition-transform hover:scale-110" title="Fullscreen (f)">
                {fullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;