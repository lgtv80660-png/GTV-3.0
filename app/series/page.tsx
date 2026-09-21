"use client";

import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { useSeriesCategories, useSeriesStreams } from "@/lib/hooks";
import type { SeriesItem } from "@/lib/xtream/types";

export default function SeriesPage() {
  const { data: categories = [], isLoading: isLoadingCategories } = useSeriesCategories();

  return (
    <CatalogBrowser<SeriesItem>
      sectionKey="series"
      categories={categories}
      useItems={useSeriesStreams}
      toPoster={(series) => ({
        id: series.series_id,
        name: series.name || "Série sans titre",
        poster: series.cover,
        rating: series.rating,
        year: series.releaseDate ? series.releaseDate.slice(0, 4) : undefined,
      })}
      hrefFor={(series) => `/series/${series.series_id}`}
      emptyLabel="Aucune série trouvée dans cette catégorie."
    />
  );
}