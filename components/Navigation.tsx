"use client";


import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


import Link from "next/link";



import { usePathname } from "next/navigation";







import {



  ChevronRight,



  Film,



  Heart,



  Home,



  LogOut,



  MonitorPlay,



  Play,



  Search,



  Tv,



  User,



} from "lucide-react";







type AccountData = {



  username?: string | null;



  status?: string | null;



  expDate?: string | number | null;



  maxConnections?: string | number | null;



  activeConnections?: string | number | null;



};







type ContinueItem = {



  type: "movie" | "series";



  id: string | number;



  title: string;



  image?: string | null;



  seriesId?: string | number | null;



  season?: number | string | null;



  episode?: number | string | null;



  ext?: string | null;



  position?: number;



  duration?: number;



  updatedAt?: number;



};







const desktopNavItems = [



  {



    name: "Accueil",



    href: "/",



    icon: Home,



  },



  {



    name: "Live TV",



    href: "/live",



    icon: Tv,



  },



  {



    name: "Films",



    href: "/movies",



    icon: Film,



  },



  {



    name: "Séries",



    href: "/series",



    icon: MonitorPlay,



  },



  {



    name: "Recherche",



    href: "/search",



    icon: Search,



  },



  {



    name: "Favoris",



    href: "/favorites",



    icon: Heart,



    isFavorite: true,



  },



];







const mobileNavItems = [



  {



    name: "Accueil",



    href: "/",



    icon: Home,



  },



  {



    name: "Films",



    href: "/movies",



    icon: Film,



  },



  {



    name: "Séries",



    href: "/series",



    icon: MonitorPlay,



  },



  {



    name: "Live",



    href: "/live",



    icon: Tv,



  },



  {



    name: "Recherche",



    href: "/search",



    icon: Search,



  },



];







function formatExpiration(value?: string | number | null) {



  if (!value) {



    return "Expiration inconnue";



  }







  const raw = Number(value);







  if (!Number.isFinite(raw) || raw <= 0) {



    return "Sans expiration";



  }







  const date = new Date(raw * 1000);







  if (Number.isNaN(date.getTime())) {



    return "Expiration inconnue";



  }







  return new Intl.DateTimeFormat("fr-FR", {



    day: "2-digit",



    month: "short",



    year: "numeric",



  }).format(date);



}







function getInitials(username?: string | null) {



  if (!username) {



    return "R";



  }







  const clean = username



    .trim()



    .replace(/[_.-]+/g, " ");







  const parts = clean



    .split(/\s+/)



    .filter(Boolean);







  if (parts.length > 1) {



    return (



      parts[0][0] +



      parts[1][0]



    ).toUpperCase();



  }







  return clean



    .slice(0, 2)



    .toUpperCase();



}







function getContinuePercent(item: ContinueItem | null) {



  if (



    !item?.duration ||



    !item?.position ||



    item.duration <= 0



  ) {



    return 0;



  }







  return Math.min(



    100,



    Math.max(



      0,



      (item.position / item.duration) * 100



    )



  );



}






function buildResumeHref(item: ContinueItem) {
  const resume = Math.max(
    0,
    Math.floor(Number(item.position) || 0)
  );


  // SERIES : ne pas toucher
  if (
    item.type === "series" &&
    item.seriesId
  ) {
    const params = new URLSearchParams();

    params.set(
      "play",
      String(item.id)
    );

    if (item.season != null) {
      params.set(
        "season",
        String(item.season)
      );
    }

    if (item.episode != null) {
      params.set(
        "episode",
        String(item.episode)
      );
    }

    if (resume > 15) {
      params.set(
        "resume",
        String(resume)
      );
    }

    return `/series/${item.seriesId}?${params.toString()}`;
  }


  // MOVIES : nouveau lecteur VOD HLS
  const params = new URLSearchParams();

  if (resume > 15) {
    params.set(
      "resume",
      String(resume)
    );
  }

  const query = params.toString();

  return `/movies/${item.id}${
    query ? `?${query}` : ""
  }`;
}


function remainingText(item: ContinueItem | null) {



  if (



    !item?.duration ||



    item.duration <= 0



  ) {



    return "";



  }







  const remaining = Math.max(



    0,



    Number(item.duration) -



      Number(item.position || 0)



  );







  const minutes = Math.ceil(remaining / 60);







  if (minutes <= 0) {



    return "";



  }







  if (minutes < 60) {



    return `${minutes} min restantes`;



  }







  const hours = Math.floor(minutes / 60);



  const mins = minutes % 60;







  if (mins === 0) {



    return `${hours} h restante${hours > 1 ? "s" : ""}`;



  }







  return `${hours} h ${mins} min`;



}







