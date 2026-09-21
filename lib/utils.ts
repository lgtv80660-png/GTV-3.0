import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Type pour les clés de tri du catalogue
 */
export type SortKey = "added" | "name" | "rating" | "year";

/**
 * Utilitaire de fusion des classes Tailwind (Shadcn/UI)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Nettoie le nom d'un titre (supprime les préfixes entre crochets [FR] et extensions)
 */
export function cleanName(name?: string): string {
  if (!name) return "";
  return name
    .replace(/^\[.*?\]\s*/, "")
    .replace(/\.(mp4|mkv|avi|ts|m3u8)$/i, "")
    .trim();
}

/**
 * Formate un nombre de secondes en "HH:MM:SS" ou "MM:SS"
 */
export function formatTime(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Convertit une durée en secondes
 */
export function parseDurationToSeconds(duration?: string | number): number {
  if (!duration) return 0;
  if (typeof duration === "number") return duration;
  const parts = String(duration).split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(duration) || 0;
}

/**
 * Trie une liste d'éléments (Films / Séries / Live) selon la clé spécifiée
 */
export function sortItems<T extends Record<string, any>>(
  items: T[],
  sortBy: SortKey = "name",
  asc = true
): T[] {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    let valA = a[sortBy] ?? a.name ?? "";
    let valB = b[sortBy] ?? b.name ?? "";

    if (sortBy === "added" || sortBy === "year") {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else if (sortBy === "rating") {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });
}
export const ratingNum = (rating: any) => Number(rating) || 0;

export const yearFrom = (date: any, fallbackTitle?: string) => {
  if (date) return String(date).substring(0, 4);
  const match = fallbackTitle?.match(/\((\d{4})\)/);
  return match ? match[1] : "";
};