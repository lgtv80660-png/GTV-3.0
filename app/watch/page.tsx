"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { resolveSrc } from "@/lib/api";
import { useSeriesInfo } from "@/lib/hooks";
import type { StreamKind, Episode } from "@/lib/xtream/types";

function WatchPlayer() {
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") || "movie") as StreamKind;
  const id = searchParams.get("id") || "";
  const extParam = searchParams.get("ext") || "mp4";
  const titleParam = searchParams.get("title") || "";
  const seriesId = searchParams.get("series") || "";

  const isLive = type === "live";

  const { data: seriesInfo } = useSeriesInfo(seriesId);

  const flatEpisodes = useMemo<Episode[]>(() => {
    const episodesObj = seriesInfo?.episodes;
    if (!episodesObj) return [];
    return Object.keys(episodesObj)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((season) => episodesObj[String(season)] || []);
  }, [seriesInfo]);

  const { data: resolved } = useQuery({
    queryKey: ["resolve", type, id, extParam],
    queryFn: () => resolveSrc(type, id, extParam),
    enabled: !isLive && !!id,
  });

  const videoSrc = useMemo(() => {
    if (isLive) return `/api/stream-live?id=${id}`;
    if (resolved?.directOk && resolved?.url) return resolved.url;
    return `/api/stream-vod?type=${type}&id=${id}&ext=${extParam}`;
  }, [isLive, id, type, extParam, resolved]);

  return (
    <div className="flex-1 relative">
      <video
        src={videoSrc}
        controls
        autoPlay
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export default function WatchPage() {
  return (
    <div className="flex h-screen w-full flex-col bg-black text-white">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-gray-500">Chargement du lecteur...</div>}>
        <WatchPlayer />
      </Suspense>
    </div>
  );
}
