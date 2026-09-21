"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize, Radio, Tv, Volume2, VolumeX } from "lucide-react";
import { attach, EngineHandle } from "@/lib/playerEngine";

interface VideoPlayerProps {
  sources: string[];
  ext?: string;
  isLive?: boolean;
  title?: string;
  poster?: string;
  channelIcon?: string;
}

export function VideoPlayer({
  sources,
  ext = "m3u8",
  isLive = true,
  title,
  poster,
  channelIcon,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sources.length || !sources[0]) return;

    let handle: EngineHandle | null = null;
    let isMounted = true;

    setLoading(true);
    setError(false);

    const streamUrl = sources[0];

    // Attacher le moteur (HLS.js ou Natif)
    attach(video, { url: streamUrl, ext, isLive }).then((engineHandle) => {
      if (isMounted) {
        handle = engineHandle;
      } else {
        engineHandle.destroy();
      }
    });

    // Événements de lecture pour le spinner
    const handleCanPlay = () => isMounted && setLoading(false);
    const handleError = () => {
      if (isMounted) {
        setLoading(false);
        setError(true);
      }
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      isMounted = false;
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handleCanPlay);
      video.removeEventListener("error", handleError);

      if (handle) {
        handle.destroy();
      }
    };
  }, [sources, ext, isLive]);

  // Bascule Muet / Son
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Plein écran + Rotation automatique Paysage sur Mobile
  const handleTriggerFullScreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }

        if (
          typeof window !== "undefined" &&
          window.screen?.orientation &&
          "lock" in window.screen.orientation
        ) {
          // @ts-ignore
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        if (
          typeof window !== "undefined" &&
          window.screen?.orientation &&
          "unlock" in window.screen.orientation
        ) {
          // @ts-ignore
          window.screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.error("Erreur plein écran:", err);
    }
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleTriggerFullScreen}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden group/player select-none"
    >
      {/* Overlay Header Glassmorphism au survol */}
      <div className="absolute top-0 left-0 right-0 h-14 md:h-16 px-4 md:px-6 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent z-30 opacity-100 md:opacity-0 md:group-hover/player:opacity-100 transition-opacity duration-300 pointer-events-auto">
        <div className="flex items-center space-x-3 min-w-0">
          {channelIcon && (
            <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/20 p-1 flex items-center justify-center shadow-lg flex-shrink-0">
              <img
                src={channelIcon}
                alt={title || "Chaîne"}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="text-xs font-black text-white truncate">{title}</h3>
            )}
            {isLive && (
              <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> Direct HD
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={toggleMute}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-white backdrop-blur-md transition-all active:scale-95"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleTriggerFullScreen}
            className="p-2 bg-white text-black font-bold border border-white rounded-xl transition-all active:scale-95 flex items-center space-x-1.5 text-xs shadow-lg"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overlay de Chargement */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 space-y-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-xs font-bold text-zinc-400">Connexion au flux vidéo...</p>
        </div>
      )}

      {/* Overlay d'Erreur */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 text-white p-4 text-center space-y-2">
          <Tv className="w-10 h-10 text-zinc-600 stroke-1" />
          <p className="text-xs font-bold text-red-500">Erreur de lecture du flux</p>
          <p className="text-[10px] text-zinc-500">
            Le flux est indisponible ou a été interrompu par le serveur.
          </p>
        </div>
      )}

      {/* Element Vidéo Natif */}
      <video
        ref={videoRef}
        poster={poster}
        autoPlay
        playsInline
        className="w-full h-full object-contain bg-black block"
      />
    </div>
  );
}