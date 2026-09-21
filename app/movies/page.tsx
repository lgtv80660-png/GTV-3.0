"use client";

import { useMemo } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { useVodCategories, useVodStreams } from "@/lib/hooks";
import { useTranslation } from "@/lib/useTranslation";
import type { VodStream } from "@/lib/xtream/types";

export default function MoviesPage() {
  const { t } = useTranslation();
  const { data: categories = [] } = useVodCategories();

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 via-zinc-950 to-black text-white">
      <CatalogBrowser<VodStream>
        sectionKey="movies"
        categories={categories}
        useItems={(catId) => useVodStreams(catId)}
        toPoster={(item) => ({
          id: item.stream_id,
          name: item.name || item.title || "Film",
          poster: item.stream_icon || item.cover,
          rating: item.rating,
          year: item.year,
          container_extension: item.container_extension || "mp4",
        })}
        hrefFor={(item) => `/movies/${item.stream_id}`}
        emptyLabel={t("Catalog.emptyCategory")}
        onPlayItem={(item) => {
          const ext = item.container_extension || "mp4";
          window.location.href = `/api/stream-vod?type=movie&id=${item.stream_id}&ext=${ext}`;
        }}
      />
    </div>
  );
}