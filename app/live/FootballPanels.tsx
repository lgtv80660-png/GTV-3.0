"use client";

import {
  memo,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  Loader2,
  Play,
  Radio,
  Shield,
  Trophy,
} from "lucide-react";
import type {
  Channel,
  FootballFixture,
  FootballTeam,
} from "./live-types";
import { formatTime } from "./live-utils";
import { fixtureCompetitionLogo } from "./competition-logos";
import type {
  CompetitionFilter,
  CompetitionItem,
} from "./LiveSports";

type Props = {
  fixtures: FootballFixture[];
  filteredFixtures: FootballFixture[];
  fixturesLoading: boolean;
  fixturesError: string | null;
  selectedFixtureId: string | null;
  competitionItems: CompetitionItem[];
  competitionFilter: CompetitionFilter;
  timeZone: string;
  guideLoading: boolean;
  guideError: string | null;
  guideLength: number;
  fixtureBroadcasts: Record<
    string,
    Array<{
      programme: { title: string };
      channels: Channel[];
    }>
  >;
  matchRef: RefObject<HTMLDivElement | null>;
  onCompetitionFilter: (id: CompetitionFilter) => void;
  onSelectFixture: (id: string) => void;
  onLaunchChannel: (channel: Channel) => void;
};

const TeamLogo = memo(function TeamLogo({
  team,
}: {
  team: FootballTeam;
}) {
  return (
    <span className="live-team-logo">
      {team.logo ? (
        <img
          src={`/api/football/logo?url=${encodeURIComponent(team.logo)}`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <Shield size={14} />
      )}
    </span>
  );
});

function CompetitionLogo({
  item,
}: {
  item: CompetitionItem;
}) {
  if (item.logo) {
    return (
      <img
        src={item.logo}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }

  return <Trophy size={20} aria-hidden="true" />;
}

function useHorizontalRail() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({
    pressed: false,
    dragging: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const onPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.pointerType !== "mouse") return;

    state.current.pressed = true;
    state.current.dragging = false;
    state.current.moved = false;
    state.current.startX = event.clientX;
    state.current.startScrollLeft =
      ref.current?.scrollLeft ?? 0;
  };

  const onPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const el = ref.current;

    if (!el || !state.current.pressed) return;

    const delta =
      event.clientX - state.current.startX;

    if (
      !state.current.dragging &&
      Math.abs(delta) >= 7
    ) {
      state.current.dragging = true;
      state.current.moved = true;
      el.classList.add("is-dragging");

      try {
        el.setPointerCapture(event.pointerId);
      } catch {}
    }

    if (!state.current.dragging) return;

    event.preventDefault();
    el.scrollLeft =
      state.current.startScrollLeft - delta;
  };

  const finish = (
    event?: ReactPointerEvent<HTMLDivElement>
  ) => {
    const el = ref.current;

    state.current.pressed = false;
    state.current.dragging = false;

    if (el) {
      el.classList.remove("is-dragging");

      if (
        event &&
        el.hasPointerCapture?.(event.pointerId)
      ) {
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {}
      }
    }

    window.setTimeout(() => {
      state.current.moved = false;
    }, 0);
  };

  const onClickCapture = (
    event: ReactMouseEvent<HTMLDivElement>
  ) => {
    if (!state.current.moved) return;

    event.preventDefault();
    event.stopPropagation();
  };

  return {
    ref,
    props: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onPointerLeave: (
        event: ReactPointerEvent<HTMLDivElement>
      ) => {
        if (state.current.dragging) {
          finish(event);
        }
      },
      onClickCapture,
    },
  };
}

function statusLabel(
  fixture: FootballFixture,
  timeZone: string
) {
  if (fixture.status.live) {
    return fixture.status.short ||
      fixture.status.long ||
      "EN DIRECT";
  }

  if (fixture.status.finished) {
    return "TERMINÉ";
  }

  return formatTime(
    fixture.startingAt,
    timeZone
  );
}

