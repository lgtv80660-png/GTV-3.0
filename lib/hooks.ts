import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api";

/* =========================================================
   CONFIG
========================================================= */

const FIFTEEN_MINUTES =
  1000 * 60 * 15;

const THIRTY_MINUTES =
  1000 * 60 * 30;

const ONE_HOUR =
  1000 * 60 * 60;

/* =========================================================
   HELPERS
========================================================= */

function extractArrays(
  value: any
): any[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  const result: any[] = [];

  const possibleArrays = [
    value?.data,
    value?.series,
    value?.results,
    value?.items,
    value?.streams,
  ];

  for (
    const candidate of
    possibleArrays
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      result.push(
        ...candidate
      );
    }
  }

  return result;
}

function findSeriesInReactQueryCache(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  seriesId: string
) {
  /*
   * On inspecte TOUT le cache React Query.
   *
   * Pourquoi ?
   *
   * Chez toi la série peut venir de :
   *
   * ["series", "streams"]
   * ["home-series"]
   * une catégorie
   * une page discovery
   * etc.
   *
   * Donc on ne dépend plus d'une seule queryKey.
   */

  const queries =
    queryClient
      .getQueryCache()
      .getAll();

  const targetId =
    String(seriesId);

  for (
    const query of
    queries
  ) {
    const data =
      query.state.data;

    if (!data) {
      continue;
    }

    const candidates =
      extractArrays(
        data
      );

    for (
      const item of
      candidates
    ) {
      const itemId =
        item?.series_id ??
        item?.id ??
        item?.stream_id;

      if (
        itemId != null &&
        String(itemId) ===
          targetId
      ) {
        return item;
      }
    }

    /*
     * Certains caches peuvent directement
     * contenir l'objet série.
     */

    if (
      !Array.isArray(
        data
      ) &&
      typeof data ===
        "object"
    ) {
      const directId =
        (data as any)
          ?.series_id ??
        (data as any)?.id ??
        (data as any)
          ?.stream_id;

      if (
        directId != null &&
        String(
          directId
        ) === targetId
      ) {
        return data;
      }
    }
  }

  return null;
}

/* =========================================================
   VOD
========================================================= */

export function useVodStreams() {
  return useQuery({
    queryKey: [
      "vod",
      "streams",
    ],

    queryFn: () =>
      api.vodStreams(),

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}

export function useVodCategories() {
  return useQuery({
    queryKey: [
      "vod",
      "categories",
    ],

    queryFn: () => {
      const a =
        api as any;

      return a.vodCategories
        ? a.vodCategories()
        : [];
    },

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}

/* =========================================================
   SERIES STREAMS
========================================================= */

export function useSeriesStreams() {
  return useQuery({
    queryKey: [
      "series",
      "streams",
    ],

    queryFn: () => {
      const a =
        api as any;

      if (
        a.seriesStreams
      ) {
        return a.seriesStreams();
      }

      if (a.series) {
        return a.series();
      }

      return [];
    },

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}

/* =========================================================
   SERIES CATEGORIES
========================================================= */

export function useSeriesCategories() {
  return useQuery({
    queryKey: [
      "series",
      "categories",
    ],

    queryFn: () => {
      const a =
        api as any;

      return a
        .seriesCategories
        ? a.seriesCategories()
        : [];
    },

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}

/* =========================================================
   SERIES INFO
   OPTIMISATION PRINCIPALE
========================================================= */

export function useSeriesInfo(
  seriesId: string
) {
  const queryClient =
    useQueryClient();

  return useQuery({
    queryKey: [
      "series",
      "info",
      seriesId,
    ],

    /*
     * Cette requête reste nécessaire :
     * elle récupère saisons + épisodes.
     *
     * Mais elle ne bloque plus forcément
     * l'affichage du hero.
     */
    queryFn: () =>
      api.seriesInfo(
        seriesId
      ),

    enabled:
      Boolean(seriesId),

    staleTime:
      THIRTY_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,

    retry:
      1,

    /*
     * IMPORTANT :
     *
     * Pendant les 4 secondes éventuelles de
     * get_series_info, on affiche immédiatement
     * la série déjà connue depuis le catalogue.
     */
    placeholderData:
      () => {
        if (
          !seriesId
        ) {
          return undefined;
        }

        const found =
          findSeriesInReactQueryCache(
            queryClient,
            seriesId
          );

        if (!found) {
          return undefined;
        }

        return {
          info:
            found,

          series_info:
            found,

          /*
           * Les épisodes arriveront avec
           * get_series_info.
           */
          episodes:
            {},

          /*
           * Permet à la page de savoir que
           * les saisons ne sont pas encore prêtes.
           */
          __placeholder:
            true,
        };
      },
  });
}

/* =========================================================
   LIVE
========================================================= */

export function useLiveStreams() {
  return useQuery({
    queryKey: [
      "live",
      "streams",
    ],

    queryFn: () =>
      api.liveStreams(),

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}

export function useLiveCategories() {
  return useQuery({
    queryKey: [
      "live",
      "categories",
    ],

    queryFn: () =>
      api.liveCategories(),

    staleTime:
      FIFTEEN_MINUTES,

    gcTime:
      ONE_HOUR,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  });
}