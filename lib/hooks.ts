import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useVodStreams() {
  return useQuery({
    queryKey: ["vod", "streams"],
    queryFn: () => api.vodStreams(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useVodCategories() {
  return useQuery({
    queryKey: ["vod", "categories"],
    queryFn: () => api.vodCategories(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useSeriesStreams() {
  return useQuery({
    queryKey: ["series", "streams"],
    queryFn: () => api.seriesStreams(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useSeriesCategories() {
  return useQuery({
    queryKey: ["series", "categories"],
    queryFn: () => api.seriesCategories(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useSeriesInfo(seriesId: string) {
  return useQuery({
    queryKey: ["series", "info", seriesId],
    queryFn: () => api.seriesInfo(seriesId),
    enabled: !!seriesId,
    staleTime: 1000 * 60 * 15,
  });
}

export function useLiveStreams() {
  return useQuery({
    queryKey: ["live", "streams"],
    queryFn: () => api.liveStreams(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useLiveCategories() {
  return useQuery({
    queryKey: ["live", "categories"],
    queryFn: () => api.liveCategories(),
    staleTime: 1000 * 60 * 15,
  });
}
