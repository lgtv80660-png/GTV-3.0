"use client";

import { useMemo, useState, useRef } from "react";
import { FilterBar } from "@/components/catalog/FilterBar";
import { PosterCard } from "@/components/catalog/PosterCard";
import { PosterGridSkeleton } from "@/components/ui/Skeleton";
import { useUI, DEFAULT_FILTER } from "@/store/ui";
import { sortItems, cleanName, cn } from "@/lib/utils";
import type { SortKey } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { Film, Tv, Sparkles, Layers } from "lucide-react";

interface CatalogBrowserProps<T> {
  sectionKey: "movies" | "series";
  categories: Array<{ category_id: string; category_name: string }>;
  useItems: (catId?: string) => {
    data?: T[];
    isLoading: boolean;
    isError?: boolean;
    error?: unknown;
  };
  toPoster: (item: T) => {
    id: string | number;
    name: string;
    poster?: string;
    rating?: number | string;
    year?: number | string;
    container_extension?: string;
  };
  hrefFor: (item: T) => string;
  emptyLabel?: string;
  onPlayItem?: (item: T) => void;
}

export function CatalogBrowser<
  T extends {
    name?: string;
    title?: string;
    stream_id?: string | number;
    series_id?: string | number;
    id?: string | number;
    container_extension?: string;
    [key: string]: any;
  }
>({
  sectionKey,
  categories,
  useItems,
  toPoster,
  hrefFor,
  emptyLabel,
  onPlayItem,
}: CatalogBrowserProps<T>) {
  const { t } = useTranslation();

  const filter = useUI((state) => state.filters[sectionKey] ?? DEFAULT_FILTER);
  const patchFilter = useUI((state) => state.patchFilter);

  const category = filter.category || "all";
  const { sort, query } = filter;

  const [visibleCount, setVisibleCount] = useState(60);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Moteur Drag-to-Scroll fluide (distingue clic court et glissement long)
  const bindDragScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    let isDown = false;
    let startY = 0;
    let scrollTop = 0;
    let hasDragged = false;

    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (!ref.current) return;
        isDown = true;
        hasDragged = false;
        startY = e.pageY - ref.current.offsetTop;
        scrollTop = ref.current.scrollTop;
      },
      onPointerLeave: () => {
        isDown = false;
      },
      onPointerUp: () => {
        isDown = false;
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!isDown || !ref.current) return;
        const y = e.pageY - ref.current.offsetTop;
        const walk = (y - startY) * 1.5;

        if (Math.abs(walk) > 5) {
          hasDragged = true;
          e.preventDefault();
          ref.current.scrollTop = scrollTop - walk;
        }
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (hasDragged) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    };
  };

  const sidebarDrag = bindDragScroll(sidebarRef);
  const mainDrag = bindDragScroll(mainRef);

  const setCategory = (id: string) => {
    setVisibleCount(60);
    patchFilter(sectionKey, { category: id });
  };

  const setSort = (s: SortKey) => patchFilter(sectionKey, { sort: s });

  const setQuery = (q: string) => {
    setVisibleCount(60);
    patchFilter(sectionKey, { query: q });
  };

  const { data, isLoading, isError, error } = useItems(
    category === "all" ? undefined : category
  );

  const filtered = useMemo(() => {
    let items = data ?? [];
    const q = query.trim().toLowerCase();

    if (q) {
      items = items.filter((c) =>
        cleanName(c.name || c.title || "")
          .toLowerCase()
          .includes(q)
      );
    }

    const limitForSort = !q && items.length > 1000 ? 500 : items.length;
    const sliceToSort = items.slice(0, limitForSort);

    const sortableItems = sliceToSort.map((item) => ({
      ...item,
      name: item.name || item.title || "",
    }));

    return sortItems(sortableItems as any, sort as SortKey) as unknown as T[];
  }, [data, query, sort]);

  const displayItems = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const handleQuickPlay = (item: T) => {
    if (onPlayItem) {
      onPlayItem(item);
      return;
    }

    const id = item.stream_id || item.series_id || item.id;
    const ext = item.container_extension || "mp4";
    const type = sectionKey === "movies" ? "movie" : "series";

    if (id) {
      window.location.href = `/api/stream-vod?type=${type}&id=${id}&ext=${ext}`;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden bg-black text-white select-none">
      {/* 1. SIDEBAR CATÉGORIES (Compatibilité Séries & Films) */}
      <aside className="w-1/4 max-w-[280px] shrink-0 border-r border-white/10 bg-zinc-950 flex flex-col z-10">
        <div className="p-4 border-b border-white/10 flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
            {sectionKey === "movies" ? (
              <Film className="w-4 h-4" />
            ) : (
              <Tv className="w-4 h-4" />
            )}
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              {t("Catalog.categories")}
            </h2>
            <p className="text-[10px] text-zinc-400 font-medium capitalize">
              {sectionKey === "movies" ? t("Nav.movies") : t("Nav.series")}
            </p>
          </div>
        </div>

        <div
          ref={sidebarRef}
          {...sidebarDrag}
          className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none overscroll-contain cursor-grab active:cursor-grabbing touch-pan-y"
        >
          <button
            onClick={() => setCategory("all")}
            className={cn(
              "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group",
              category === "all"
                ? "bg-white text-black font-extrabold shadow-md"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              {t("Catalog.allCategories")}
            </span>
            <Sparkles
              className={cn(
                "w-3 h-3 transition-opacity",
                category === "all" ? "opacity-100 text-black" : "opacity-0 group-hover:opacity-100 text-zinc-400"
              )}
            />
          </button>

          {categories.map((c) => {
            const isActive = category === c.category_id;
            return (
              <button
                key={c.category_id}
                onClick={() => setCategory(c.category_id)}
                className={cn(
                  "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all truncate block",
                  isActive
                    ? "bg-white text-black font-extrabold shadow-md"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {c.category_name}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 2. CATALOGUE PRINCIPAL SÉRIES & FILMS */}
      <main
        ref={mainRef}
        {...mainDrag}
        className="flex-1 flex flex-col overflow-y-auto bg-black overscroll-contain cursor-grab active:cursor-grabbing touch-pan-y"
      >
        <FilterBar
          categories={[]}
          activeCategory={category}
          onCategory={setCategory}
          sort={sort as SortKey}
          onSort={setSort}
          query={query}
          onQuery={setQuery}
          count={filtered.length}
        />

        <div className="p-6">
          {isLoading ? (
            <PosterGridSkeleton />
          ) : isError ? (
            <div className="py-24 text-center space-y-3">
              <p className="text-sm font-semibold text-red-400">
                {(error as Error)?.message || "Erreur de chargement des données."}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-32 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-500">
                {emptyLabel || t("Catalog.emptyCategory")}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-5 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-in fade-in duration-500">
                {displayItems.map((item) => {
                  const p = toPoster(item);
                  return (
                    <PosterCard
                      key={p.id}
                      item={{
                        id: p.id,
                        stream_id: item.stream_id || p.id,
                        series_id: item.series_id,
                        name: p.name,
                        poster: p.poster,
                        rating: p.rating,
                        year: p.year !== undefined ? String(p.year) : undefined,
                        container_extension:
                          p.container_extension || item.container_extension,
                      }}
                      href={hrefFor(item)}
                      onPlay={() => handleQuickPlay(item)}
                    />
                  );
                })}
              </div>

              {visibleCount < filtered.length && (
                <div className="flex justify-center pt-4 pb-8">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 60)}
                    className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-lg hover:scale-105"
                  >
                    Charger plus ({filtered.length - visibleCount} restants)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}