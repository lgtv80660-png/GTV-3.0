"use client";

import {
  CalendarDays,
  Loader2,
  Radio,
  Trophy,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type SportEvent = {
  id: string;

  name: string;

  sport: string;

  league: string;

  date: string;

  time: string;

  timestamp:
    | string
    | null;

  homeTeam:
    string;

  awayTeam:
    string;

  homeBadge:
    | string
    | null;

  awayBadge:
    | string
    | null;

  homeScore:
    | string
    | number
    | null;

  awayScore:
    | string
    | number
    | null;

  status:
    | string
    | null;
};

type ApiResponse = {
  success: boolean;

  date: string;

  count: number;

  events: SportEvent[];
};

interface SportTodayPanelProps {
  channelName:
    | string
    | null
    | undefined;
}

/* =========================================================
   DETECT SPORT CHANNEL
========================================================= */

function isSportChannel(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return false;
  }

  const name =
    value.toLowerCase();

  return (
    name.includes(
      "sport"
    ) ||
    name.includes(
      "bein"
    ) ||
    name.includes(
      "dazn"
    ) ||
    name.includes(
      "espn"
    ) ||
    name.includes(
      "eurosport"
    ) ||
    name.includes(
      "canal+ sport"
    ) ||
    name.includes(
      "canal sport"
    ) ||
    name.includes(
      "sky sports"
    ) ||
    name.includes(
      "nba"
    ) ||
    name.includes(
      "nfl"
    ) ||
    name.includes(
      "f1"
    )
  );
}

/* =========================================================
   LOCAL DATE
========================================================= */

function getTodayLocal() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

/* =========================================================
   TIME
========================================================= */

function formatTime(
  event: SportEvent
) {
  if (
    event.timestamp
  ) {
    const date =
      new Date(
        event.timestamp
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return new Intl.DateTimeFormat(
        "fr-FR",
        {
          hour:
            "2-digit",

          minute:
            "2-digit",
        }
      ).format(
        date
      );
    }
  }

  if (
    event.time
  ) {
    return event.time.slice(
      0,
      5
    );
  }

  return "--:--";
}

/* =========================================================
   COMPONENT
========================================================= */