export default memo(function FootballPanels({
  fixtures,
  filteredFixtures,
  fixturesLoading,
  fixturesError,
  selectedFixtureId,
  competitionItems,
  competitionFilter,
  timeZone,
  guideLoading,
  guideError,
  guideLength,
  fixtureBroadcasts,
  matchRef,
  onCompetitionFilter,
  onSelectFixture,
  onLaunchChannel,
}: Props) {
  const rail = useHorizontalRail();

  useEffect(() => {
    const active =
      rail.ref.current?.querySelector<HTMLElement>(
        ".live-competition-item.is-active"
      );

    active?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [competitionFilter]);

  return (
    <section className="live-sport-body">
      <div
        ref={rail.ref}
        {...rail.props}
        className="live-competition-rail"
        aria-label="Compétitions"
      >
        {competitionItems.map((item) => {
          const active =
            competitionFilter === item.id;
          const empty =
            item.id !== "all" &&
            item.count === 0;

          return (
            <button
              key={item.id}
              type="button"
              title={item.name}
              aria-label={`${item.name} — ${item.count} match${item.count > 1 ? "s" : ""}`}
              aria-pressed={active}
              className={[
                "live-competition-item",
                active ? "is-active" : "",
                empty ? "is-empty" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                onCompetitionFilter(item.id)
              }
            >
              <span className="live-competition-logo">
                <CompetitionLogo item={item} />
              </span>

              <small>{item.count}</small>
            </button>
          );
        })}
      </div>

      <div className="live-guide-mini">
        {guideLoading ? (
          <>
            <Loader2
              size={11}
              className="live-spin"
            />
            <span>
              Recherche des diffusions…
            </span>
          </>
        ) : guideError ? (
          <>
            <Radio size={11} />
            <span>
              Guide beIN indisponible
            </span>
          </>
        ) : guideLength ? (
          <>
            <Radio size={11} />
            <span>
              {guideLength} programmes beIN
            </span>
          </>
        ) : (
          <>
            <Radio size={11} />
            <span>Aucun programme beIN</span>
          </>
        )}
      </div>

      <div
        ref={matchRef}
        className="live-match-list-compact"
        tabIndex={-1}
        aria-label="Liste des matchs"
      >
        {fixturesLoading ? (
          <div
            className="live-sport-state"
            role="status"
          >
            <Loader2 className="live-spin" />
          </div>
        ) : fixturesError ? (
          <div
            className="live-sport-state is-error"
            role="status"
          >
            {fixturesError}
          </div>
        ) : filteredFixtures.length === 0 ? (
          <div className="live-sport-state live-no-match-today">
            Aucun match pour aujourd&apos;hui
          </div>
        ) : (
          filteredFixtures.map((fixture) => {
            const competitionLogo = fixtureCompetitionLogo(fixture);
            const broadcasts =
              fixtureBroadcasts[fixture.id] ?? [];

            const uniqueChannels =
              Array.from(
                new Map(
                  broadcasts
                    .flatMap(
                      (entry) => entry.channels
                    )
                    .map((channel) => [
                      channel.stream_id,
                      channel,
                    ])
                ).values()
              );

            const programmeTitle =
              broadcasts.find(
                (entry) =>
                  entry.programme.title
              )?.programme.title ?? "";

            const selected =
              fixture.id ===
              selectedFixtureId;

            const showScore =
              fixture.status.live ||
              fixture.status.finished;

            return (
              <article
                key={fixture.id}
                className={[
                  "live-match-card-compact",
                  selected ? "is-active" : "",
                  fixture.status.live
                    ? "is-live"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="live-match-select-compact"
                  aria-pressed={selected}
                  onClick={() =>
                    onSelectFixture(
                      fixture.id
                    )
                  }
                >
                  <span className="live-match-card-top">
                    <span className="live-match-league">
                      {competitionLogo && (
                        <img
                          src={competitionLogo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      )}

                      <span>
                        {fixture.league.name}
                      </span>
                    </span>

                    <span
                      className={[
                        "live-match-status-pill",
                        fixture.status.live
                          ? "is-live"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {fixture.status.live && (
                        <i />
                      )}

                      {statusLabel(
                        fixture,
                        timeZone
                      )}
                    </span>
                  </span>

                  <span className="live-score-compact">
                    <span className="live-score-team">
                      <span className="live-score-team-name">
                        <TeamLogo
                          team={fixture.home}
                        />
                        <strong>
                          {fixture.home.name}
                        </strong>
                      </span>

                      <b>
                        {showScore
                          ? fixture.score.home ??
                            "–"
                          : "–"}
                      </b>
                    </span>

                    <span className="live-score-team">
                      <span className="live-score-team-name">
                        <TeamLogo
                          team={fixture.away}
                        />
                        <strong>
                          {fixture.away.name}
                        </strong>
                      </span>

                      <b>
                        {showScore
                          ? fixture.score.away ??
                            "–"
                          : "–"}
                      </b>
                    </span>
                  </span>
                </button>
                {uniqueChannels.length > 0 && (
                  <div className="live-broadcasts live-broadcasts-compact">
                    <div className="live-broadcast-channel-list">
                      {uniqueChannels.map((channel) => (
                        <button key={channel.stream_id} type="button" className="live-broadcast-channel" onClick={() => onLaunchChannel(channel)}>
                          <span>{channel.name}</span><Play size={11} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
});
