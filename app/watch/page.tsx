"use client";

import { Suspense, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { resolveSrc, api } from "@/lib/api";
import { useSeriesInfo } from "@/lib/hooks";
import { useLibrary } from "@/store/library";
import { parseDurationToSeconds } from "@/lib/utils";
import type { StreamKind, Episode } from "@/lib/xtream/types";

function WatchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const libraryStore = useLibrary() as any;

  const type = (params.get("type") as StreamKind) || "movie";
  const id = params.get("id") || "";
  const extParam = params.get("ext");
  const title = params.get("title") || "Now Playing";
  const urlPoster = params.get("poster") || params.get("cover") || undefined;
  const resume = Number(params.get("resume") || 0);
  const seriesId = params.get("series") || undefined;
  const isLive = type === "live";

  const { data: seriesInfo } = useSeriesInfo(type === "series" ? seriesId : undefined);
  const flatEpisodes = useMemo<Episode[]>(() => {
    if (!seriesInfo?.episodes) return [];
    return Object.keys(seriesInfo.episodes)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((s) => seriesInfo.episodes[String(s)] ?? []);
  }, [seriesInfo]);

  const currentIdx = flatEpisodes.findIndex((e) => String(e.id) === id);
  const nextEp = currentIdx >= 0 ? flatEpisodes[currentIdx + 1] : undefined;

  const { data: movieInfo } = useQuery({
    queryKey: ["vod", "info", id],
    queryFn: () => api.vodInfo(id),
    enabled: type === "movie" && !!id,
    staleTime: 30 * 60 * 1000,
  });

  const { data: resolved, isLoading: resolving } = useQuery({
    queryKey: ["resolve", type, id, extParam],
    queryFn: () => resolveSrc(type as StreamKind, id, extParam || "mp4"),
    enabled: !isLive && !!id,
    staleTime: 5 * 60 * 1000,
  });

  const ext = useMemo(() => {
    let rawExt = extParam || resolved?.ext;
    if (!rawExt && type === "movie") {
      rawExt = (movieInfo?.movie_data as any)?.container_extension;
    }

    if (isLive) return "m3u8";
    if (!rawExt || rawExt.toLowerCase() === "mkv") return "mp4";
    return rawExt;
  }, [extParam, resolved, type, movieInfo, isLive]);

  const poster = useMemo(() => {
    if (urlPoster) return urlPoster;
    if (type === "movie") {
      const inf = (movieInfo?.info || movieInfo?.movie_data) as any;
      return inf?.movie_image || inf?.cover_big || inf?.cover || inf?.stream_icon;
    }
    if (type === "series") {
      return seriesInfo?.info?.cover;
    }
    return undefined;
  }, [urlPoster, type, movieInfo, seriesInfo]);

  const knownDuration = useMemo(() => {
    if (type === "movie") {
      const inf = movieInfo?.info;
      return inf?.duration_secs || parseDurationToSeconds(inf?.duration) || 0;
    }
    if (type === "series") {
      const ep = flatEpisodes.find((e) => String(e.id) === id);
      return ep?.info?.duration_secs || parseDurationToSeconds(ep?.info?.duration) || 0;
    }
    return 0;
  }, [type, id, movieInfo, flatEpisodes]);

  const mediaKind = type as StreamKind;

  const sources = useMemo(() => {
    const cb = Date.now();

    if (isLive) {
      return [`/api/live?id=${id}`];
    }

    return [
      `/api/stream-vod?type=${mediaKind}&id=${id}&ext=${encodeURIComponent(ext)}&cb=${cb}`,
    ];
  }, [isLive, mediaKind, id, ext]);

  const recentedRef = useRef(false);
  if (type === "live" && !recentedRef.current && id) {
    recentedRef.current = true;
    libraryStore?.pushRecentLive?.(Number(id));
  }

  const lastSave = useRef(0);
  const onProgress = useCallback(
    (position: number, duration: number, playerPoster?: string) => {
      if (isLive || !duration) return;
      const now = Date.now();
      if (now - lastSave.current < 2000) return;
      lastSave.current = now;

      const finalPoster = playerPoster || poster;

      libraryStore?.saveProgress?.({
        key: `${mediaKind}:${id}`,
        kind: mediaKind,
        id,
        seriesId,
        title,
        poster: finalPoster,
        ext,
        position,
        duration,
        updatedAt: now,
      });
    },
    [isLive, mediaKind, id, seriesId, title, poster, ext, libraryStore],
  );

  const goNext = useCallback(() => {
    if (!nextEp || !seriesId) return;
    const t = `${title.split(" · ")[0]} · ${nextEp.title || `Episode ${nextEp.episode_num}`}`;
    router.replace(
      `/watch?type=series&id=${nextEp.id}&ext=mp4&title=${encodeURIComponent(t)}&series=${seriesId}`,
    );
  }, [nextEp, seriesId, title, router]);

  if (!id) {
    return (
      <div className="grid h-dvh place-items-center text-fog-500">
        Nothing to play. <button onClick={() => router.back()} className="ml-2 underline">Go back</button>
      </div>
    );
  }

  if (!isLive && resolving) {
    return (
      <div className="grid h-dvh place-items-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-iris-400" />
      </div>
    );
  }

  return (
    <VideoPlayer
      sources={sources}
      ext={ext}
      isLive={isLive}
      title={title}
      poster={poster}
      startTime={resume}
      hasNext={!!nextEp}
      knownDuration={knownDuration}
      onNext={goNext}
      onBack={() => router.back()}
      onProgress={onProgress}
      onEnded={nextEp ? goNext : undefined}
    />
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center bg-black">
          <Loader2 className="h-10 w-10 animate-spin text-iris-400" />
        </div>
      }
    >
      <WatchInner />
    </Suspense>
  );
}