export function SportTodayPanel({
  channelName,
}: SportTodayPanelProps) {
  const sportChannel =
    useMemo(
      () =>
        isSportChannel(
          channelName
        ),
      [
        channelName,
      ]
    );

  const [
    events,
    setEvents,
  ] = useState<
    SportEvent[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(false);

  useEffect(() => {
    if (
      !sportChannel
    ) {
      setEvents(
        []
      );

      return;
    }

    const controller =
      new AbortController();

    const load =
      async () => {
        setLoading(
          true
        );

        setError(
          false
        );

        try {
          const today =
            getTodayLocal();

          const response =
            await fetch(
              `/api/sports/today?date=${today}`,
              {
                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              "Sports API"
            );
          }

          const data =
            (await response.json()) as ApiResponse;

          if (
            !data.success
          ) {
            throw new Error(
              "Sports API"
            );
          }

          setEvents(
            Array.isArray(
              data.events
            )
              ? data.events
              : []
          );
        } catch (
          err
        ) {
          if (
            (
              err as Error
            ).name !==
            "AbortError"
          ) {
            setError(
              true
            );
          }
        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(
              false
            );
          }
        }
      };

    load();

    return () => {
      controller.abort();
    };
  }, [
    sportChannel,
  ]);

  /*
   * Chaîne normale :
   * aucun panneau.
   */
  if (
    !sportChannel
  ) {
    return null;
  }

  return (
    <section
      className="
        relative

        overflow-hidden

        rounded-[22px]

        border
        border-white/[0.065]

        bg-[#0c0c10]/70

        backdrop-blur-[30px]

        shadow-[inset_0_1px_0_rgba(255,255,255,.035),0_30px_80px_rgba(0,0,0,.22)]
      "
    >
      {/* glow */}

      <div
        className="
          pointer-events-none

          absolute
          -right-16
          -top-20

          h-40
          w-40

          rounded-full

          bg-[#d8ccff]/[0.055]

          blur-[60px]
        "
      />

      {/* HEADER */}

      <div
        className="
          relative

          flex

          items-center
          justify-between

          border-b
          border-white/[0.055]

          px-4
          py-3
        "
      >
        <div
          className="
            flex

            items-center

            gap-3
          "
        >
          <div
            className="
              grid
              h-8
              w-8

              place-items-center

              rounded-[10px]

              border
              border-[#d8ccff]/10

              bg-[#d8ccff]/[0.045]
            "
          >
            <Trophy
              className="
                h-3.5
                w-3.5

                text-[#d8ccff]/70
              "
            />
          </div>

          <div>
            <p
              className="
                text-[10px]
                font-semibold

                text-white/85
              "
            >
              Sport aujourd’hui
            </p>

            <div
              className="
                mt-[2px]

                flex

                items-center

                gap-1.5

                text-[7px]

                uppercase
                tracking-[0.14em]

                text-white/22
              "
            >
              <CalendarDays
                className="
                  h-2.5
                  w-2.5
                "
              />

              Matchs du jour
            </div>
          </div>
        </div>

        <div
          className="
            flex

            items-center

            gap-1.5

            rounded-full

            border
            border-white/[0.06]

            bg-white/[0.025]

            px-2
            py-1

            text-[7px]

            text-white/30
          "
        >
          <Radio
            className="
              h-2.5
              w-2.5
            "
          />

          Live
        </div>
      </div>

      {/* CONTENT */}

      <div
        className="
          relative

          p-2
        "
      >
        {loading ? (
          <div
            className="
              flex
              h-28

              items-center
              justify-center

              gap-2

              text-white/25
            "
          >
            <Loader2
              className="
                h-4
                w-4

                animate-spin
              "
            />

            <span
              className="
                text-[9px]
              "
            >
              Chargement des matchs
            </span>
          </div>
        ) : error ? (
          <div
            className="
              flex
              h-24

              items-center
              justify-center

              text-center

              text-[9px]

              text-white/25
            "
          >
            Programme sportif indisponible.
          </div>
        ) : events.length ===
          0 ? (
          <div
            className="
              flex
              h-24

              items-center
              justify-center

              text-[9px]

              text-white/25
            "
          >
            Aucun événement trouvé aujourd’hui.
          </div>
        ) : (
          <div
            className="
              space-y-1
            "
          >
            {events.map(
              (
                event
              ) => (
                <div
                  key={
                    event.id
                  }
                  className="
                    flex

                    min-h-[62px]

                    items-center

                    gap-3

                    rounded-[14px]

                    border
                    border-transparent

                    px-3
                    py-2

                    transition

                    hover:border-white/[0.055]
                    hover:bg-white/[0.025]
                  "
                >
                  {/* TIME */}

                  <div
                    className="
                      w-[42px]

                      shrink-0

                      text-center
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-semibold

                        text-[#ddd3ff]
                      "
                    >
                      {formatTime(
                        event
                      )}
                    </p>
                  </div>

                  {/* GAME */}

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <p
                      className="
                        truncate

                        text-[9px]
                        font-semibold

                        text-white/78
                      "
                    >
                      {
                        event.name
                      }
                    </p>

                    <div
                      className="
                        mt-1

                        flex

                        items-center

                        gap-2

                        overflow-hidden
                      "
                    >
                      {event.league && (
                        <span
                          className="
                            truncate

                            text-[7px]

                            text-white/25
                          "
                        >
                          {
                            event.league
                          }
                        </span>
                      )}

                      {event.sport && (
                        <>
                          <span
                            className="
                              text-white/10
                            "
                          >
                            •
                          </span>

                          <span
                            className="
                              shrink-0

                              text-[7px]

                              text-white/18
                            "
                          >
                            {
                              event.sport
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="
                      h-1.5
                      w-1.5

                      shrink-0

                      rounded-full

                      bg-[#d8ccff]/40
                    "
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default SportTodayPanel;