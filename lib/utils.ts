import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne les classes CSS Tailwind de manière conditionnelle et sans conflits
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un temps en secondes vers un format lisible HH:MM:SS ou MM:SS
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Nettoie le nom d'un média ou d'une chaîne Live (retire la qualité, la langue, etc.)
 */
export function cleanName(name?: string, fallback: string = ""): string {
  if (!name) return fallback;
  const cleaned = name
    .replace(/^([A-Z]{2,4}\||\|[A-Z]{2,4}\|)\s*/i, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\b(4K|HEVC|FHD|HD|SD|RAW|VIP|1080p|720p)\b/gi, "")
    .trim();
  return cleaned || fallback;
}

/**
 * Extrait et formate une note numérique à partir d'une chaîne ou d'un nombre
 */
export function ratingNum(rating?: string | number, fallback: number = 0): number {
  if (rating === undefined || rating === null || rating === "") return fallback;
  if (typeof rating === "number") return Math.min(10, Math.max(0, rating));
  const parsed = parseFloat(String(rating).replace(",", "."));
  return isNaN(parsed) ? fallback : Math.min(10, Math.max(0, parsed));
}

/**
 * Extrait l'année d'une date (ex: "2024-05-12" -> "2024")
 */
export function yearFrom(dateStr?: string | number, fallback: string = ""): string {
  if (!dateStr) return fallback;
  const str = String(dateStr).trim();
  const match = str.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : (str || fallback);
}