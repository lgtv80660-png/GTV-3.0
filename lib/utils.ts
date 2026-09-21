import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type SortKey = "name_asc" | "name_desc" | "rating_desc" | "year_desc";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanName(name: string): string {
  if (!name) return "";
  return name
    .replace(/^\[.*?\]\s*/g, "") // Supprime les tags comme [ZTV-02]
    .replace(/\s*\(\d{4}\)$/g, "") // Supprime l'année entre parenthèses à la fin
    .trim();
}

export function ratingNum(rating?: string | number): number {
  if (!rating) return 0;
  const parsed = parseFloat(String(rating));
  return isNaN(parsed) ? 0 : parsed;
}

export function yearFrom(dateStr?: string, fallbackTitle?: string): string {
  if (dateStr && dateStr.length >= 4) {
    const match = dateStr.match(/\d{4}/);
    if (match) return match[0];
  }
  if (fallbackTitle) {
    const match = fallbackTitle.match(/\((\d{4})\)/);
    if (match) return match[1];
  }
  return "";
}

export function sortItems<T extends { name: string; rating?: any; year?: any }>(
  items: T[],
  sortKey: SortKey
): T[] {
  const sorted = [...items];
  switch (sortKey) {
    case "name_asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "rating_desc":
      return sorted.sort((a, b) => ratingNum(b.rating) - ratingNum(a.rating));
    case "year_desc":
      return sorted.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
    default:
      return sorted;
  }
}