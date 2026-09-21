import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useVodStreams() {
  return useQuery({
    queryKey: ["vod", "streams"],
    queryFn: () => api.vodStreams(),
    staleTime: 1000 * 60 * 15, // Garde en mémoire 15 minutes sans recharger
  });
}

export function useSeriesStreams() {
  return useQuery({
    queryKey: ["series", "streams"],
    queryFn: () => api.seriesStreams(),
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
