"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

/* =========================================================
   TYPES
========================================================= */

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

/* =========================================================
   NAV
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

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
    .replace(/[_\-.]+/g, " ");

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
  const ext =
    item.ext || "mp4";

  const resume =
    Math.max(
      0,
      Math.floor(
        item.position || 0
      )
    );

  if (item.type === "series") {
    return (
      `/watch?type=series` +
      `&id=${item.id}` +
      `&ext=${encodeURIComponent(ext)}` +
      `&title=${encodeURIComponent(item.title)}` +
      `${
        item.seriesId
          ? `&series=${item.seriesId}`
          : ""
      }` +
      `${
        resume > 15
          ? `&resume=${resume}`
          : ""
      }`
    );
  }

  return (
    `/watch?type=movie` +
    `&id=${item.id}` +
    `&ext=${encodeURIComponent(ext)}` +
    `&title=${encodeURIComponent(item.title)}` +
    `${
      resume > 15
        ? `&resume=${resume}`
        : ""
    }`
  );
}

function remainingText(item: ContinueItem | null) {
  if (
    !item?.duration ||
    item.duration <= 0
  ) {
    return "";
  }

  const remaining =
    Math.max(
      0,
      Number(item.duration) -
        Number(item.position || 0)
    );

  const minutes =
    Math.ceil(remaining / 60);

  if (minutes <= 0) {
    return "";
  }

  if (minutes < 60) {
    return `${minutes} min restantes`;
  }

  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  if (mins === 0) {
    return `${hours} h restante${
      hours > 1 ? "s" : ""
    }`;
  }

  return `${hours} h ${mins} min`;
}

/* =========================================================
   NAVIGATION
========================================================= */

