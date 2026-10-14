"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import dynamic from "next/dynamic";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  Tv,
  X,
} from "lucide-react";

import { channelLogoUrl } from "@/lib/channel-logo-url";

import { ChannelRow } from "./ChannelRow";
import {
  useLiveCategories,
  useLiveChannels,
} from "./useLiveCatalog";

import { attachVerticalDrag } from "./live-drag";

import {
  footballChannel,
  getTimeZone,
  normalize,
} from "./live-utils";

import type {
  Category,
  Channel,
  FootballFixture,
} from "./live-types";

import "./live-premium.css";


/* =========================================================
   PLAYER
   ========================================================= */

const LivePlayer = dynamic(
  () =>
    import(
      "@/components/player/LivePlayer"
    ).then(
      (mod) => mod.LivePlayer
    ),
  {
    ssr: false,

    loading: () => (
      <div className="live-player-loading">
        <Loader2 className="live-spin" />

        Chargement du lecteur…
      </div>
    ),
  }
);


/* =========================================================
   SPORT
   ========================================================= */

const LiveSports = dynamic(
  () => import("./LiveSports"),
  {
    ssr: false,

    loading: () => (
      <div
        className="live-sport-loading"
        role="status"
      >
        <Loader2
          className="live-spin"
          size={18}
        />

        Chargement de l’espace sport…
      </div>
    ),
  }
);


const CHANNEL_BATCH = 40;


/* =========================================================
   PAGE
   ========================================================= */

export default function LivePage() {
  type CurrentFootballMatch = {
  fixture: FootballFixture;
  programmeTitle: string | null;
};

  /* =======================================================
     DATA
     ======================================================= */

  const categoryData =
    useLiveCategories();

const categories: Category[] =
  categoryData.data as Category[];


  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState<Category | null>(
      null
    );


  const [
    selectedChannel,
    setSelectedChannel,
  ] =
    useState<Channel | null>(
      null
    );


  const channelData =
    useLiveChannels(
      selectedCategory
        ?.category_id ??
        null
    );


const channels: Channel[] =
  channelData.data as Channel[];


  /* =======================================================
     SEARCH
     ======================================================= */

  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    categorySearch,
    setCategorySearch,
  ] =
    useState("");


  /*
   * Mobile :
   * la recherche ne prend plus
   * constamment une grosse ligne.
   *
   * Elle s'ouvre depuis l'icône
   * comme dans le mockup.
   */

  const [
    mobileSearchOpen,
    setMobileSearchOpen,
  ] =
    useState(false);


  /* =======================================================
     CHANNEL PAGINATION
     ======================================================= */

  const [
    channelLimit,
    setChannelLimit,
  ] =
    useState(
      CHANNEL_BATCH
    );


  /* =======================================================
     TIMEZONE
     ======================================================= */

  const [
    timeZone,
    setTimeZone,
  ] =
    useState("UTC");

    /* =======================================================
   CURRENT SPORT MATCH
   ======================================================= */

const [
  currentFootballMatch,
  setCurrentFootballMatch,
] =
  useState<CurrentFootballMatch | null>(
    null
  );


const [
  countdownNow,
  setCountdownNow,
] =
  useState(
    () => Date.now()
  );

  /* =======================================================
   SPORT COUNTDOWN TIMER
   ======================================================= */

useEffect(() => {
  if (!currentFootballMatch) {
    return;
  }

  const fixture =
    currentFootballMatch.fixture;

  if (fixture.status.live) {
    return;
  }

  const start =
    new Date(
      fixture.startingAt
    ).getTime();

  if (
    !Number.isFinite(start) ||
    start <= Date.now()
  ) {
    return;
  }

  setCountdownNow(
    Date.now()
  );

  const timer =
    window.setInterval(
      () => {
        setCountdownNow(
          Date.now()
        );
      },
      1000
    );

  return () => {
    window.clearInterval(
      timer
    );
  };
}, [
  currentFootballMatch,
]);

const sportFixture =
  currentFootballMatch
    ?.fixture ??
  null;


const sportStartTime =
  sportFixture
    ? new Date(
        sportFixture.startingAt
      ).getTime()
    : null;


const sportCountdownMs =
  sportStartTime !== null &&
  Number.isFinite(
    sportStartTime
  )
    ? Math.max(
        0,
        sportStartTime -
          countdownNow
      )
    : 0;


