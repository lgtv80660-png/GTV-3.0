"use client";

import { useRef, type PointerEvent } from "react";

import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import type { GPlayerStateData } from "./GPlayerState";

type Props = {
  state: GPlayerStateData;
  fullscreen: boolean;
  disabled: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (seconds: number) => void;
  onVolume: (volume: number) => void;
  onMute: () => void;
  onFullscreen: () => void;
};

function formatTime(value: number) {
  const seconds = Math.floor(Math.max(0, Number.isFinite(value) ? value : 0));
  const h = Math.floor(seconds / 3600);
  return `${h ? String(h).padStart(2, "0") + ":" : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function GPlayerControls({ state, fullscreen, disabled, onTogglePlay, onSeek, onSkip, onVolume, onMute, onFullscreen }: Props) {
  const dragging = useRef(false);
  const seekAtPointer = (event: PointerEvent<HTMLInputElement>) => {
    if (disabled || state.duration <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * state.duration);
  };
  const playing = state.status === "playing" || state.status === "buffering";
  const progress = state.duration > 0 ? Math.min(state.currentTime / state.duration * 100, 100) : 0;
  const button = "rounded-lg p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-40";
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-10 text-white sm:p-5 sm:pt-12" role="group" aria-label="Commandes vidéo">
      <input type="range" aria-label="Position de lecture" aria-valuetext={`${formatTime(state.currentTime)} sur ${formatTime(state.duration)}`} min={0} max={state.duration} step={0.01} value={Math.min(state.currentTime, state.duration || 0)} disabled={disabled || state.duration <= 0} onPointerDown={e => {
        if (disabled || state.duration <= 0 || e.button !== 0) return;
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAtPointer(e);
      }} onPointerMove={e => { if (dragging.current) seekAtPointer(e); }} onPointerUp={e => {
        if (!dragging.current) return;
        seekAtPointer(e);
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }} onPointerCancel={() => { dragging.current = false; }} onLostPointerCapture={() => { dragging.current = false; }} onChange={e => { if (!dragging.current) onSeek(Number(e.target.value)); }} className="h-2 w-full cursor-pointer appearance-none rounded-full accent-amber-200 disabled:cursor-default" style={{ touchAction: "none", background: `linear-gradient(to right, #fde68a ${progress}%, #ffffff40 ${progress}%)` }} />
      <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2">
        <button type="button" className={button} disabled={disabled} aria-label={playing ? "Pause" : "Lecture"} onClick={onTogglePlay}>{playing ? <Pause size={22} /> : <Play size={22} />}</button>
        <button type="button" className={button} disabled={disabled || !state.duration} aria-label="Reculer de 10 secondes" onClick={() => onSkip(-10)}><RotateCcw size={20} /><span className="text-[10px]">10</span></button>
        <button type="button" className={button} disabled={disabled || !state.duration} aria-label="Avancer de 10 secondes" onClick={() => onSkip(10)}><RotateCw size={20} /><span className="text-[10px]">10</span></button>
        <button type="button" className={button} aria-label={state.muted ? "Activer le son" : "Couper le son"} aria-pressed={state.muted} onClick={onMute}>{state.muted || state.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
        <input type="range" aria-label="Volume" min={0} max={1} step={0.01} value={state.muted ? 0 : state.volume} onChange={e => onVolume(Number(e.target.value))} className="w-16 accent-amber-200 sm:w-24" />
        <span className="ml-auto text-xs tabular-nums sm:text-sm">{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
        <button type="button" className={button} aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={onFullscreen}>{fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
}