export function Navigation() {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    account,
    setAccount,
  ] =
    useState<AccountData | null>(
      null
    );

  const [
    accountLoading,
    setAccountLoading,
  ] =
    useState(true);

  const [
    continueItem,
    setContinueItem,
  ] =
    useState<ContinueItem | null>(
      null
    );

  /* =======================================================
     ACCOUNT
  ======================================================= */

  useEffect(() => {
    if (
      pathname === "/login"
    ) {
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
        if (
          mounted &&
          json?.ok
        ) {
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
          setAccountLoading(
            false
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [pathname]);

  /* =======================================================
     CONTINUE
  ======================================================= */

  useEffect(() => {
    if (
      pathname === "/login"
    ) {
      return;
    }

    const readContinue =
      () => {
        try {
          const raw =
            localStorage.getItem(
              "gtv_last_played"
            );

          if (!raw) {
            setContinueItem(null);
            return;
          }

          const parsed =
            JSON.parse(
              raw
            ) as ContinueItem;

          if (
            !parsed?.id ||
            !parsed?.title
          ) {
            setContinueItem(null);
            return;
          }

          setContinueItem(
            parsed
          );
        } catch {
          setContinueItem(
            null
          );
        }
      };

    readContinue();

    window.addEventListener(
      "storage",
      readContinue
    );

    window.addEventListener(
      "gtv-continue-updated",
      readContinue as EventListener
    );

    return () => {
      window.removeEventListener(
        "storage",
        readContinue
      );

      window.removeEventListener(
        "gtv-continue-updated",
        readContinue as EventListener
      );
    };
  }, [pathname]);

  if (
    pathname === "/login"
  ) {
    return null;
  }

  /* =======================================================
     ACTIVE
  ======================================================= */

  const isItemActive = (
    href: string
  ) => {
    if (
      href === "/"
    ) {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    () => {
      localStorage.removeItem(
        "gtv_xtream_credentials"
      );

      router.push(
        "/login"
      );
    };

  const username =
    account?.username ||
    "Utilisateur";

  const initials =
    getInitials(
      username
    );

  const expiration =
    formatExpiration(
      account?.expDate
    );

  const accountActive =
    String(
      account?.status || ""
    ).toLowerCase() ===
    "active";

  const percent =
    getContinuePercent(
      continueItem
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* ===================================================
          DESKTOP
      =================================================== */}

      <nav
        className="
          group

          relative
          z-50

          hidden
          md:flex

          h-full

          w-[72px]
          hover:w-[252px]

          shrink-0
          flex-col

          overflow-hidden

          border-r
          border-white/[0.055]

          bg-[#070709]/88
          backdrop-blur-[34px]

          shadow-[
            inset_-1px_0_0_rgba(255,255,255,.025),
            18px_0_60px_rgba(0,0,0,.22)
          ]

          transition-[width]
          duration-500
          ease-[cubic-bezier(.16,1,.3,1)]

          select-none
        "
      >
        {/* AMBIENT GLOW */}

        <div
          className="
            pointer-events-none
            absolute
            -left-20
            top-0

            h-72
            w-72

            rounded-full

            bg-[#d8ccff]/[0.045]
            blur-3xl
          "
        />

        {/* =================================================
            BRAND
        ================================================= */}

        <Link
          href="/"
          className="
            relative
            z-10

            flex
            h-[76px]

            shrink-0
            items-center

            border-b
            border-white/[0.05]

            px-[17px]
          "
        >
          <div
            className="
              relative

              grid
              h-[38px]
              w-[38px]

              shrink-0
              place-items-center

              overflow-hidden

              rounded-[13px]

              border
              border-[#d8ccff]/25

              bg-gradient-to-br
              from-[#d8ccff]/20
              to-white/[0.035]

              text-[16px]
              font-semibold

              text-[#eee9ff]

              shadow-[
                inset_0_1px_0_rgba(255,255,255,.22),
                0_10px_30px_rgba(0,0,0,.32),
                0_0_28px_rgba(216,204,255,.07)
              ]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-0

                h-1/2

                bg-gradient-to-b
                from-white/[0.18]
                to-transparent
              "
            />

            <span
              className="
                relative
                z-10
                font-serif
                tracking-[-0.08em]
              "
            >
              G
            </span>
          </div>

          <div
            className="
              ml-3

              min-w-[160px]

              opacity-0

              transition-all
              duration-300

              group-hover:opacity-100
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <span
                className="
                  font-serif
                  text-[17px]
                  tracking-[0.24em]
                  text-white
                "
              >
                GTV
              </span>

              <span
                className="
                  text-[7px]
                  font-semibold
                  tracking-[0.14em]
                  text-[#d8ccff]/65
                "
              >
                3.0
              </span>
            </div>

            <p
              className="
                mt-[2px]

                text-[7px]
                uppercase
                tracking-[0.24em]

                text-white/23
              "
            >
              Vision cinématique
            </p>
          </div>
        </Link>

        {/* =================================================
            NAV ITEMS
        ================================================= */}

        <div
          className="
            relative
            z-10

            space-y-1

            px-3
            py-4
          "
        >
          {desktopNavItems.map(
            (item) => {
              const active =
                isItemActive(
                  item.href
                );

              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.name
                  }
                  href={
                    item.href
                  }
                  className={`
                    relative

                    flex
                    h-[46px]

                    items-center

                    overflow-hidden

                    rounded-[15px]

                    border

                    transition-all
                    duration-300

                    ${
                      active
                        ? `
                          border-[#d8ccff]/18
                          bg-[#d8ccff]/[0.07]
                          text-white

                          shadow-[
                            inset_0_1px_0_rgba(255,255,255,.08),
                            0_10px_30px_rgba(216,204,255,.035)
                          ]
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
                      <div
                        className="
                          pointer-events-none
                          absolute
                          inset-x-0
                          top-0

                          h-1/2

                          bg-gradient-to-b
                          from-white/[0.07]
                          to-transparent
                        "
                      />

                      <div
                        className="
                          absolute
                          left-0
                          top-1/2

                          h-5
                          w-[2px]

                          -translate-y-1/2

                          rounded-r-full

                          bg-[#d8ccff]

                          shadow-[0_0_12px_rgba(216,204,255,.85)]
                        "
                      />
                    </>
                  )}

                  <div
                    className="
                      relative
                      z-10

                      grid
                      h-[44px]
                      w-[44px]

                      shrink-0
                      place-items-center
                    "
                  >
                    <Icon
                      className={`
                        h-[18px]
                        w-[18px]

                        ${
                          active
                            ? `
                              text-[#ece7ff]
                              drop-shadow-[0_0_10px_rgba(216,204,255,.35)]
                            `
                            : ""
                        }
                      `}
                    />
                  </div>

                  <span
                    className="
                      relative
                      z-10

                      ml-1

                      min-w-[145px]

                      whitespace-nowrap

                      text-[11px]
                      font-semibold

                      opacity-0

                      transition-opacity
                      duration-300

                      group-hover:opacity-100
                    "
                  >
                    {item.name}
                  </span>
                </Link>
              );
            }
          )}
        </div>

        {/* =================================================
            CONTINUE
        ================================================= */}

        {continueItem && (
          <div
            className="
              relative
              z-10

              mx-3
              mb-4

              hidden

              opacity-0

              transition-all
              duration-300

              group-hover:block
              group-hover:opacity-100
            "
          >
            <div
              className="
                mb-2
                flex
                items-center
                justify-between
              "
            >
              <p
                className="
                  text-[8px]
                  font-semibold
                  uppercase
                  tracking-[0.22em]
                  text-white/27
                "
              >
                Continuer
              </p>

              <ChevronRight
                className="
                  h-3
                  w-3
                  text-white/20
                "
              />
            </div>

            <Link
              href={
                buildResumeHref(
                  continueItem
                )
              }
              className="
                group/continue

                relative
                block

                aspect-[16/10]

                overflow-hidden

                rounded-[18px]

                border
                border-white/[0.085]

                bg-[#101014]

                shadow-[0_14px_35px_rgba(0,0,0,.28)]

                transition
                duration-300

                hover:border-white/[0.17]
                hover:-translate-y-[1px]
              "
            >
              {continueItem.image ? (
                <img
                  src={
                    continueItem.image
                  }
                  alt={
                    continueItem.title
                  }
                  className="
                    absolute
                    inset-0

                    h-full
                    w-full

                    object-cover

                    transition-transform
                    duration-700

                    group-hover/continue:scale-[1.04]
                  "
                />
              ) : (
                <div
                  className="
                    absolute
                    inset-0

                    grid
                    place-items-center

                    bg-gradient-to-br
                    from-[#17171d]
                    to-[#08080a]
                  "
                >
                  {continueItem.type ===
                  "series" ? (
                    <MonitorPlay
                      className="
                        h-7
                        w-7
                        text-white/15
                      "
                    />
                  ) : (
                    <Film
                      className="
                        h-7
                        w-7
                        text-white/15
                      "
                    />
                  )}
                </div>
              )}

              <div
                className="
                  absolute
                  inset-0

                  bg-gradient-to-t
                  from-black/95
                  via-black/20
                  to-black/5
                "
              />

              <div
                className="
                  absolute
                  inset-x-0
                  top-0

                  h-1/2

                  bg-gradient-to-b
                  from-white/[0.07]
                  to-transparent
                "
              />

              <div
                className="
                  absolute
                  right-3
                  top-3

                  grid
                  h-8
                  w-8

                  place-items-center

                  rounded-full

                  border
                  border-white/20

                  bg-black/30

                  text-white

                  backdrop-blur-xl

                  opacity-0

                  transition-all
                  duration-300

                  group-hover/continue:opacity-100
                "
              >
                <Play
                  className="
                    h-3.5
                    w-3.5
                    fill-current
                  "
                />
              </div>

              <div
                className="
                  absolute
                  inset-x-0
                  bottom-0

                  p-3
                "
              >
                <p
                  className="
                    truncate

                    text-[11px]
                    font-semibold

                    text-white/90
                  "
                >
                  {
                    continueItem.title
                  }
                </p>

                <div
                  className="
                    mt-1

                    flex
                    items-center
                    gap-1.5

                    text-[8px]

                    text-white/40
                  "
                >
                  {continueItem.type ===
                    "series" &&
                    continueItem.season !=
                      null && (
                      <span>
                        S
                        {String(
                          continueItem.season
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>
                    )}

                  {continueItem.type ===
                    "series" &&
                    continueItem.episode !=
                      null && (
                      <>
                        <span>
                          ·
                        </span>

                        <span>
                          E
                          {String(
                            continueItem.episode
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>
                      </>
                    )}

                  {remainingText(
                    continueItem
                  ) && (
                    <>
                      <span>·</span>

                      <span>
                        {remainingText(
                          continueItem
                        )}
                      </span>
                    </>
                  )}
                </div>

                {percent > 0 && (
                  <div
                    className="
                      mt-2.5

                      h-[3px]

                      overflow-hidden

                      rounded-full

                      bg-white/15
                    "
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                      }}
                      className="
                        h-full

                        rounded-full

                        bg-gradient-to-r
                        from-[#a991ff]
                        to-[#eeeaff]

                        shadow-[0_0_9px_rgba(216,204,255,.65)]
                      "
                    />
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* PUSH ACCOUNT DOWN */}

        <div className="flex-1" />

        {/* =================================================
            ACCOUNT
        ================================================= */}

        <div
          className="
            relative
            z-10

            border-t
            border-white/[0.055]

            p-2.5
          "
        >
          <div
            className="
              relative

              flex
              min-h-[58px]

              items-center

              overflow-hidden

              rounded-[17px]

              border
              border-white/[0.075]

              bg-white/[0.027]

              backdrop-blur-2xl

              shadow-[inset_0_1px_0_rgba(255,255,255,.07)]

              transition

              group-hover:bg-white/[0.04]
            "
          >
            {/* AVATAR */}

            <div
              className="
                relative
                z-10

                ml-[7px]

                grid
                h-[38px]
                w-[38px]

                shrink-0
                place-items-center

                overflow-hidden

                rounded-[13px]

                border
                border-[#d8ccff]/18

                bg-gradient-to-br
                from-[#d8ccff]/14
                to-white/[0.035]

                text-[10px]
                font-bold

                text-[#eee9ff]

                shadow-[inset_0_1px_0_rgba(255,255,255,.15)]
              "
            >
              {accountLoading ? (
                <User
                  className="
                    h-4
                    w-4
                    text-white/30
                  "
                />
              ) : (
                initials
              )}

              {!accountLoading && (
                <span
                  className={`
                    absolute
                    bottom-[2px]
                    right-[2px]

                    h-2
                    w-2

                    rounded-full

                    border
                    border-[#101015]

                    ${
                      accountActive
                        ? `
                          bg-emerald-400
                          shadow-[0_0_8px_rgba(52,211,153,.7)]
                        `
                        : `
                          bg-white/25
                        `
                    }
                  `}
                />
              )}
            </div>

            {/* USER INFO */}

            <div
              className="
                ml-3

                min-w-0
                flex-1

                opacity-0

                transition-opacity
                duration-300

                group-hover:opacity-100
              "
            >
              {accountLoading ? (
                <div className="space-y-1.5">
                  <div className="h-2.5 w-20 rounded-full bg-white/[0.07]" />
                  <div className="h-2 w-24 rounded-full bg-white/[0.04]" />
                </div>
              ) : (
                <>
                  <div
                    className="
                      flex
                      items-center
                      gap-1.5
                    "
                  >
                    <p
                      className="
                        max-w-[105px]

                        truncate

                        text-[10px]
                        font-semibold

                        text-white/80
                      "
                    >
                      {username}
                    </p>

                    {accountActive && (
                      <span
                        className="
                          text-[7px]

                          uppercase
                          tracking-[0.12em]

                          text-emerald-300/55
                        "
                      >
                        actif
                      </span>
                    )}
                  </div>

                  <p
                    className="
                      mt-1

                      whitespace-nowrap

                      text-[8px]

                      text-white/28
                    "
                  >
                    Expire ·{" "}

                    <span className="text-white/42">
                      {
                        expiration
                      }
                    </span>
                  </p>

                  {account?.maxConnections !=
                    null && (
                    <p
                      className="
                        mt-0.5

                        text-[7px]

                        text-white/20
                      "
                    >
                      Connexions{" "}
                      {
                        account.activeConnections ??
                        0
                      }
                      /
                      {
                        account.maxConnections
                      }
                    </p>
                  )}
                </>
              )}
            </div>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={
                handleLogout
              }
              title="Déconnexion"
              aria-label="Déconnexion"
              className="
                relative
                z-20

                mr-2

                grid
                h-8
                w-8

                shrink-0
                place-items-center

                rounded-full

                border
                border-transparent

                text-white/24

                opacity-0

                transition-all
                duration-300

                group-hover:opacity-100

                hover:border-rose-300/10
                hover:bg-rose-400/[0.06]
                hover:text-rose-300
              "
            >
              <LogOut
                className="
                  h-[15px]
                  w-[15px]
                "
              />
            </button>
          </div>
        </div>
      </nav>

      {/* ===================================================
          MOBILE
      =================================================== */}

      <nav
        className="
          relative
          z-50
          
          flex
          w-full
          min-h-[68px]
          shrink-0
          
          items-center
          justify-around
          
          border-t
          border-white/[0.11]
          
          bg-[#09090c]/90
          backdrop-blur-[32px]
          
          pb-[env(safe-area-inset-bottom)]
          
          md:hidden
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            top-0

            h-[46%]

            bg-gradient-to-b
            from-white/[0.08]
            to-transparent
          "
        />

        <div
          className="
            relative
            z-10

            flex
            w-full
            h-[68px]

            items-center
            justify-around
          "
        >
          {mobileNavItems.map(
            (item) => {
              const active =
                isItemActive(
                  item.href
                );

              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.name
                  }
                  href={
                    item.href
                  }
                  className={`
                    relative

                    flex
                    h-[52px]
                    min-w-[52px]

                    flex-col

                    items-center
                    justify-center

                    rounded-[16px]

                    border

                    transition-all
                    duration-300

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
                      h-[18px]
                      w-[18px]

                      ${
                        active
                          ? `
                            text-[#e7e0ff]
                            drop-shadow-[0_0_10px_rgba(216,204,255,.35)]
                          `
                          : ""
                      }
                    `}
                  />

                  <span
                    className="
                      mt-1

                      text-[7.5px]
                      font-semibold
                    "
                  >
                    {item.name}
                  </span>

                  {active && (
                    <span
                      className="
                        absolute
                        bottom-[3px]

                        h-1
                        w-1

                        rounded-full

                        bg-[#d8ccff]

                        shadow-[0_0_9px_rgba(216,204,255,.85)]
                      "
                    />
                  )}
                </Link>
              );
            }
          )}
        </div>
      </nav>
    </>
  );
}