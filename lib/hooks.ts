"use client";

import useSWR from "swr";
import type {
  VodCategory,
  VodStream,
  SeriesCategory,
  SeriesItem,
  SeriesDetails,
  LiveCategory,
  LiveStream,
} from "@/lib/xtream/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type");
  if (!res.ok || (contentType && contentType.includes("text/html"))) {
    throw new Error("Session non valide ou réponse invalide");
  }
  return res.json();
};

// Configuration du cache SWR pour éviter les rechargements inutiles et optimiser les performances
const swrConfig = {
  revalidateOnFocus: false,      // Ne pas recharger quand on change d'onglet
  revalidateOnReconnect: false,  // Ne pas recharger à la reconnexion
  dedupingInterval: 300000,      // Conserver le cache 5 minutes minimum
};

// 1. FILMS (VOD)
export function useVodCategories() {
  const { data, error, isLoading } = useSWR<VodCategory[]>(
    "/api/xtream?action=get_vod_categories",
    fetcher,
    swrConfig
  );
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}

export function useVodStreams(categoryId?: string) {
  const url = categoryId
    ? `/api/xtream?action=get_vod_streams&category_id=${categoryId}`
    : "/api/xtream?action=get_vod_streams";

  const { data, error, isLoading } = useSWR<VodStream[]>(url, fetcher, swrConfig);
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}

export function useMovieInfo(movieId?: string | number) {
  const { data, error, isLoading } = useSWR(
    movieId ? `/api/xtream?action=get_vod_info&vod_id=${movieId}` : null,
    fetcher,
    swrConfig
  );
  return { data, isLoading, isError: !!error, error };
}

// 2. SÉRIES
export function useSeriesCategories() {
  const { data, error, isLoading } = useSWR<SeriesCategory[]>(
    "/api/xtream?action=get_series_categories",
    fetcher,
    swrConfig
  );
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}

export function useSeriesStreams(categoryId?: string) {
  const url = categoryId
    ? `/api/xtream?action=get_series&category_id=${categoryId}`
    : "/api/xtream?action=get_series";

  const { data, error, isLoading } = useSWR<SeriesItem[]>(url, fetcher, swrConfig);
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}

export function useSeriesInfo(seriesId?: string | number) {
  const { data, error, isLoading } = useSWR<SeriesDetails>(
    seriesId ? `/api/xtream?action=get_series_info&series_id=${seriesId}` : null,
    fetcher,
    swrConfig
  );
  return { data, isLoading, isError: !!error, error };
}

// 3. LIVE TV
export function useLiveCategories() {
  const { data, error, isLoading } = useSWR<LiveCategory[]>(
    "/api/xtream?action=get_live_categories",
    fetcher,
    swrConfig
  );
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}

export function useLiveStreams(categoryId?: string) {
  const url = categoryId
    ? `/api/xtream?action=get_live_streams&category_id=${categoryId}`
    : "/api/xtream?action=get_live_streams";

  const { data, error, isLoading } = useSWR<LiveStream[]>(url, fetcher, swrConfig);
  return { data: Array.isArray(data) ? data : [], isLoading, isError: !!error, error };
}