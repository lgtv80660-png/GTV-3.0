import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitaire de fusion des classes Tailwind (Shadcn/UI)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un nombre de secondes en format d'affichage "HH:MM:SS" ou "MM:SS"
 */
export function formatTime(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Nettoie le nom d'une chaîne ou d'un flux
 */
export function cleanName(name?: string): string {
  if (!name) return "";
  return name
    .replace(/^\[.*?\]\s*/, "")
    .replace(/\.(mp4|mkv|avi|ts|m3u8)$/i, "")
    .trim();
}

/**
 * Convertit une durée ("01:30:00" ou "90:00") ou un nombre en secondes.
 */
export function parseDurationToSeconds(duration?: string | number): number {
  if (!duration) return 0;
  if (typeof duration === "number") return duration;

  const parts = String(duration).split(":").map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  
  return Number(duration) || 0;
}