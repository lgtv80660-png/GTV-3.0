"use client";

import { useEffect, useRef, useState, type TransitionEvent } from "react";

type Props = {
  ready: boolean; playing: boolean; title?: string; titleLogo?: string;
  poster?: string; titleLogoReady?: boolean; onStart: () => void; onComplete: () => void;
};

export default function GPlayerIntro({ ready, playing, title, titleLogo, poster, titleLogoReady = true, onStart, onComplete }: Props) {
  const callback = useRef({ onStart, onComplete });
  callback.current = { onStart, onComplete };
  const started = useRef(false);
  const completed = useRef(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const [settledLogo, setSettledLogo] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<"hold" | "black" | "starting" | "reveal">("hold");
  const artworkReady = titleLogoReady && (!titleLogo || settledLogo === titleLogo);

  useEffect(() => {
    setLogoFailed(false);
    if (titleLogo && logoRef.current?.complete) {
      setSettledLogo(titleLogo);
      setLogoFailed(logoRef.current.naturalWidth === 0);
    }
  }, [titleLogo]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setMinimumElapsed(false);
    if (!artworkReady) return;
    const timer = window.setTimeout(() => setMinimumElapsed(true), 2400);
    return () => window.clearTimeout(timer);
  }, [artworkReady, titleLogo]);
  useEffect(() => {
    if (ready && artworkReady && minimumElapsed) setPhase(current => current === "hold" ? "black" : current);
  }, [ready, artworkReady, minimumElapsed]);

  const start = () => {
    if (started.current) return;
    started.current = true;
    setPhase("starting");
    callback.current.onStart();
  };
  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    callback.current.onComplete();
  };
  useEffect(() => {
    if (phase === "starting" && playing) setPhase("reveal");
    // Reduced motion has no CSS transitionend; keep the same media gates.
    if (phase === "black" && reducedMotion && !started.current) {
      started.current = true;
      setPhase("starting");
      callback.current.onStart();
    }
    if (phase === "reveal" && reducedMotion && !completed.current) {
      completed.current = true;
      callback.current.onComplete();
    }
  }, [phase, playing, reducedMotion]);
  const transitionEnded = (event: TransitionEvent<HTMLDivElement>) => event.target === event.currentTarget && event.propertyName === "opacity";

  return (
    <div className={`gplayer-intro ${phase} absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-black px-8 text-center text-white`} aria-label="Introduction cinéma" onTransitionEnd={event => { if (phase === "reveal" && transitionEnded(event)) complete(); }}>
      <div className="cinema-content relative flex h-full w-full flex-col items-center justify-center gap-7" onTransitionEnd={event => { if (phase === "black" && transitionEnded(event)) start(); }}>
        {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-md" />}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(194,150,80,0.16),transparent_65%)]" />
        <p className="relative text-[10px] tracking-[0.4em] text-amber-100/70 sm:text-xs">VOUS ALLEZ REGARDER</p>
        {titleLogo && !logoFailed && <img key={titleLogo} ref={logoRef} src={titleLogo} alt={title || "Film"} onLoad={() => setSettledLogo(titleLogo)} onError={() => { setSettledLogo(titleLogo); setLogoFailed(true); }} className="cinema-logo relative max-h-32 w-auto max-w-[75%] object-contain drop-shadow-2xl" />}
      </div>
      <style jsx>{`
        .gplayer-intro { opacity: 1; transition: opacity 500ms ease; }
        .cinema-content { opacity: 1; transition: opacity 500ms ease; }
        .black .cinema-content, .starting .cinema-content, .reveal .cinema-content { opacity: 0; }
        .reveal { opacity: 0; }
        .cinema-logo { animation: breathe 8s ease-in-out infinite alternate; }
        @keyframes breathe { from { transform: scale(1); } to { transform: scale(1.05); } }
        @media (prefers-reduced-motion: reduce) {
          .cinema-logo { animation: none; }
          .gplayer-intro, .cinema-content { transition: none; }
        }
      `}</style>
    </div>
  );
}
