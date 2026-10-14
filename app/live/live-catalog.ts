import { readLiveCache, writeLiveCache } from "@/lib/live-cache";
import type { Category, Channel } from "./live-types";

export class LiveAuthenticationError extends Error {}

export function cachedList<T>(key: string): T[] | null {
  try {
    const value = readLiveCache<T[]>(key, { allowStale: true });
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Keep the existing cache format so sports matching and other app pages still
// see the same channels. A cache hit never suppresses a network request.
export function saveList<T>(key: string, value: T[], ttl: number) {
  try { writeLiveCache(key, value, ttl); } catch { /* Storage may be unavailable. */ }
}

async function requestList(url: string, signal: AbortSignal): Promise<Record<string, unknown>[]> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (response.status === 401) throw new LiveAuthenticationError();
  if (!response.ok) throw new Error(`Chargement impossible (${response.status}).`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Réponse Live TV invalide.");
  return data.filter((item): item is Record<string, unknown> =>
    typeof item === "object" && item !== null
  );
}

export async function fetchCategories(signal: AbortSignal): Promise<Category[]> {
  const data = await requestList("/api/xtream?action=get_live_categories", signal);
  const categories = data.map((item) => ({
    category_id: String(item.category_id ?? ""),
    category_name: String(item.category_name ?? ""),
  })).filter((item) => item.category_id !== "");
  return [...new Map(categories.map((item) => [item.category_id, item])).values()];
}

export async function fetchChannels(categoryId: string, signal: AbortSignal): Promise<Channel[]> {
  const data = await requestList(`/api/xtream?action=get_live_streams&category_id=${encodeURIComponent(categoryId)}`, signal);
  const channels = data.map((item) => ({
    num: Number(item.num) || 0,
    name: String(item.name ?? ""),
    stream_id: Number(item.stream_id),
    stream_icon: String(item.stream_icon ?? ""),
    category_id: String(item.category_id ?? categoryId),
  })).filter((item) => Number.isFinite(item.stream_id) && item.stream_id > 0);
  return [...new Map(channels.map((item) => [item.stream_id, item])).values()];
}