export function Navigation() {



  const pathname = usePathname();







  const [account, setAccount] =



    useState<AccountData | null>(null);







  const [accountLoading, setAccountLoading] =



    useState(true);

  const [continueMovieItems, setContinueMovieItems] =
    useState<ContinueItem[]>([]);

  const continueMoviesRef =
    useRef<HTMLDivElement | null>(null);

  const continueMoviesDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const [
    isContinueMoviesDragging,
    setIsContinueMoviesDragging,
  ] = useState(false);

  const onContinueMoviesPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0
    ) {
      return;
    }

    const el = continueMoviesRef.current;
    if (!el) return;

    continueMoviesDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };

    setIsContinueMoviesDragging(true);
    el.setPointerCapture?.(event.pointerId);
  };

  const onContinueMoviesPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const drag = continueMoviesDragRef.current;
    const el = continueMoviesRef.current;

    if (
      !drag.active ||
      !el ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const delta =
      event.clientX - drag.startX;

    if (Math.abs(delta) > 5) {
      drag.moved = true;
      event.preventDefault();
    }

    el.scrollLeft =
      drag.startScrollLeft - delta;
  };

  const stopContinueMoviesDrag = (
    event?: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!continueMoviesDragRef.current.active) return;

    continueMoviesDragRef.current.active = false;
    setIsContinueMoviesDragging(false);

    if (
      event &&
      continueMoviesRef.current?.hasPointerCapture?.(
        event.pointerId
      )
    ) {
      continueMoviesRef.current.releasePointerCapture(
        event.pointerId
      );
    }
  };

  const blockContinueMoviesClickAfterDrag = (
    event: React.MouseEvent
  ) => {
    if (continueMoviesDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();

      window.setTimeout(() => {
        continueMoviesDragRef.current.moved = false;
      }, 0);
    }
  };







  const [continueItems, setContinueItems] =
    useState<ContinueItem[]>([]);

  const continueSeriesRef =
    useRef<HTMLDivElement | null>(null);

  const continueDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const [
    isContinueDragging,
    setIsContinueDragging,
  ] = useState(false);

  const onContinuePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    // Mouse: left button only. Touch/pen keep native swipe.
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0
    ) {
      return;
    }

    const el = continueSeriesRef.current;
    if (!el) return;

    continueDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };

    setIsContinueDragging(true);
    el.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onContinuePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const drag = continueDragRef.current;
    const el = continueSeriesRef.current;

    if (
      !drag.active ||
      !el ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const delta =
      event.clientX - drag.startX;

    if (Math.abs(delta) > 5) {
      drag.moved = true;
    }

    el.scrollLeft =
      drag.startScrollLeft - delta;

    event.preventDefault();
  };

  const stopContinueDrag = (
    event?: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!continueDragRef.current.active) {
      return;
    }

    continueDragRef.current.active = false;
    setIsContinueDragging(false);

    if (
      event &&
      continueSeriesRef.current?.hasPointerCapture?.(
        event.pointerId
      )
    ) {
      continueSeriesRef.current.releasePointerCapture(
        event.pointerId
      );
    }
  };

  const blockContinueClickAfterDrag = (
    event: React.MouseEvent
  ) => {
    if (continueDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();

      // Reset after the click generated by pointerup.
      window.setTimeout(() => {
        continueDragRef.current.moved = false;
      }, 0);
    }
  };







  useEffect(() => {



    if (pathname === "/login") {



      return;



    }







    let mounted = true;







    fetch("/api/account", {



      cache: "no-store",



    })



      .then((res) => {



        if (!res.ok) {



          throw new Error();



        }







        return res.json();



      })



      .then((json) => {



        if (mounted && json?.ok) {



          setAccount(json);



        }



      })



      .catch(() => {



        if (mounted) {



          setAccount(null);



        }



      })



      .finally(() => {



        if (mounted) {



          setAccountLoading(false);



        }



      });







    return () => {



      mounted = false;



    };



  }, [pathname]);







  useEffect(() => {
    if (pathname === "/login") return;

    const readContinue = () => {
      try {
        const raw = localStorage.getItem("gtv_continue_series");
        const parsed = raw ? JSON.parse(raw) : [];
        const items: ContinueItem[] = Array.isArray(parsed) ? parsed : [];

        const valid = items
          .filter((item) => {
            if (
              !item?.id ||
              !item?.title ||
              item.type !== "series" ||
              !item.seriesId
            ) return false;

            const position = Number(item.position || 0);
            const duration = Number(item.duration || 0);

            if (position <= 15) return false;
            if (duration > 0 && position / duration >= 0.97) return false;
            return true;
          })
          .sort(
            (a, b) =>
              Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
          )
          .slice(0, 3);

        setContinueItems(valid);

        const movieRaw =
          localStorage.getItem("gtv_continue_movies");
        const movieParsed =
          movieRaw ? JSON.parse(movieRaw) : [];
        const movieItems: ContinueItem[] =
          Array.isArray(movieParsed)
            ? movieParsed
            : [];

        const validMovies = movieItems
          .filter((item) => {
            if (
              !item?.id ||
              !item?.title ||
              item.type !== "movie"
            ) return false;

            const position =
              Number(item.position || 0);
            const duration =
              Number(item.duration || 0);

            if (position <= 15) return false;
            if (
              duration > 0 &&
              position / duration >= 0.97
            ) return false;

            return true;
          })
          .sort(
            (a, b) =>
              Number(b.updatedAt || 0) -
              Number(a.updatedAt || 0)
          )
          .slice(0, 3);

        setContinueMovieItems(validMovies);
      } catch {
        setContinueItems([]);
      }
    };

    readContinue();
    window.addEventListener("storage", readContinue);
    window.addEventListener(
      "gtv-continue-updated",
      readContinue as EventListener
    );

    return () => {
      window.removeEventListener("storage", readContinue);
      window.removeEventListener(
        "gtv-continue-updated",
        readContinue as EventListener
      );
    };
  }, [pathname]);







  if (pathname === "/login") {



    return null;



  }







  const isItemActive = (href: string) => {



    if (href === "/") {



      return pathname === "/";



    }







    return (



      pathname === href ||



      pathname.startsWith(`${href}/`)



    );



  };







  const handleLogout = async () => {

    try {

      const response =

        await fetch("/api/logout", {

          method: "POST",

          credentials: "include",

          cache: "no-store",

        });



      if (!response.ok) {

        window.alert('Déconnexion indisponible. Réessayez.');
        return;

      }

    } catch (error) {

      window.alert('Déconnexion indisponible. Réessayez.');
      return;

    }



    try {

      localStorage.removeItem(

        "gtv_xtream_credentials"

      );



      localStorage.removeItem(

        "gtv_last_played"

      );



      localStorage.removeItem(

        "gtv_last_watched"

      );

    } catch {}



    window.location.replace("/login");

  };







  const username =



    account?.username || "Utilisateur";







  const initials =



    getInitials(username);







  const expiration =



    formatExpiration(account?.expDate);







  const accountActive =



    String(account?.status || "").toLowerCase() ===



    "active";







  const continueCount = continueItems.length;
  const continueMovieCount = continueMovieItems.length;







  return (



    <>



      {/* =========================



          DESKTOP >= LG



      ========================= */}







      <nav



        className="



          group relative z-50 hidden h-full



          w-[72px] shrink-0 flex-col overflow-hidden



          border-r border-white/[0.055]



          bg-[#070709]/88



          backdrop-blur-[34px]



          transition-[width] duration-500



          ease-[cubic-bezier(.16,1,.3,1)]



          hover:w-[252px]



          lg:flex



        "



      >



        <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-[#d8ccff]/[0.045] blur-3xl" />







        <Link



          href="/"



          className="



            relative z-10 flex h-[76px]



            shrink-0 items-center



            border-b border-white/[0.05]



            px-[17px]



          "



        >



          <div



            className="



              relative grid h-[38px] w-[38px]



              shrink-0 place-items-center overflow-hidden



              rounded-[13px]



              border border-[#d8ccff]/25



              bg-gradient-to-br



              from-[#d8ccff]/20



              to-white/[0.035]



              text-[16px] font-semibold



              text-[#eee9ff]



            "



          >



            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.18] to-transparent" />







            <span className="relative z-10 font-serif tracking-[-0.08em]">



              G



            </span>



          </div>







          <div className="ml-3 min-w-[160px] opacity-0 transition-all duration-300 group-hover:opacity-100">



            <div className="flex items-center gap-2">



              <span className="font-serif text-[17px] tracking-[0.24em] text-white">



                GTV



              </span>







              <span className="text-[7px] font-semibold tracking-[0.14em] text-[#d8ccff]/65">



                3.0



              </span>



            </div>







            <p className="mt-[2px] text-[7px] uppercase tracking-[0.24em] text-white/23">



              Vision cinématique



            </p>



          </div>



        </Link>







        <div className="relative z-10 space-y-1 px-3 py-4">



          {desktopNavItems.map((item) => {



            const active =



              isItemActive(item.href);







            const Icon = item.icon;







            return (



              <Link



                key={item.name}



                href={item.href}



                className={`



                  relative flex h-[46px]



                  items-center overflow-hidden



                  rounded-[15px] border



                  transition-all duration-300







                  ${



                    active



                      ? `



                        border-[#d8ccff]/18



                        bg-[#d8ccff]/[0.07]



                        text-white



                      `



                      : item.isFavorite



                      ? `



                        border-transparent



                        text-rose-300/50



                        hover:border-white/[0.07]



                        hover:bg-white/[0.04]



                        hover:text-rose-200



                      `



                      : `



                        border-transparent



                        text-white/36



                        hover:border-white/[0.07]



                        hover:bg-white/[0.04]



                        hover:text-white/88



                      `



                  }



                `}



              >



                {active && (



                  <>



                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent" />







                    <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[#d8ccff] shadow-[0_0_12px_rgba(216,204,255,.85)]" />



                  </>



                )}







                <div className="relative z-10 grid h-[44px] w-[44px] shrink-0 place-items-center">



                  <Icon



                    className={`



                      h-[18px] w-[18px]







                      ${



                        active



                          ? "text-[#ece7ff]"



                          : ""



                      }



                    `}



                  />



                </div>







                <span className="relative z-10 ml-1 min-w-[145px] whitespace-nowrap text-[11px] font-semibold opacity-0 transition-opacity duration-300 group-hover:opacity-100">



                  {item.name}



                </span>



              </Link>



            );



          })}



        </div>







        {continueCount > 0 && (
          <div className="relative z-10 mx-3 mb-4 hidden opacity-0 transition-all duration-300 group-hover:block group-hover:opacity-100">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/27">
                Continuer — Séries
              </p>
              <span className="text-[8px] text-white/25">
                {continueCount}/3
              </span>
            </div>

            <div
              ref={continueSeriesRef}
              onPointerDown={onContinuePointerDown}
              onPointerMove={onContinuePointerMove}
              onPointerUp={stopContinueDrag}
              onPointerCancel={stopContinueDrag}
              onLostPointerCapture={stopContinueDrag}
              onClickCapture={blockContinueClickAfterDrag}
              className={`flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isContinueDragging
                  ? "cursor-grabbing snap-none"
                  : "cursor-grab"
              }`}
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x",
              }}
            >
              {continueItems.map((item) => {
                const percent = getContinuePercent(item);

                return (
                  <Link
                    key={`${item.seriesId}:${item.id}`}
                    href={buildResumeHref(item)}
                    draggable={false}
                    className="group/continue relative block aspect-[2/3] w-[118px] min-w-[118px] snap-start overflow-hidden rounded-[16px] border border-white/[0.085] bg-[#101014] select-none"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#17171d] to-[#08080a]">
                        <MonitorPlay className="h-7 w-7 text-white/15" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />

                    <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/35 text-white opacity-0 backdrop-blur-xl transition-all group-hover/continue:opacity-100">
                      <Play className="h-3 w-3 fill-current" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="truncate text-[10px] font-semibold text-white/95">
                        {item.title}
                      </p>

                      <div className="mt-1 flex items-center gap-1 text-[8px] text-white/50">
                        {item.season != null && (
                          <span>
                            S{String(item.season).padStart(2, "0")}
                          </span>
                        )}
                        {item.episode != null && (
                          <>
                            <span>·</span>
                            <span>
                              E{String(item.episode).padStart(2, "0")}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {continueMovieCount > 0 && (
          <div className="relative z-10 mx-3 mb-4 hidden opacity-0 transition-all duration-300 group-hover:block group-hover:opacity-100">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/27">
                Continuer — Films
              </p>
              <span className="text-[8px] text-white/25">
                {continueMovieCount}/3
              </span>
            </div>

            <div
              ref={continueMoviesRef}
              onPointerDown={onContinueMoviesPointerDown}
              onPointerMove={onContinueMoviesPointerMove}
              onPointerUp={stopContinueMoviesDrag}
              onPointerCancel={stopContinueMoviesDrag}
              onLostPointerCapture={stopContinueMoviesDrag}
              onClickCapture={blockContinueMoviesClickAfterDrag}
              className={`flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isContinueMoviesDragging
                  ? "cursor-grabbing snap-none"
                  : "cursor-grab"
              }`}
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x",
              }}
            >
              {continueMovieItems.map((item) => {
                const percent = getContinuePercent(item);

                return (
                  <Link
                    key={`movie:${item.id}`}
                    href={buildResumeHref(item)}
                    draggable={false}
                    className="group/continue relative block aspect-[2/3] w-[118px] min-w-[118px] snap-start overflow-hidden rounded-[16px] border border-white/[0.085] bg-[#101014] select-none"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#17171d] to-[#08080a]">
                        <MonitorPlay className="h-7 w-7 text-white/15" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />

                    <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/35 text-white opacity-0 backdrop-blur-xl transition-all group-hover/continue:opacity-100">
                      <Play className="h-3 w-3 fill-current" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="truncate text-[10px] font-semibold text-white/95">
                        {item.title}
                      </p>

                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}



        <div className="flex-1" />







        <div className="relative z-10 border-t border-white/[0.055] p-2.5">



          <div className="relative flex min-h-[58px] items-center overflow-hidden rounded-[17px] border border-white/[0.075] bg-white/[0.027] backdrop-blur-2xl">



            <div className="relative z-10 ml-[7px] grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[13px] border border-[#d8ccff]/18 bg-gradient-to-br from-[#d8ccff]/14 to-white/[0.035] text-[10px] font-bold text-[#eee9ff]">



              {accountLoading ? (



                <User className="h-4 w-4 text-white/30" />



              ) : (



                initials



              )}







              {!accountLoading && (



                <span



                  className={`



                    absolute bottom-[2px] right-[2px]



                    h-2 w-2 rounded-full



                    border border-[#101015]







                    ${



                      accountActive



                        ? "bg-emerald-400"



                        : "bg-white/25"



                    }



                  `}



                />



              )}



            </div>







            <div className="ml-3 min-w-0 flex-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">



              {!accountLoading && (



                <>



                  <p className="max-w-[105px] truncate text-[10px] font-semibold text-white/80">



                    {username}



                  </p>







                  <p className="mt-1 whitespace-nowrap text-[8px] text-white/28">



                    Expire ·{" "}



                    <span className="text-white/42">



                      {expiration}



                    </span>



                  </p>



                </>



              )}



            </div>







            <button



              type="button"



              onClick={handleLogout}



              title="Déconnexion"



              aria-label="Déconnexion"



              className="relative z-20 mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/24 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-400/[0.06] hover:text-rose-300"



            >



              <LogOut className="h-[15px] w-[15px]" />



            </button>



          </div>



        </div>



      </nav>







      {/* =========================



          MOBILE + TABLETTE < LG



      ========================= */}







      <nav



        className="



          relative z-50



          flex min-h-[68px] w-full



          shrink-0 items-center justify-around



          border-b border-white/[0.09]



          bg-[#09090c]/90



          backdrop-blur-[32px]



          pt-[env(safe-area-inset-top)]



          lg:hidden



        "



      >



        <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.08] to-transparent" />







        <div className="relative z-10 flex h-[68px] w-full items-center justify-around">



          {mobileNavItems.map((item) => {



            const active =



              isItemActive(item.href);







            const Icon = item.icon;







            return (



              <Link



                key={item.name}



                href={item.href}



                className={`



                  relative flex h-[52px] min-w-[52px]



                  flex-col items-center justify-center



                  rounded-[16px] border



                  transition-all duration-300







                  ${



                    active



                      ? `



                        border-[#d8ccff]/18



                        bg-[#d8ccff]/[0.075]



                        text-white



                      `



                      : `



                        border-transparent



                        text-white/35



                      `



                  }



                `}



              >



                <Icon



                  className={`



                    h-[18px] w-[18px]







                    ${



                      active



                        ? "text-[#e7e0ff]"



                        : ""



                    }



                  `}



                />







                <span className="mt-1 text-[7.5px] font-semibold">



                  {item.name}



                </span>







                {active && (



                  <span className="absolute bottom-[3px] h-1 w-1 rounded-full bg-[#d8ccff] shadow-[0_0_9px_rgba(216,204,255,.85)]" />



                )}



              </Link>



            );



          })}



        </div>



      </nav>



    </>



  );



}