const sportCountdown =
  useMemo(() => {
    const totalSeconds =
      Math.max(
        0,
        Math.floor(
          sportCountdownMs /
            1000
        )
      );

    const days =
      Math.floor(
        totalSeconds /
          86400
      );

    const hours =
      Math.floor(
        (
          totalSeconds %
          86400
        ) /
          3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) /
          60
      );

    const seconds =
      totalSeconds %
      60;

    const hh =
      String(
        hours
      ).padStart(
        2,
        "0"
      );

    const mm =
      String(
        minutes
      ).padStart(
        2,
        "0"
      );

    const ss =
      String(
        seconds
      ).padStart(
        2,
        "0"
      );

    if (days > 0) {
      return `${days}j ${hh}:${mm}:${ss}`;
    }

    return `${hh}:${mm}:${ss}`;
  }, [
    sportCountdownMs,
  ]);


const sportKickoff =
  useMemo(() => {
    if (
      !sportFixture
    ) {
      return "";
    }

    const date =
      new Date(
        sportFixture.startingAt
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(
        "fr-FR",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone,
        }
      ).format(
        date
      );
    } catch {
      return date.toLocaleTimeString(
        "fr-FR",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      );
    }
  }, [
    sportFixture,
    timeZone,
  ]);



  /* =======================================================
     REFS
     ======================================================= */

  const categoryRef =
    useRef<HTMLDivElement>(
      null
    );


  const channelRef =
    useRef<HTMLDivElement>(
      null
    );


  /* =======================================================
     TIMEZONE
     ======================================================= */

  useEffect(() => {

    setTimeZone(
      getTimeZone()
    );

  }, []);


  /* =======================================================
     CATEGORY
     ======================================================= */

  const chooseCategory =
    useCallback(
      (
        category:
          Category
      ) => {

        setSelectedCategory(
          category
        );


        setSearch("");


        setMobileSearchOpen(
          false
        );


        setChannelLimit(
          CHANNEL_BATCH
        );


        /*
         * Le changement de catégorie
         * ne coupe PAS le Live en cours.
         */

        if (
          channelRef.current
        ) {

          channelRef.current
            .scrollTop = 0;

        }

      },
      []
    );


  /* =======================================================
     BACK TO CATEGORIES
     ======================================================= */

  const backToCategories =
    useCallback(
      () => {

        setSelectedCategory(
          null
        );


        setSearch("");


        setCategorySearch(
          ""
        );


        setMobileSearchOpen(
          false
        );


        setChannelLimit(
          CHANNEL_BATCH
        );


        if (
          categoryRef.current
        ) {

          categoryRef.current
            .scrollTop = 0;

        }

      },
      []
    );


  /* =======================================================
     CHANNEL
     ======================================================= */

  const chooseChannel =
    useCallback(
      (
        channel:
          Channel
      ) => {

        setSelectedChannel(
          channel
        );


        setMobileSearchOpen(
          false
        );


        try {

          localStorage.setItem(
            "gtv_last_watched",

            JSON.stringify({
              id:
                channel.stream_id,

              title:
                channel.name,

              poster:
                channel.stream_icon,

              progress:
                100,

              type:
                "live",
            })
          );

        } catch {

          /*
           * Le playback ne dépend
           * jamais du localStorage.
           */

        }

      },
      []
    );


  /* =======================================================
     LAUNCH CHANNEL FROM SPORT
     ======================================================= */

  const launchChannel =
    useCallback(
      (
        channel:
          Channel
      ) => {

        const category =
          categories.find(
            (item) =>
              item.category_id ===
              channel.category_id
          );


        if (category) {

          chooseCategory(
            category
          );

        }


        chooseChannel(
          channel
        );

      },
      [
        categories,
        chooseCategory,
        chooseChannel,
      ]
    );


  /* =======================================================
     CLOSE PLAYER
     ======================================================= */

  const closePlayer =
    useCallback(
      () => {

        setSelectedChannel(
          null
        );

      },
      []
    );


  /*
   * On conserve le contrat actuel
   * de LivePlayer.
   *
   * On ne modifie PAS LivePlayer.tsx.
   */

  const noopBackToCategories =
    useCallback(
      () => {},
      []
    );


  /* =======================================================
     MOBILE SEARCH
     ======================================================= */

  const toggleMobileSearch =
    useCallback(
      () => {

        setMobileSearchOpen(
          (current) =>
            !current
        );

      },
      []
    );


  const closeMobileSearch =
    useCallback(
      () => {

        setMobileSearchOpen(
          false
        );

      },
      []
    );


  /* =======================================================
     FILTER CATEGORIES
     ======================================================= */

  const filteredCategories =
    useMemo(
      () => {

        const query =
          normalize(
            categorySearch
          );


        return categories.filter(
          (category) =>
            normalize(
              category
                .category_name
            ).includes(
              query
            )
        );

      },
      [
        categories,
        categorySearch,
      ]
    );


  /* =======================================================
     FILTER CHANNELS
     ======================================================= */

  const filteredChannels =
    useMemo(
      () => {

        const query =
          search
            .toLocaleLowerCase()
            .trim();


        return channels.filter(
          (channel) =>
            channel.name
              .toLocaleLowerCase()
              .includes(
                query
              )
        );

      },
      [
        channels,
        search,
      ]
    );


  /* =======================================================
     RENDERED CHANNELS
     ======================================================= */

  const renderedChannels =
    useMemo(
      () =>
        filteredChannels.slice(
          0,
          channelLimit
        ),
      [
        filteredChannels,
        channelLimit,
      ]
    );


  /* =======================================================
     RESET CHANNEL SCROLL
     ======================================================= */

  useEffect(
    () => {

      setChannelLimit(
        CHANNEL_BATCH
      );


      if (
        channelRef.current
      ) {

        channelRef.current
          .scrollTop = 0;

      }

    },
    [
      search,
      selectedCategory
        ?.category_id,
    ]
  );


  /* =======================================================
     LOAD MORE
     ======================================================= */

  const loadMore =
    useCallback(
      () => {

        setChannelLimit(
          (limit) =>
            Math.min(
              limit +
                CHANNEL_BATCH,

              filteredChannels
                .length
            )
        );

      },
      [
        filteredChannels
          .length,
      ]
    );


  /* =======================================================
     INFINITE CHANNEL SCROLL
     ======================================================= */

  const onChannelScroll =
    useCallback(
      () => {

        const el =
          channelRef.current;


        if (
          el &&
          el.scrollTop +
            el.clientHeight >=
            el.scrollHeight -
              220 &&
          channelLimit <
            filteredChannels
              .length
        ) {

          loadMore();

        }

      },
      [
        channelLimit,
        filteredChannels
          .length,
        loadMore,
      ]
    );


  /* =======================================================
     TOUCH / MOUSE DRAG
     ======================================================= */

  useEffect(
    () => {

      const cleanups = [
        attachVerticalDrag(
          categoryRef
        ),

        attachVerticalDrag(
          channelRef
        ),
      ];


      return () =>
        cleanups.forEach(
          (cleanup) =>
            cleanup?.()
        );

    },
    []
  );


  /* =======================================================
     CURRENT CHANNEL INDEX
     ======================================================= */

  const channelIndex =
    filteredChannels.findIndex(
      (channel) =>
        channel.stream_id ===
        selectedChannel
          ?.stream_id
    );


  const hasNext =
    channelIndex >= 0 &&
    channelIndex <
      filteredChannels.length -
        1;


  /* =======================================================
     NEXT CHANNEL
     ======================================================= */

  const nextChannel =
    useCallback(
      () => {

        if (!hasNext) {
          return;
        }


        chooseChannel(
          filteredChannels[
            channelIndex + 1
          ]
        );

      },
      [
        hasNext,
        filteredChannels,
        channelIndex,
        chooseChannel,
      ]
    );

  /* =======================================================
     PLAYING CATEGORY
     ======================================================= */

  const playingCategory: Category | null = useMemo(() => {
    if (selectedChannel === null) {
      return null;
    }

    const channelCategoryId: string =
      selectedChannel.category_id;

    const match = (categories as Category[]).find(
      (item: Category) =>
        item.category_id === channelCategoryId
    );

    return match ?? null;
  }, [categories, selectedChannel]);


  /* =======================================================
     SHOW FOOTBALL
     ======================================================= */

  const showFootball: boolean = useMemo(() => {
    if (selectedChannel === null) {
      return false;
    }

    const channelName =
      selectedChannel.name ?? "";

    const categoryName =
      playingCategory?.category_name ?? "";

    return (
      footballChannel(channelName) ||
      footballChannel(categoryName) ||
      normalize(categoryName).includes("sport") ||
      normalize(channelName).includes("sport") ||
      normalize(channelName).includes("football") ||
      normalize(channelName).includes("foot")
    );
  }, [
    selectedChannel,
    playingCategory,
  ]);

  useEffect(() => {
  if (
    !showFootball
  ) {
    setCurrentFootballMatch(
      null
    );
  }
}, [
  showFootball,
]);

  /* =======================================================
     SPORT CHANNELS
     ======================================================= */

  const sportChannels: Channel[] = useMemo(() => {
    if (
      !showFootball ||
      selectedChannel === null
    ) {
      return [];
    }

    const currentChannels: Channel[] =
      channels as Channel[];

    const alreadyPresent =
      currentChannels.some(
        (channel: Channel) =>
          channel.stream_id ===
          selectedChannel.stream_id
      );

    if (alreadyPresent) {
      return currentChannels;
    }

    return [
      ...currentChannels,
      selectedChannel,
    ];
  }, [
    showFootball,
    channels,
    selectedChannel,
  ]);

  /* =======================================================
     STREAM
     ======================================================= */

  const streamUrl =
    selectedChannel
      ? `/api/hls?id=${selectedChannel.stream_id}`
      : null;


  const playerSources =
    useMemo(
      () =>
        streamUrl
          ? [streamUrl]
          : [],
      [streamUrl]
    );


  /* =======================================================
     REFRESH STATE
     ======================================================= */

  const refreshing =
    categoryData.refreshing ||
    channelData.refreshing;


  /* =======================================================
     BROWSER MODE
     ======================================================= */

  /*
   * Une seule sidebar.
   *
   * Pas de double colonne
   * Catégories + Chaînes.
   *
   * Quand aucune catégorie
   * n'est sélectionnée :
   *
   *   -> catégories
   *
   * Quand une catégorie
   * est sélectionnée :
   *
   *   -> chaînes
   */

  const showChannels =
    !!selectedCategory;


  /* =======================================================
     SEARCH VALUE
     ======================================================= */

  const currentSearchValue =
    showChannels
      ? search
      : categorySearch;


  /* =======================================================
     SEARCH CHANGE
     ======================================================= */

  const handleBrowserSearch =
    useCallback(
      (
        value:
          string
      ) => {

        if (
          selectedCategory
        ) {

          setSearch(
            value
          );

          return;

        }


        setCategorySearch(
          value
        );

      },
      [
        selectedCategory,
      ]
    );


  /* =======================================================
     CLEAR SEARCH
     ======================================================= */

  const clearBrowserSearch =
    useCallback(
      () => {

        if (
          selectedCategory
        ) {

          setSearch("");

        } else {

          setCategorySearch("");

        }

      },
      [
        selectedCategory,
      ]
    );


  /* =======================================================
     REFRESH
     ======================================================= */

  const refreshLive =
    useCallback(
      () => {

        categoryData.refresh();


        if (
          selectedCategory
        ) {

          channelData.refresh();

        }

      },
      [
        categoryData,
        channelData,
        selectedCategory,
      ]
    );


  /* =======================================================
     RETURN
     ======================================================= */

  return (

    <div className="live-premium">

      {/* ===================================================
          DESKTOP HEADER
          =================================================== */}

      <header className="live-heading">

        <div className="live-heading-title">

          <span className="live-heading-icon">

            <Radio size={22} />

          </span>


          <div>

            <p className="live-eyebrow">

              Votre télévision,
              en direct

            </p>


            <h1>

              Live TV

              <span className="live-on-air">

                DIRECT

              </span>

            </h1>

          </div>

        </div>


        <button
          type="button"
          className="live-refresh"
          disabled={
            refreshing
          }
          onClick={
            refreshLive
          }
          aria-label="Actualiser le Live"
          title="Actualiser le Live"
        >

          <RefreshCw
            size={16}
            className={
              refreshing
                ? "live-spin"
                : ""
            }
          />


          <span>

            {refreshing
              ? "Actualisation…"
              : "Actualiser"}

          </span>

        </button>

      </header>


      {/* ===================================================
          LAYOUT

          NORMAL :
          Browser | Player

          SPORT :
          Browser | Player | Sport
          =================================================== */}

      <main
        className={`live-layout ${
          showFootball
            ? "has-sport"
            : ""
        }`}
      >

        {/* =================================================
            BROWSER UNIQUE

            CATÉGORIES <-> CHAÎNES
            ================================================= */}

        <aside
          className={`live-browser live-surface ${
            showChannels
              ? "is-channels"
              : "is-categories"
          } ${
            mobileSearchOpen
              ? "is-searching"
              : ""
          }`}
          aria-label={
            showChannels
              ? "Chaînes"
              : "Catégories"
          }
        >

          {/* ===============================================
              HEADER COMPACT
              =============================================== */}

          <div className="live-browser-topbar">

            <div className="live-browser-topbar-main">

              {showChannels ? (

                <button
                  type="button"
                  className="live-browser-back"
                  onClick={
                    backToCategories
                  }
                  aria-label="Retour aux catégories"
                  title="Catégories"
                >

                  <ChevronLeft
                    size={19}
                  />


                  <span>

                    Catégories

                  </span>

                </button>

              ) : (

                <div className="live-browser-title">

                  <Tv
                    size={17}
                    aria-hidden="true"
                  />


                  <span>

                    Catégories

                  </span>

                </div>

              )}


              <button
                type="button"
                className={`live-browser-search-toggle ${
                  mobileSearchOpen
                    ? "is-active"
                    : ""
                }`}
                onClick={
                  toggleMobileSearch
                }
                aria-label={
                  mobileSearchOpen
                    ? "Fermer la recherche"
                    : showChannels
                      ? "Rechercher une chaîne"
                      : "Rechercher une catégorie"
                }
                title="Rechercher"
              >

                {mobileSearchOpen ? (

                  <X size={18} />

                ) : (

                  <Search
                    size={18}
                  />

                )}

              </button>

            </div>


            {/* =============================================
                CONTEXT
                ============================================= */}

            <div className="live-browser-context">

              {showChannels ? (

                <>

                  <div className="live-browser-context-copy">

                    <span className="live-browser-context-label">

                      Chaînes

                    </span>


                    <strong>

                      {
                        selectedCategory
                          ?.category_name
                      }

                    </strong>

                  </div>


                  <span className="live-browser-total">

                    {
                      filteredChannels.length
                    }

                  </span>

                </>

              ) : (

                <>

                  <div className="live-browser-context-copy">

                    <span className="live-browser-context-label">

                      Explorer

                    </span>


                    <strong>

                      Toutes les catégories

                    </strong>

                  </div>


                  <span className="live-browser-total">

                    {
                      categories.length
                    }

                  </span>

                </>

              )}

            </div>


            {/* =============================================
                SEARCH DRAWER

                Desktop :
                visible normalement via CSS.

                Mobile :
                apparaît avec la loupe.
                ============================================= */}

            <div className="live-browser-search-panel">

              <label className="live-browser-search">

                <Search
                  size={15}
                  aria-hidden="true"
                />


                <input
                  type="search"
                  value={
                    currentSearchValue
                  }
                  onChange={(
                    event
                  ) =>
                    handleBrowserSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder={
                    showChannels
                      ? "Rechercher une chaîne…"
                      : "Rechercher une catégorie…"
                  }
                  aria-label={
                    showChannels
                      ? "Rechercher une chaîne"
                      : "Rechercher une catégorie"
                  }
                />


                {currentSearchValue && (

                  <button
                    type="button"
                    className="live-browser-search-clear"
                    onClick={
                      clearBrowserSearch
                    }
                    aria-label="Effacer la recherche"
                  >

                    <X
                      size={14}
                    />

                  </button>

                )}

              </label>

            </div>


            {/* =============================================
                ERRORS
                ============================================= */}

            {!showChannels &&
              categoryData.error && (

                <p
                  className="live-error"
                  role="status"
                >

                  {
                    categoryData.error
                  }


                  <button
                    type="button"
                    onClick={
                      categoryData.refresh
                    }
                  >

                    Réessayer

                  </button>

                </p>

              )}


            {showChannels &&
              channelData.error && (

                <p
                  className="live-error"
                  role="status"
                >

                  {
                    channelData.error
                  }


                  <button
                    type="button"
                    onClick={
                      channelData.refresh
                    }
                  >

                    Réessayer

                  </button>

                </p>

              )}

          </div>

                    {/* ===============================================
              CATEGORIES
              =============================================== */}

          {!showChannels && (

            <div
              className="live-browser-scroll live-category-list"
              ref={
                categoryRef
              }
              tabIndex={0}
              aria-label="Liste des catégories"
            >

              {categoryData.loading ? (

                <div
                  className="live-empty"
                  role="status"
                >

                  <Loader2
                    className="live-spin"
                  />


                  <span>

                    Chargement des
                    catégories…

                  </span>

                </div>

              ) : filteredCategories.length ===
                0 ? (

                <div className="live-empty">

                  <Search
                    size={22}
                  />


                  <span>

                    {categorySearch
                      ? "Aucune catégorie ne correspond à votre recherche."
                      : "Aucune catégorie disponible."}

                  </span>

                </div>

              ) : (

                filteredCategories.map(
                  (
                    category
                  ) => {

const active = false;


                    const sport =
                      footballChannel(
                        category
                          .category_name
                      ) ||

                      normalize(
                        category
                          .category_name
                      ).includes(
                        "sport"
                      );


                    return (

                      <button
                        type="button"
                        key={
                          category
                            .category_id
                        }
                        className={`live-category ${
                          active
                            ? "is-active"
                            : ""
                        }`}
                        aria-pressed={
                          active
                        }
                        onClick={() =>
                          chooseCategory(
                            category
                          )
                        }
                      >

                        <span className="live-category-icon">

                          {sport ? (

                            <Trophy
                              size={17}
                            />

                          ) : (

                            <Tv
                              size={17}
                            />

                          )}

                        </span>


                        <span className="live-category-copy">

                          <strong>

                            {
                              category
                                .category_name
                            }

                          </strong>

                        </span>


                        <ChevronRight
                          className="live-category-chevron"
                          size={15}
                        />

                      </button>

                    );

                  }
                )

              )}

            </div>

          )}


          {/* ===============================================
              CHANNELS
              =============================================== */}

          {showChannels && (

            <div
              className="live-browser-scroll live-channel-list"
              ref={
                channelRef
              }
              onScroll={
                onChannelScroll
              }
              tabIndex={0}
              aria-label="Liste des chaînes"
            >

              {channelData.loading ? (

                <div
                  className="live-empty"
                  role="status"
                >

                  <Loader2
                    className="live-spin"
                  />


                  <span>

                    Chargement des
                    chaînes…

                  </span>

                </div>

              ) : filteredChannels.length ===
                0 ? (

                <div className="live-empty">

                  <Search
                    size={22}
                  />


                  <span>

                    {search
                      ? "Aucune chaîne ne correspond à votre recherche."
                      : "Aucune chaîne dans cette catégorie."}

                  </span>

                </div>

              ) : (

                <>

                  <div className="live-channel-grid">

                    {renderedChannels.map(
                      (
                        channel
                      ) => (

                        <ChannelRow
                          key={
                            channel
                              .stream_id
                          }
                          channel={
                            channel
                          }
                          active={
                            channel
                              .stream_id ===
                            selectedChannel
                              ?.stream_id
                          }
                          onSelect={
                            chooseChannel
                          }
                        />

                      )
                    )}

                  </div>


                  {renderedChannels.length <
                    filteredChannels.length && (

                    <button
                      className="live-more"
                      type="button"
                      onClick={
                        loadMore
                      }
                    >

                      <span>

                        Afficher plus

                      </span>


                      <small>

                        {
                          renderedChannels.length
                        }

                        {" / "}

                        {
                          filteredChannels.length
                        }

                      </small>

                    </button>

                  )}

                </>

              )}

            </div>

          )}

        </aside>


        {/* =================================================
            PLAYER
            ================================================= */}

        <section
          className="live-stage live-surface"
          aria-label="Lecteur en direct"
        >

          {/* ===============================================
              PLAYER FRAME

              Pas de key.
              Le passage normal -> sport
              ne remonte PAS LivePlayer.
              =============================================== */}

          <div className="live-player-frame">

            {selectedChannel &&
            streamUrl ? (

              <LivePlayer
                categories={
                  categories
                }
                channels={
                  channels
                }
                selectedCategory={
                  selectedCategory
                }
                selectedChannelId={
                  selectedChannel
                    .stream_id
                }
                loadingChannels={
                  channelData.loading
                }
                onSelectCategory={
                  chooseCategory
                }
                onSelectChannel={
                  chooseChannel
                }
                onBackToCategories={
                  noopBackToCategories
                }
                sources={
                  playerSources
                }
                ext="m3u8"
                title={
                  selectedChannel.name
                }
                channelIcon={
                  channelLogoUrl(
                    selectedChannel.name,
                    selectedChannel
                      .stream_icon
                  )
                }
                hasNext={
                  hasNext
                }
                onNext={
                  nextChannel
                }
                onBack={
                  closePlayer
                }
              />

            ) : (

              <div className="live-player-placeholder">

                <span className="live-player-placeholder-icon">

                  <Tv
                    size={38}
                  />

                </span>


                <p className="live-eyebrow">

                  Installez-vous

                </p>


                <h2>

                  Le direct
                  commence ici.

                </h2>


                <p>

                  {selectedCategory
                    ? "Choisissez une chaîne pour lancer la lecture."
                    : "Explorez les catégories, puis choisissez votre chaîne."}

                </p>

              </div>

            )}

          </div>


          {/* ===============================================
              NOW PLAYING
              =============================================== */}

<div
  className={
    `live-now ${
      sportFixture
        ? "has-sport-match"
        : ""
    }`
  }
>

  {sportFixture ? (

    <div className="live-now-match">

      <div className="live-now-match-head">

        <div className="live-now-match-league">

          {sportFixture
            .league
            .logo && (

            <img
              src={
                sportFixture
                  .league
                  .logo
              }
              alt=""
              draggable={
                false
              }
            />

          )}

          <div>

            <span>
              {sportFixture
                .status
                .live
                ? "MATCH EN DIRECT"
                : "PROCHAIN MATCH"}
            </span>

            <strong>
              {sportFixture
                .league
                .name ||
                "Football"}
            </strong>

          </div>

        </div>


        {sportFixture
          .status
          .live ? (

          <span className="live-now-match-live">

            <i />

            EN DIRECT

          </span>

        ) : (

          <div className="live-now-countdown">

            <span>
              DÉBUT DANS
            </span>

            <strong>
              {sportCountdown}
            </strong>

          </div>

        )}

      </div>


      <div className="live-now-match-main">

        <div className="live-now-team">

          <div className="live-now-team-logo">

            {sportFixture
              .home
              .logo ? (

              <img
                src={
                  sportFixture
                    .home
                    .logo
                }
                alt=""
                draggable={
                  false
                }
              />

            ) : (

              <span>
                {sportFixture
                  .home
                  .name
                  .slice(
                    0,
                    1
                  )}
              </span>

            )}

          </div>

          <strong>
            {sportFixture
              .home
              .name}
          </strong>

        </div>


        <div className="live-now-match-center">

          {sportFixture
            .status
            .live ? (

            <>
              <span>
                EN DIRECT
              </span>

              <strong className="live-now-score">

                {sportFixture
                  .score
                  .home ??
                  "–"}

                <i>
                  :
                </i>

                {sportFixture
                  .score
                  .away ??
                  "–"}

              </strong>
            </>

          ) : (

            <>
              <span>
                {sportKickoff}
              </span>

              <strong>
                VS
              </strong>
            </>

          )}

        </div>


        <div className="live-now-team is-away">

          <div className="live-now-team-logo">

            {sportFixture
              .away
              .logo ? (

              <img
                src={
                  sportFixture
                    .away
                    .logo
                }
                alt=""
                draggable={
                  false
                }
              />

            ) : (

              <span>
                {sportFixture
                  .away
                  .name
                  .slice(
                    0,
                    1
                  )}
              </span>

            )}

          </div>

          <strong>
            {sportFixture
              .away
              .name}
          </strong>

        </div>

      </div>


      <div className="live-now-match-footer">

        <span>
          {selectedChannel
            ?.name}
        </span>

        {currentFootballMatch
          ?.programmeTitle && (

          <span>
            {
              currentFootballMatch
                .programmeTitle
            }
          </span>

        )}

      </div>

    </div>

  ) : (

    <>

      <div className="live-now-copy">

        <p className="live-eyebrow">

          {selectedChannel
            ? "À l’écran"
            : "À vous de choisir"}

        </p>


        <h2>

          {selectedChannel
            ?.name ??
            "Toutes vos chaînes. Un seul endroit."}

        </h2>


        <p>

          {selectedChannel
            ? playingCategory
                ?.category_name ??
              "Live TV"
            : "Catégories › Chaînes › En direct"}

        </p>

      </div>


      {selectedChannel && (

        <span className="live-on-air">

          <span />

          EN DIRECT

        </span>

      )}

    </>

  )}

</div>

        </section>

                {/* =================================================
            SPORT

            Le panneau existe uniquement
            lorsqu'une chaîne Sport est réellement
            en lecture.

            DESKTOP :
            troisième colonne.

            MOBILE LANDSCAPE :
            troisième colonne compacte.

            Il ne recouvre PAS le player.
            ================================================= */}

        {showFootball && (

          <section
            className="live-sport live-surface"
            aria-label="Espace sport"
          >

            {/* =============================================
                SPORT HEADER
                ============================================= */}

            <div className="live-sport-heading">

              <div className="live-sport-heading-copy">

                <span className="live-sport-icon">

                  <Trophy
                    size={18}
                  />

                </span>


                <div>

                  <p className="live-eyebrow">

                    Autour du direct

                  </p>


                  <h2>

                    Espace Sport

                  </h2>

                </div>

              </div>


              <span className="live-sport-status">

                LIVE

              </span>

            </div>


            {/* =============================================
                SPORT CONTENT
                ============================================= */}

            <div className="live-sport-content">

<LiveSports
  channels={
    sportChannels
  }

  selectedChannel={
    selectedChannel
  }

  selectedCategory={
    playingCategory
  }

  timeZone={
    timeZone
  }

  onLaunchChannel={
    launchChannel
  }

  onCurrentMatchChange={
    setCurrentFootballMatch
  }
/>

            </div>

          </section>

        )}

      </main>


      {/* ===================================================
          MOBILE PORTRAIT PREMIUM

          Le CSS l'affiche uniquement
          en portrait <= 1024px.
          =================================================== */}

      <div
        className="live-rotate-device"
        aria-label="Optimisation de l'affichage Live"
      >

        <div className="live-rotate-card">

          {/* ===============================================
              VISUAL
              =============================================== */}

          <div
            className="live-orientation-visual"
            aria-hidden="true"
          >

            {/* PORTRAIT PHONE */}

            <div className="live-phone live-phone-portrait">

              <div className="live-phone-screen">

                <div className="live-phone-stadium">

                  <div className="live-stadium-sky" />

                  <div className="live-stadium-lights" />

                  <div className="live-stadium-stands" />

                  <div className="live-stadium-pitch" />

                </div>

              </div>

            </div>


            {/* ROTATION ARROW */}

            <div className="live-orientation-arrow">

              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >

                <path
                  d="M18 67C28 35 51 21 78 27"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                />


                <path
                  d="M68 16L82 27L70 41"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

              </svg>

            </div>


            {/* LANDSCAPE PHONE */}

            <div className="live-phone live-phone-landscape">

              <div className="live-phone-screen">

                <div className="live-phone-camera" />


                <div className="live-phone-stadium">

                  <div className="live-stadium-sky" />

                  <div className="live-stadium-lights" />

                  <div className="live-stadium-stands" />

                  <div className="live-stadium-pitch" />

                </div>


                <div className="live-phone-live-badge">

                  <span />

                  LIVE

                </div>


                <div className="live-phone-player-bar">

                  <span />

                </div>

              </div>

            </div>

          </div>


          {/* ===============================================
              COPY
              =============================================== */}

          <div className="live-rotate-copy">

            <p className="live-rotate-kicker">

              GTV LIVE

            </p>


            <h2>

              Une expérience

              <br />

              <span className="live-rotate-accent">

                pensée

              </span>

              {" pour le "}

              <span>

                direct

              </span>

            </h2>


            <p className="live-rotate-description">

              Pour vous offrir une immersion
              optimale, GTV Live adopte
              automatiquement le format le mieux
              adapté à votre écran.

            </p>

          </div>


          {/* ===============================================
              AUTO ORIENTATION STATUS
              =============================================== */}

          <div
            className="live-auto-orientation"
            aria-hidden="true"
          >

            <span className="live-auto-orientation-dot" />

            <span>

              Optimisation de
              l&apos;affichage

            </span>

          </div>


          {/* ===============================================
              PREMIUM WAVES
              =============================================== */}

          <div
            className="live-rotate-wave"
            aria-hidden="true"
          >

            <span />

            <span />

            <span />

            <span />

          </div>

        </div>

      </div>

    </div>

  );

}