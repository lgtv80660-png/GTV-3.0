"use client";
import React, { useEffect, useMemo, useRef, useState, } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Film, Play, Search, X, } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
/* =========================================================
   NETTOYAGE DES NOMS
========================================================= */
const formatCategoryName = (rawName: string) => {
    if (!rawName)
        return "";
    const cleanName = rawName
        .replace(/\[.*?\]/g, "")
        .replace(/\|.*?\|/g, "")
        .replace(/[ⓋⒹ║]/g, "")
        .replace(/VOD-FR/gi, "")
        .replace(/FR\s*-/gi, "")
        .replace(/FILMS/gi, "")
        .replace(/^[-_| \s]+|[-_| \s]+$/g, "")
        .trim();
    const customNames: Record<string, string> = {
        "SCIENCE FICTION": "Sci-Fi",
        "SOUS TITRÉS": "VOSTFR",
        "TÉLÉ-FILM": "Téléfilms",
        HORREUR: "Horreur",
    };
    return customNames[cleanName] || cleanName;
};
const cleanMovieName = (rawName: string) => {
    if (!rawName)
        return "";
    return rawName
        .replace(/\[.*?\]/g, "")
        .replace(/\|.*?\|/g, "")
        .replace(/[ⓋⒹ║]/g, "")
        .replace(/\b(4K|2160p|1080p|720p|FHD|UHD|HDR|HEVC|MULTi|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFI|FR)\b/gi, "")
        .replace(/\s*\(\d{4}\)/g, "")
        .replace(/\s*\[\d{4}\]/g, "")
        .replace(/[\/\\|_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};
/* =========================================================
   CACHE IMAGES CATÉGORIES
========================================================= */
const categoryImageCache = new Map<string, string | null>();
/* =========================================================
   CARTE CATÉGORIE
========================================================= */
type CategoryCardProps = {
    name: string;
    isActive: boolean;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};
const CategoryCard = React.memo(function CategoryCard({ name, isActive, onClick, }: CategoryCardProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [bgImage, setBgImage,] = useState<string | null>(() => categoryImageCache.get(name) ??
        null);
    useEffect(() => {
        const cached = categoryImageCache.get(name);
        if (cached !== undefined) {
            setBgImage(cached);
            return;
        }
        const element = buttonRef.current;
        if (!element)
            return;
        let cancelled = false;
        let controller: AbortController | null = null;
        const load = () => {
            controller =
                new AbortController();
            fetch(`/api/category-image?query=${encodeURIComponent(name)}`, {
                signal: controller.signal,
            })
                .then((res) => res.ok
                ? res.json()
                : null)
                .then((data) => {
                if (cancelled)
                    return;
                const value = data?.imageUrl ||
                    null;
                categoryImageCache.set(name, value);
                setBgImage(value);
            })
                .catch(() => {
                if (!cancelled) {
                    categoryImageCache.set(name, null);
                }
            });
        };
        if (!("IntersectionObserver" in
            window)) {
            load();
            return () => {
                cancelled = true;
                if (controller &&
                    !controller.signal.aborted) {
                    controller.abort();
                }
            };
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                load();
            }
        }, {
            rootMargin: "180px",
        });
        observer.observe(element);
        return () => {
            cancelled = true;
            observer.disconnect();
            if (controller &&
                !controller.signal.aborted) {
                controller.abort();
            }
        };
    }, [name]);
    return (<button ref={buttonRef} type="button" onClick={onClick} className={cn(`
          gtv-movie-category

          group
          relative

          h-[64px]
          w-[140px]

          flex-shrink-0
          select-none
          overflow-hidden

          rounded-[16px]

          transition-all
          duration-300

          sm:h-[76px]
          sm:w-[170px]
          `, isActive
            ? `
              scale-[1.02]

              border
              border-[#d8ccff]/50

              bg-[#d8ccff]/10

              shadow-[0_12px_35px_rgba(170,145,255,.16)]
            `
            : `
              border
              border-white/10

              bg-white/[0.035]

              hover:border-white/20
              hover:bg-white/[0.06]
            `)}>
        {bgImage ? (<>
            <img src={bgImage} alt="" draggable={false} loading="lazy" decoding="async" fetchPriority="low" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-60" onError={(event) => {
                event.currentTarget.style.display =
                    "none";
            }}/>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060608]/90 via-[#060608]/60 to-transparent"/>
          </>) : (<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent"/>)}


        {isActive && (<motion.div layoutId="active-category-outline-movies" className="pointer-events-none absolute inset-0 rounded-[16px] ring-1 ring-[#d8ccff]/60 shadow-[inset_0_0_24px_rgba(216,204,255,.12)]"/>)}


        <span className={cn(`
            absolute
            inset-0

            flex
            items-center
            justify-center

            px-3

            text-center
            text-xs
            font-bold
            leading-tight
            tracking-wide

            drop-shadow-md

            transition-colors

            sm:text-[13px]
            `, isActive
            ? "text-white"
            : "text-white/70 group-hover:text-white")}>
          {name}
        </span>
      </button>);
});
/* =========================================================
   GLISSEMENT HORIZONTAL
========================================================= */
function useHorizontalScroll() {
    const ref = useRef<HTMLDivElement>(null);
    const pressedRef = useRef(false);
    const startXRef = useRef(0);
    const startScrollRef = useRef(0);
    const [isDragging, setIsDragging,] = useState(false);
    const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 ||
            !ref.current) {
            return;
        }
        pressedRef.current = true;
        startXRef.current =
            event.clientX;
        startScrollRef.current =
            ref.current.scrollLeft;
        setIsDragging(false);
    };
    const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!pressedRef.current ||
            !ref.current) {
            return;
        }
        const delta = event.clientX -
            startXRef.current;
        if (Math.abs(delta) > 5) {
            setIsDragging(true);
            event.preventDefault();
        }
        ref.current.scrollLeft =
            startScrollRef.current -
                delta * 1.35;
    };
    const stop = () => {
        pressedRef.current = false;
        window.setTimeout(() => setIsDragging(false), 60);
    };
    return {
        dragProps: {
            ref,
            onMouseDown,
            onMouseMove,
            onMouseUp: stop,
            onMouseLeave: stop,
        },
        isDragging,
    };
}
/* =========================================================
   GLISSEMENT VERTICAL
========================================================= */
function useVerticalScroll() {
    const ref = useRef<HTMLDivElement>(null);
    const pressedRef = useRef(false);
    const startYRef = useRef(0);
    const startScrollRef = useRef(0);
    const [isDragging, setIsDragging,] = useState(false);
    const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 ||
            !ref.current) {
            return;
        }
        pressedRef.current = true;
        startYRef.current =
            event.clientY;
        startScrollRef.current =
            ref.current.scrollTop;
        setIsDragging(false);
    };
    const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!pressedRef.current ||
            !ref.current) {
            return;
        }
        const delta = event.clientY -
            startYRef.current;
        if (Math.abs(delta) > 5) {
            setIsDragging(true);
            event.preventDefault();
        }
        ref.current.scrollTop =
            startScrollRef.current -
                delta * 1.35;
    };
    const stop = () => {
        pressedRef.current = false;
        window.setTimeout(() => setIsDragging(false), 60);
    };
    return {
        dragProps: {
            ref,
            onMouseDown,
            onMouseMove,
            onMouseUp: stop,
            onMouseLeave: stop,
        },
        isDragging,
    };
}
/* =========================================================
   PAGE FILMS
========================================================= */
export default function MoviesCatalogPage() {
    const router = useRouter();
    const [activeCategory, setActiveCategory,] = useState("recent");
    const [visibleLimit, setVisibleLimit,] = useState(48);
    const [searchQuery, setSearchQuery,] = useState("");
    const categoryDrag = useHorizontalScroll();
    const movieDrag = useVerticalScroll();
    /* =======================================================
       CATÉGORIES
    ======================================================= */
    const { data: categories = [], isLoading: isLoadingCats, } = useQuery({
        queryKey: [
            "vod-categories",
        ],
        queryFn: async () => {
            const res = await fetch("/api/xtream?action=get_vod_categories");
            if (!res.ok) {
                throw new Error("Impossible de charger les catégories");
            }
            return res.json();
        },
        select: (data: any[]) => Array.isArray(data)
            ? data.map((cat: any) => ({
                ...cat,
                category_name: formatCategoryName(cat.category_name),
            }))
            : [],
        staleTime: 10 * 60 * 1000,
    });
    useEffect(() => {
        setVisibleLimit(48);
    }, [
        activeCategory,
        searchQuery,
    ]);
    /* =======================================================
       FILMS DE LA CATÉGORIE ACTIVE
    ======================================================= */
    const { data: movies = [], isLoading: isLoadingMovies, } = useQuery({
        queryKey: [
            "movies",
            activeCategory,
        ],
        queryFn: async () => {
            const action = activeCategory ===
                "recent"
                ? "/api/xtream?action=get_vod_streams"
                : `/api/xtream?action=get_vod_streams&category_id=${encodeURIComponent(activeCategory)}`;
            const res = await fetch(action);
            if (!res.ok) {
                throw new Error("Impossible de charger les films");
            }
            const data = await res.json();
            const list = Array.isArray(data)
                ? data
                : [];
            if (activeCategory !==
                "recent") {
                return list;
            }
            return list
                .map((movie: any, index: number) => ({
                movie,
                index,
                modified: Number.parseInt(String(movie?.last_modified ??
                    movie?.added ??
                    movie?.updated_at ??
                    0), 10) || 0,
            }))
                .sort((a, b) => b.modified -
                a.modified ||
                a.index -
                    b.index)
                .map(({ movie }) => movie);
        },
        enabled: activeCategory ===
            "recent" ||
            (categories.length >
                0 &&
                Boolean(activeCategory)),
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData: any) => previousData,
        retry: 0,
    });
    /* =======================================================
       RECHERCHE GLOBALE
    ======================================================= */
    const { data: globalMovies = [], isLoading: isLoadingGlobalSearch, } = useQuery({
        queryKey: [
            "movies",
            "global-search",
        ],
        queryFn: async () => {
            const res = await fetch("/api/xtream?action=get_vod_streams");
            if (!res.ok) {
                throw new Error("Impossible de charger la recherche des films");
            }
            const data = await res.json();
            return Array.isArray(data)
                ? data
                : [];
        },
        enabled: searchQuery
            .trim()
            .length > 0,
        staleTime: 10 * 60 * 1000,
        retry: 0,
    });
    /* =======================================================
       FILTRAGE
    ======================================================= */
    const filteredMovies = useMemo(() => {
        const query = searchQuery
            .trim()
            .toLowerCase();
        const source = query.length > 0
            ? globalMovies
            : movies;
        if (!Array.isArray(source)) {
            return [];
        }
        if (!query) {
            return source.slice(0, visibleLimit);
        }
        return source
            .filter((movie: any) => cleanMovieName(movie?.name ||
            "")
            .toLowerCase()
            .includes(query))
            .slice(0, visibleLimit);
    }, [
        movies,
        globalMovies,
        searchQuery,
        visibleLimit,
    ]);
    const showMoviesLoading = isLoadingMovies ||
        (searchQuery
            .trim()
            .length > 0 &&
            isLoadingGlobalSearch);
    /* =======================================================
       ANIMATIONS
    ======================================================= */
    const containerVariants: Variants = {
        hidden: {
            opacity: 0,
        },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.008,
            },
        },
    };
    const itemVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.97,
            y: 12,
        },
        show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                duration: 0.2,
                ease: [
                    0.16,
                    1,
                    0.3,
                    1,
                ],
            },
        },
    };
    /* =======================================================
       SÉLECTION CATÉGORIE
    ======================================================= */
    const selectCategory = (event: React.MouseEvent<HTMLButtonElement>, categoryId: string) => {
        if (categoryDrag.isDragging) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        setActiveCategory(categoryId);
        setSearchQuery("");
    };
    /* =======================================================
       PARTIE 2 : RETURN / LANDSCAPE UI
    ======================================================= */
    return (<div className="gtv-movies-page relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#060608] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-[#d8ccff]/[0.025] to-transparent blur-3xl"/>
      </div>


      {/* ===================================================
            INTERFACE NORMALE
            Portrait + tablette + desktop
        =================================================== */}

      <div className="gtv-movies-standard-header relative z-10 shrink-0 px-4 pb-2 pt-8 sm:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight drop-shadow-md sm:text-4xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/10 backdrop-blur-md sm:h-12 sm:w-12">
              <Clapperboard className="h-5 w-5 text-[#d8ccff] sm:h-6 sm:w-6"/>
            </div>

            Films
          </h1>


          {/* RECHERCHE */}
          <div className="group relative w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[#d8ccff]"/>

            <input type="search" placeholder="Rechercher un film..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-11 w-full appearance-none rounded-full border border-white/10 bg-white/[0.04] pl-11 pr-10 text-sm text-white shadow-inner outline-none ring-0 transition-all placeholder:text-white/40 focus:border-[#d8ccff]/30 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#d8ccff]/50 sm:w-[280px]"/>

            <AnimatePresence>
              {searchQuery && (<motion.button type="button" initial={{
                opacity: 0,
                scale: 0.8,
            }} animate={{
                opacity: 1,
                scale: 1,
            }} exit={{
                opacity: 0,
                scale: 0.8,
            }} onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors hover:bg-white/10" aria-label="Effacer la recherche">
                  <X className="h-4 w-4 text-white/60 hover:text-white"/>
                </motion.button>)}
            </AnimatePresence>
          </div>
        </div>


        {/* CATÉGORIES NORMALES */}
        <div className="relative mb-2">
          {isLoadingCats ? (<div className="flex gap-3 overflow-hidden">
              {Array.from({
                length: 8,
            }).map((_, index) => (<div key={index} className="h-[64px] w-[140px] shrink-0 animate-pulse rounded-[16px] border border-white/5 bg-white/[0.03] sm:h-[76px] sm:w-[170px]"/>))}
            </div>) : (<div {...categoryDrag.dragProps} style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x",
            }} className={cn(`
                flex
                gap-3
                overflow-x-auto
                pb-4
                scrollbar-none
                select-none
                `, categoryDrag.isDragging
                ? "cursor-grabbing"
                : "cursor-grab")}>
              <CategoryCard name="FILMS RÉCENTS" isActive={activeCategory ===
                "recent"} onClick={(event) => selectCategory(event, "recent")}/>

              {categories
                .filter((cat: any) => String(cat.category_id) !== "0")
                .map((cat: any) => {
                const categoryId = String(cat.category_id);
                return (<CategoryCard key={categoryId} name={cat.category_name} isActive={activeCategory ===
                        categoryId} onClick={(event) => selectCategory(event, categoryId)}/>);
            })}
            </div>)}
        </div>
      </div>


      {/* SÉPARATEUR NORMAL */}
      <div className="gtv-movies-standard-separator h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"/>


      {/* ===================================================
            SHELL PRINCIPAL
            En landscape la colonne catégories arrive à droite
        =================================================== */}

      <div className="gtv-movies-content-shell relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {/* ===============================================
            GRILLE FILMS
        =============================================== */}

        <div {...movieDrag.dragProps} onScroll={(event) => {
            const el = event.currentTarget;
            if (el.scrollTop +
                el.clientHeight >=
                el.scrollHeight -
                    700) {
                setVisibleLimit((current) => Math.min(current + 48, (searchQuery.trim() ? globalMovies : movies).length));
            }
        }} style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
        }} className={cn(`
            gtv-movies-grid-scroll

            relative
            z-10
            min-w-0
            flex-1

            overflow-y-auto

            p-4
            pb-32
            pt-6

            scrollbar-none
            select-none

            sm:p-8
            sm:pb-32
            sm:pt-6
            `, movieDrag.isDragging
            ? "cursor-grabbing"
            : "cursor-grab")}>
          {showMoviesLoading ? (<div className="gtv-movies-grid grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {Array.from({
                length: 24,
            }).map((_, index) => (<div key={index} className="aspect-[2/3] animate-pulse rounded-[20px] border border-white/5 bg-white/[0.03]"/>))}
            </div>) : filteredMovies.length ===
            0 ? (<div className="mt-10 flex h-full flex-col items-center justify-center opacity-60">
              <Search className="mb-4 h-12 w-12 text-white/40"/>

              <p className="text-center text-lg font-medium text-white/70">
                Aucun résultat pour
                &quot;
                {searchQuery}
                &quot;
              </p>

              <p className="mt-1 text-sm text-white/40">
                Essayez avec un autre
                mot-clé ou changez de
                catégorie.
              </p>
            </div>) : (<AnimatePresence mode="wait">
              <motion.div key={`${activeCategory}:${searchQuery}`} variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="gtv-movies-grid grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
                {filteredMovies.map((movie: any) => {
                const movieImage = movie.stream_icon ||
                    movie.cover ||
                    movie.poster ||
                    null;
                const movieName = cleanMovieName(movie.name) ||
                    movie.name ||
                    "Film";
                return (<motion.div variants={itemVariants} key={movie.stream_id} onClick={(event) => {
                        if (movieDrag.isDragging) {
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        router.push(`/movies/${movie.stream_id}`);
                    }} className="gtv-movie-item group relative flex cursor-pointer flex-col [contain-intrinsic-size:300px] [content-visibility:auto]">
                        <div className="gtv-movie-poster relative aspect-[2/3] overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0d12] shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                          {movieImage ? (<img src={movieImage} alt={movieName} draggable={false} loading="lazy" decoding="async" fetchPriority="low" className="pointer-events-none h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" onError={(event) => {
                            event.currentTarget.style.opacity =
                                "0";
                        }}/>) : (<div className="pointer-events-none flex h-full w-full items-center justify-center">
                              <Film className="h-10 w-10 text-white/10"/>
                            </div>)}

                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/40">
                            <div className="flex h-12 w-12 scale-75 items-center justify-center rounded-full border border-white/30 bg-white/20 opacity-0 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100">
                              <Play className="h-5 w-5 translate-x-0.5 fill-white text-white"/>
                            </div>
                          </div>

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"/>
                        </div>

                        <h3 className="gtv-movie-title mt-3 truncate px-1 text-[11px] font-semibold text-white/70 transition-colors group-hover:text-white sm:text-[13px]" title={movieName}>
                          {movieName}
                        </h3>
                      </motion.div>);
            })}
              </motion.div>
            </AnimatePresence>)}
        </div>


        {/* ===============================================
            CATÉGORIES LANDSCAPE À DROITE
        =============================================== */}

        <aside className="gtv-movies-landscape-categories hidden">
          <div className="gtv-movies-landscape-categories-inner h-full overflow-y-auto overscroll-contain scrollbar-none" style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
        }}>
            {isLoadingCats ? (<div className="flex flex-col gap-2">
                {Array.from({
                length: 8,
            }).map((_, index) => (<div key={index} className="h-[44px] w-full shrink-0 animate-pulse rounded-[12px] border border-white/5 bg-white/[0.03]"/>))}
              </div>) : (<div className="flex flex-col gap-2">
                <button type="button" onClick={(event) => selectCategory(event, "recent")} className={cn(`
                    gtv-landscape-category-button
                    relative
                    flex
                    min-h-[44px]
                    w-full
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[12px]
                    border
                    px-2
                    py-2
                    text-center
                    text-[10px]
                    font-bold
                    uppercase
                    leading-[1.1]
                    tracking-[0.04em]
                    transition-all
                    duration-200
                    `, activeCategory ===
                "recent"
                ? `
                        border-[#d8ccff]/55
                        bg-[#d8ccff]/12
                        text-white
                        shadow-[inset_0_0_18px_rgba(216,204,255,.10),0_6px_18px_rgba(170,145,255,.10)]
                      `
                : `
                        border-white/[0.08]
                        bg-white/[0.035]
                        text-white/55
                        hover:border-white/15
                        hover:bg-white/[0.06]
                        hover:text-white
                      `)}>
                  {activeCategory ===
                "recent" && (<span className="absolute left-0 top-1/2 h-[55%] w-[2px] -translate-y-1/2 rounded-full bg-[#d8ccff] shadow-[0_0_10px_rgba(216,204,255,.65)]"/>)}

                  <span>
                    Récents
                  </span>
                </button>


                {categories
                .filter((cat: any) => String(cat.category_id) !== "0")
                .map((cat: any) => {
                const categoryId = String(cat.category_id);
                const isActive = activeCategory ===
                    categoryId;
                return (<button type="button" key={categoryId} onClick={(event) => selectCategory(event, categoryId)} className={cn(`
                            gtv-landscape-category-button
                            relative
                            flex
                            min-h-[44px]
                            w-full
                            shrink-0
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[12px]
                            border
                            px-2
                            py-2
                            text-center
                            text-[10px]
                            font-bold
                            leading-[1.1]
                            tracking-[0.03em]
                            transition-all
                            duration-200
                            `, isActive
                        ? `
                                border-[#d8ccff]/55
                                bg-[#d8ccff]/12
                                text-white
                                shadow-[inset_0_0_18px_rgba(216,204,255,.10),0_6px_18px_rgba(170,145,255,.10)]
                              `
                        : `
                                border-white/[0.08]
                                bg-white/[0.035]
                                text-white/55
                                hover:border-white/15
                                hover:bg-white/[0.06]
                                hover:text-white
                              `)}>
                          {isActive && (<span className="absolute left-0 top-1/2 h-[55%] w-[2px] -translate-y-1/2 rounded-full bg-[#d8ccff] shadow-[0_0_10px_rgba(216,204,255,.65)]"/>)}

                          <span>
                            {cat.category_name}
                          </span>
                        </button>);
            })}
              </div>)}
          </div>
        </aside>
      </div>


      {/* ===================================================
            LANDSCAPE MOBILE
        =================================================== */}

      <style>{`
        @media (orientation: landscape) and (max-height: 600px) {
          .gtv-movies-page {
            height: 100%;
            min-height: 0;
          }

          .gtv-movies-standard-header,
          .gtv-movies-standard-separator {
            display: none !important;
          }

          .gtv-movies-content-shell {
            min-height: 0;
            flex: 1 1 auto;
            align-items: stretch;
            padding: 0;
          }

          .gtv-movies-grid-scroll {
            min-width: 0 !important;
            height: 100% !important;
            padding:
              10px
              10px
              18px
              10px !important;
            overscroll-behavior: contain;
          }

          .gtv-movies-grid {
            grid-template-columns:
              repeat(
                5,
                minmax(0, 1fr)
              ) !important;
            gap: 10px 8px !important;
          }

          .gtv-movie-poster {
            border-radius:
              12px !important;
          }

          .gtv-movie-title {
            margin-top:
              5px !important;
            padding-left:
              1px !important;
            padding-right:
              1px !important;
            font-size:
              9px !important;
            line-height:
              12px !important;
          }

          .gtv-movies-landscape-categories {
            display: block !important;
            position: relative;
            z-index: 30;

            width: 118px;
            min-width: 118px;
            max-width: 118px;

            height: 100%;
            min-height: 0;

            flex: 0 0 118px;

            border-left:
              1px solid
              rgba(
                255,
                255,
                255,
                0.07
              );

            background:
              linear-gradient(
                180deg,
                rgba(
                  16,
                  15,
                  22,
                  0.96
                ),
                rgba(
                  6,
                  6,
                  8,
                  0.985
                )
              );

            box-shadow:
              -12px 0 30px
              rgba(
                0,
                0,
                0,
                0.22
              );

            backdrop-filter:
              blur(18px);

            -webkit-backdrop-filter:
              blur(18px);
          }

          .gtv-movies-landscape-categories-inner {
            padding:
              9px
              8px
              20px;
          }

          .gtv-landscape-category-button {
            min-height:
              42px !important;
          }
        }


        @media (orientation: landscape) and (max-height: 600px) and (min-width: 720px) {
          .gtv-movies-grid {
            grid-template-columns:
              repeat(
                6,
                minmax(0, 1fr)
              ) !important;
          }

          .gtv-movies-landscape-categories {
            width: 124px;
            min-width: 124px;
            max-width: 124px;
            flex-basis: 124px;
          }
        }


        @media (orientation: landscape) and (max-height: 600px) and (min-width: 900px) {
          .gtv-movies-grid {
            grid-template-columns:
              repeat(
                7,
                minmax(0, 1fr)
              ) !important;
          }

          .gtv-movies-grid-scroll {
            padding:
              12px
              12px
              20px
              12px !important;
          }

          .gtv-movies-landscape-categories {
            width: 128px;
            min-width: 128px;
            max-width: 128px;
            flex-basis: 128px;
          }
        }


        .gtv-movies-grid-scroll::-webkit-scrollbar,
        .gtv-movies-landscape-categories-inner::-webkit-scrollbar {
          display: none;
        }

        .gtv-movies-grid-scroll,
        .gtv-movies-landscape-categories-inner {
          -ms-overflow-style:
            none;
          scrollbar-width:
            none;
        }

        input[type="search"] {
          -webkit-appearance:
            none;
          appearance:
            none;
        }

        input[type="search"]::-webkit-search-decoration,
        input[type="search"]::-webkit-search-cancel-button,
        input[type="search"]::-webkit-search-results-button,
        input[type="search"]::-webkit-search-results-decoration {
          -webkit-appearance:
            none;
          display: none;
        }
      `}</style>
    </div>);
}
