"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import FootballPanels from "./FootballPanels";

import { readAllCachedChannels } from "@/lib/live-cache";

import {
  findXtreamChannelsForProgramme,
  programmeMatchScore,
  type BeinProgramme,
} from "@/lib/bein-guide";

import type {
  Category,
  Channel,
  FootballFixture,
  TodayResponse,
  BeinGuideResponse,
  FixtureBroadcast,
} from "./live-types";

import { getToday, readJson } from "./live-utils";
import { attachVerticalDrag } from "./live-drag";
import { COMPETITION_LOGOS } from "./competition-logos";

/* =========================================================
   CONFIG
   ========================================================= */

const GUIDE_DELAY_MS = 250;

const LIVE_REFRESH_MS = 30_000;
const IDLE_REFRESH_MS = 300_000;
const ERROR_RETRY_MS = 30_000;

/* =========================================================
   TYPES
   ========================================================= */

export type CompetitionFilter =
  | "all"
  | "eng.1"
  | "esp.1"
  | "fra.1"
  | "ger.1"
  | "ita.1"
  | "uefa.champions"
  | "uefa.europa"
  | "uefa.europa.conf"
  | "uefa.nations"
  | "africa";

export type CompetitionItem = {
  id: CompetitionFilter;
  name: string;
  logo: string | null;
  count: number;
};

export type CurrentFootballMatch = {
  fixture: FootballFixture;
  programmeTitle: string | null;
};

/* =========================================================
   COMPETITIONS
   ========================================================= */

const EUROPE_COMPETITIONS: Array<{
  id: Exclude<CompetitionFilter, "all" | "africa">;
  name: string;
}> = [
  {
    id: "uefa.champions",
    name: "UEFA Champions League",
  },
  {
    id: "uefa.europa",
    name: "UEFA Europa League",
  },
  {
    id: "uefa.europa.conf",
    name: "UEFA Conference League",
  },
  {
    id: "eng.1",
    name: "Premier League",
  },
  {
    id: "esp.1",
    name: "La Liga",
  },
  {
    id: "ita.1",
    name: "Serie A",
  },
  {
    id: "ger.1",
    name: "Bundesliga",
  },
  {
    id: "fra.1",
    name: "Ligue 1",
  },
  {
    id: "uefa.nations",
    name: "UEFA Nations League",
  },
];

/* =========================================================
   HELPERS
   ========================================================= */

function programmeIsActiveNow(programme: BeinProgramme) {
  if (!programme.start || !programme.end) {
    return Boolean(programme.live);
  }

  const now = Date.now();

  const start = new Date(programme.start).getTime();
  const end = new Date(programme.end).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Boolean(programme.live);
  }

  /*
   * Tolérance EPG de 10 minutes.
   */
  const tolerance = 10 * 60 * 1000;

  return now >= start - tolerance && now <= end + tolerance;
}

function fixtureTimeDistance(fixture: FootballFixture) {
  const start = new Date(fixture.startingAt).getTime();

  if (!Number.isFinite(start)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(Date.now() - start);
}

/* =========================================================
   BEIN REGION / HOST RESOLUTION
   ========================================================= */

/**
 * Détermine quelle grille EPG doit être utilisée pour le host.
 *
 * IMPORTANT :
 *
 * On ne mélange plus automatiquement France + MENA.
 *
 * Le même match peut être diffusé :
 *
 * MENA   -> beIN 2
 * France -> beIN 4
 *
 * Le nom de la catégorie / chaîne permet donc de choisir
 * la bonne famille de grille.
 *
 * Les hosts génériques sont considérés MENA par défaut.
 */
function inferBeinHostRegion(
  selectedChannel: Channel | null,
  selectedCategory: Category | null
): "mena" | "france" {
  const text = `${selectedCategory?.category_name || ""} ${
    selectedChannel?.name || ""
  }`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  /* -------------------------------------------------------
     FRANCE
     ------------------------------------------------------- */

  if (
    /\bfrance\b/.test(text) ||
    /\bfrench\b/.test(text) ||
    /\bfrancais\b/.test(text) ||
    /\bbein\s+sports?\s+fr\b/.test(text) ||
    /\bbein\s+fr\b/.test(text)
  ) {
    return "france";
  }

  /* -------------------------------------------------------
     MENA / ARABE
     ------------------------------------------------------- */

  if (
    /\bmena\b/.test(text) ||
    /\barabic\b/.test(text) ||
    /\barabe\b/.test(text) ||
    /\barab\b/.test(text) ||
    /\(a\)/.test(text)
  ) {
    return "mena";
  }

  /*
   * Host générique.
   *
   * Exemples :
   *
   * BeIN Sport 02 (1080)
   * BeIN Sport 02 (720)
   * BeIN Sport 02 (540)
   * BeIN Sport 02 (480)
   * beIN SPORTS 2 HD
   * beIN SPORTS 2 SD
   *
   * Dans ton architecture IPTV actuelle on privilégie
   * la grille MENA.
   */
  return "mena";
}

/**
 * Retourne uniquement la grille pertinente pour le host.
 *
 * Si MENA existe -> uniquement MENA.
 * Si France existe et host FR -> uniquement France.
 *
 * On utilise tout le guide uniquement si la région demandée
 * n'existe réellement pas.
 */
function selectGuideForHost(
  programmes: BeinProgramme[],
  selectedChannel: Channel | null,
  selectedCategory: Category | null
) {
  if (!programmes.length) {
    return [];
  }

  const preferredRegion = inferBeinHostRegion(
    selectedChannel,
    selectedCategory
  );

  const preferred = programmes.filter(
    (programme) => programme.region === preferredRegion
  );

  if (preferred.length) {
    return preferred;
  }

  return programmes;
}

/**
 * Priorité d'un programme EPG.
 */
function programmePriority(programme: BeinProgramme) {
  let score = 0;

  if (programmeIsActiveNow(programme)) {
    score += 1000;
  }

  if (programme.live) {
    score += 250;
  }

  return score;
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function LiveSports({
  channels,
  selectedChannel,
  selectedCategory,
  timeZone,
  onLaunchChannel,
  onCurrentMatchChange,
}: {
  channels: Channel[];
  selectedChannel: Channel | null;
  selectedCategory: Category | null;
  timeZone: string;
  onLaunchChannel: (channel: Channel) => void;
  onCurrentMatchChange?: (
    match: CurrentFootballMatch | null
  ) => void;
}) {
  const router = useRouter();

  const matchRef = useRef<HTMLDivElement>(null);

  /* =======================================================
     FIXTURES
     ======================================================= */

  const [fixtures, setFixtures] = useState<FootballFixture[]>([]);

  const [fixturesLoading, setFixturesLoading] = useState(false);

  const [fixturesError, setFixturesError] = useState<string | null>(
    null
  );

  const [selectedFixtureId, setSelectedFixtureId] = useState<
    string | null
  >(null);

  const [competitionFilter, setCompetitionFilter] =
    useState<CompetitionFilter>("all");

  /* =======================================================
     GUIDE
     ======================================================= */

  const [guide, setGuide] = useState<BeinProgramme[]>([]);

  const [guideLoading, setGuideLoading] = useState(false);

  const [guideError, setGuideError] = useState<string | null>(
    null
  );

  /* =======================================================
     LOAD + AUTO REFRESH SCORES
     ======================================================= */

  useEffect(() => {
    let disposed = false;

    /*
     * IMPORTANT :
     * window.setTimeout retourne un number dans le navigateur.
     * On évite ici le conflit avec NodeJS.Timeout.
     */
    let timer: number | null = null;

    let activeController: AbortController | null = null;

    let firstLoad = true;

    const scheduleNext = (delay: number) => {
      if (disposed) return;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(() => {
        void load();
      }, delay);
    };

    async function load() {
      if (disposed) {
        return;
      }

      /*
       * Annule une éventuelle ancienne requête.
       */
      activeController?.abort();

      const controller = new AbortController();

      activeController = controller;

      /*
       * Loader uniquement au premier chargement.
       *
       * Les refresh suivants ne doivent pas faire
       * clignoter l'interface.
       */
      if (firstLoad) {
        setFixturesLoading(true);
      }

      setFixturesError(null);

      try {
        const date = getToday(timeZone);

        /*
         * no-store + cache-buster :
         * on veut réellement redemander les scores.
         */
        const response = await fetch(
          `/api/football/today?date=${encodeURIComponent(
            date
          )}&timezone=${encodeURIComponent(
            timeZone
          )}&_=${Date.now()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        const data = await readJson<TodayResponse>(response);

        if (disposed || controller.signal.aborted) {
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Football indisponible"
          );
        }

        const list = data.fixtures ?? [];

        /*
         * Mise à jour des fixtures et donc des scores.
         */
        setFixtures(list);

        /*
         * Conserve le match sélectionné s'il existe encore.
         * Sinon sélectionne en priorité un match LIVE.
         */
        setSelectedFixtureId((current) => {
          if (
            current &&
            list.some((item) => item.id === current)
          ) {
            return current;
          }

          return (
            list.find((item) =>
              Boolean(item.status.live)
            )?.id ??
            list[0]?.id ??
            null
          );
        });

        /*
         * Polling intelligent.
         *
         * LIVE     = toutes les 30 secondes
         * PAS LIVE = toutes les 5 minutes
         */
        const hasLiveMatch = list.some((fixture) =>
          Boolean(fixture.status.live)
        );

        scheduleNext(
          hasLiveMatch
            ? LIVE_REFRESH_MS
            : IDLE_REFRESH_MS
        );
      } catch (error) {
        if (disposed || controller.signal.aborted) {
          return;
        }

        /*
         * On conserve les anciennes fixtures.
         * Une erreur réseau temporaire ne doit pas
         * vider le panneau Sport.
         */
        setFixturesError(
          error instanceof Error
            ? error.message
            : "Erreur football"
        );

        scheduleNext(ERROR_RETRY_MS);
      } finally {
        if (!disposed && firstLoad) {
          firstLoad = false;
          setFixturesLoading(false);
        }
      }
    }

    void load();

    return () => {
      disposed = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      activeController?.abort();
    };
  }, [timeZone, router]);

  /* =======================================================
     COMPETITION ITEMS
     ======================================================= */

  const competitionItems = useMemo<CompetitionItem[]>(() => {
    const countByLeague = new Map<string, number>();

    for (const fixture of fixtures) {
      if (fixture.provider !== "espn") {
        continue;
      }

      const leagueId = fixture.league.id || "";

      countByLeague.set(
        leagueId,
        (countByLeague.get(leagueId) ?? 0) + 1
      );
    }

    const europe = EUROPE_COMPETITIONS.map(
      (competition) => ({
        id: competition.id,
        name: competition.name,
        logo: COMPETITION_LOGOS[competition.id],
        count: countByLeague.get(competition.id) ?? 0,
      })
    );

    const africaFixtures = fixtures.filter(
      (fixture) => fixture.provider === "sportsrc"
    );

    return [
      {
        id: "all" as const,
        name: "Tous les matchs",
        logo: null,
        count: fixtures.length,
      },

      ...europe,

      {
        id: "africa" as const,
        name: "Afrique / CAN",
        logo: COMPETITION_LOGOS.africa,
        count: africaFixtures.length,
      },
    ];
  }, [fixtures]);

  /* =======================================================
     FILTERED FIXTURES
     ======================================================= */

  const filteredFixtures = useMemo(() => {
    if (competitionFilter === "all") {
      return fixtures;
    }

    if (competitionFilter === "africa") {
      return fixtures.filter(
        (fixture) => fixture.provider === "sportsrc"
      );
    }

    return fixtures.filter(
      (fixture) =>
        fixture.provider === "espn" &&
        fixture.league.id === competitionFilter
    );
  }, [fixtures, competitionFilter]);

  /* =======================================================
     KEEP SELECTED FIXTURE VALID
     ======================================================= */

  useEffect(() => {
    if (!filteredFixtures.length) {
      setSelectedFixtureId(null);
      return;
    }

    const stillExists = filteredFixtures.some(
      (fixture) => fixture.id === selectedFixtureId
    );

    if (stillExists) {
      return;
    }

    setSelectedFixtureId(
      filteredFixtures.find((fixture) =>
        Boolean(fixture.status.live)
      )?.id ?? filteredFixtures[0].id
    );
  }, [filteredFixtures, selectedFixtureId]);

  const hasFixtures = fixtures.length > 0;

  /* =======================================================
     LOAD BEIN GUIDE
     ======================================================= */

  useEffect(() => {
    setGuideError(null);

    if (!hasFixtures) {
      setGuide([]);
      setGuideLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setGuideLoading(true);

      try {
        const date = getToday(timeZone);

        /*
         * Pas de force-cache.
         *
         * Ce guide sert à déterminer ce qui passe
         * actuellement sur la chaîne regardée.
         */
        const response = await fetch(
          `/api/football/bein-guide?date=${encodeURIComponent(
            date
          )}&_=${Date.now()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        const data = await readJson<BeinGuideResponse>(
          response
        );

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Guide beIN indisponible"
          );
        }

        if (!controller.signal.aborted) {
          setGuide(data.programmes ?? []);
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          (error as Error).name !== "AbortError"
        ) {
          setGuideError(
            error instanceof Error
              ? error.message
              : "Guide beIN indisponible"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setGuideLoading(false);
        }
      }
    }, GUIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [hasFixtures, timeZone, router]);

  /* =======================================================
     ALL KNOWN XTREAM CHANNELS
     ======================================================= */

  const allKnownChannels = useMemo(() => {
    const map = new Map<number, Channel>();

    for (const item of readAllCachedChannels()) {
      map.set(
        Number(item.stream_id),
        item
      );
    }

    for (const item of channels) {
      map.set(
        Number(item.stream_id),
        item
      );
    }

    /*
     * La chaîne actuellement regardée doit toujours
     * faire partie des chaînes connues du resolver.
     */
    if (selectedChannel) {
      map.set(
        Number(selectedChannel.stream_id),
        selectedChannel
      );
    }

    return [...map.values()];
  }, [
    channels,
    selectedChannel,
    selectedCategory?.category_id,
  ]);

  /* =======================================================
     GUIDE ACTIF POUR LE HOST
     ======================================================= */

  const hostGuide = useMemo(() => {
    return selectGuideForHost(
      guide,
      selectedChannel,
      selectedCategory
    );
  }, [
    guide,
    selectedChannel,
    selectedCategory,
  ]);

  /* =======================================================
     FIXTURE → BROADCASTS
     ======================================================= */

  const fixtureBroadcasts = useMemo(() => {
    const result: Record<
      string,
      FixtureBroadcast[]
    > = {};

    if (!hostGuide.length) {
      return result;
    }

    const categoryName =
      selectedCategory?.category_name || "";

    for (const fixture of fixtures) {
      /*
       * Cherche uniquement dans la bonne région.
       *
       * Exemple :
       *
       * MENA :
       * Burundi - Algérie -> beIN 2
       *
       * Une éventuelle grille France qui placerait le
       * match sur beIN 4 ne peut plus contaminer le résultat.
       */
      const matchedProgrammes = hostGuide
        .map((programme) => ({
          programme,

          score: programmeMatchScore(
            programme,
            fixture
          ),
        }))

        /*
         * Matching strict des deux équipes.
         */
        .filter((item) => item.score >= 100)

        /*
         * Programme actuellement diffusé d'abord.
         */
        .sort((a, b) => {
          const priorityDelta =
            programmePriority(b.programme) -
            programmePriority(a.programme);

          if (priorityDelta) {
            return priorityDelta;
          }

          return b.score - a.score;
        });

      /*
       * Plusieurs sources XMLTV MENA peuvent contenir
       * exactement la même diffusion.
       *
       * On déduplique avant de l'envoyer à FootballPanels.
       */
      const seen = new Set<string>();

      const broadcasts: FixtureBroadcast[] = [];

      for (const item of matchedProgrammes) {
        const programme = item.programme;

        const key = [
          programme.region,
          programme.channel
            .toLowerCase()
            .trim(),
          programme.title
            .toLowerCase()
            .trim(),
          programme.start || "",
        ].join("|");

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        const matchedChannels =
          findXtreamChannelsForProgramme(
            programme,
            allKnownChannels,
            categoryName
          );

        /*
         * Aucun canal du host ne correspond :
         * inutile d'afficher cette diffusion.
         */
        if (!matchedChannels.length) {
          continue;
        }

        broadcasts.push({
          programme,
          channels: matchedChannels,
        });

        /*
         * Même limite que l'ancienne version.
         */
        if (broadcasts.length >= 8) {
          break;
        }
      }

      result[fixture.id] = broadcasts;
    }

    return result;
  }, [
    hostGuide,
    fixtures,
    allKnownChannels,
    selectedCategory?.category_name,
  ]);

  /* =======================================================
     CURRENT CHANNEL → CURRENT MATCH
     ======================================================= */

  const currentMatch =
    useMemo<CurrentFootballMatch | null>(() => {
      if (
        !selectedChannel ||
        !hostGuide.length ||
        !fixtures.length
      ) {
        return null;
      }

      const streamId = Number(
        selectedChannel.stream_id
      );

      const categoryName =
        selectedCategory?.category_name || "";

      /* ===================================================
         1 — PROGRAMMES DE LA CHAÎNE ACTUELLE
         =================================================== */

      const channelProgrammes = hostGuide
        .map((programme) => {
          const matchedChannels =
            findXtreamChannelsForProgramme(
              programme,
              allKnownChannels,
              categoryName
            );

          const matchesCurrentChannel =
            matchedChannels.some(
              (channel) =>
                Number(channel.stream_id) ===
                streamId
            );

          if (!matchesCurrentChannel) {
            return null;
          }

          return {
            programme,

            active:
              programmeIsActiveNow(
                programme
              ),
          };
        })

        .filter(
          (
            item
          ): item is {
            programme: BeinProgramme;
            active: boolean;
          } => item !== null
        );

      if (!channelProgrammes.length) {
        return null;
      }

      /* ===================================================
         2 — PROGRAMME ↔ FIXTURE
         =================================================== */

      const candidates: Array<{
        fixture: FootballFixture;
        programme: BeinProgramme;
        score: number;
        activeProgramme: boolean;
      }> = [];

      for (const fixture of fixtures) {
        for (const item of channelProgrammes) {
          const score =
            programmeMatchScore(
              item.programme,
              fixture
            );

          /*
           * On reste strict.
           *
           * Une simple chaîne beIN + un match live
           * ne suffit jamais.
           *
           * Il faut réellement reconnaître
           * les deux équipes.
           */
          if (score < 100) {
            continue;
          }

          candidates.push({
            fixture,
            programme: item.programme,
            score,
            activeProgramme:
              item.active,
          });
        }
      }

      if (!candidates.length) {
        return null;
      }

      /* ===================================================
         3 — RANKING
         =================================================== */

      candidates.sort((a, b) => {
        /*
         * Programme réellement en cours.
         */
        const activeDelta =
          Number(b.activeProgramme) -
          Number(a.activeProgramme);

        if (activeDelta) {
          return activeDelta;
        }

        /*
         * Match réellement LIVE.
         */
        const liveDelta =
          Number(
            Boolean(
              b.fixture.status.live
            )
          ) -
          Number(
            Boolean(
              a.fixture.status.live
            )
          );

        if (liveDelta) {
          return liveDelta;
        }

        /*
         * Meilleur matching des équipes.
         */
        const scoreDelta =
          b.score - a.score;

        if (scoreDelta) {
          return scoreDelta;
        }

        /*
         * Horaire le plus proche.
         */
        return (
          fixtureTimeDistance(
            a.fixture
          ) -
          fixtureTimeDistance(
            b.fixture
          )
        );
      });

      const best = candidates[0];

      /*
       * Garde-fou :
       *
       * ni programme actif
       * ni fixture live
       *
       * => on ne prétend pas que le match
       * est actuellement diffusé.
       */
      /*
 * LIVE :
 * on remonte immédiatement le match.
 *
 * À VENIR :
 * on accepte également le match si le matching
 * programme ↔ fixture ↔ chaîne est confirmé.
 *
 * Le matching score >= 100 effectué plus haut
 * évite d'afficher un match arbitraire.
 */

const startTime =
  new Date(
    best.fixture.startingAt
  ).getTime();

const now =
  Date.now();

const isUpcoming =
  Number.isFinite(startTime) &&
  startTime > now;

if (
  !best.activeProgramme &&
  !best.fixture.status.live &&
  !isUpcoming
) {
  return null;
}

      return {
        fixture: best.fixture,

        programmeTitle:
          best.programme.title || null,
      };
    }, [
      selectedChannel,
      selectedCategory?.category_name,
      hostGuide,
      fixtures,
      allKnownChannels,
    ]);

  /* =======================================================
     SEND CURRENT MATCH TO PAGE
     ======================================================= */

  useEffect(() => {
    onCurrentMatchChange?.(
      currentMatch
    );
  }, [
    currentMatch,
    onCurrentMatchChange,
  ]);

  /* =======================================================
     VERTICAL DRAG
     ======================================================= */

  useEffect(() => {
    const cleanup =
      attachVerticalDrag(
        matchRef
      );

    return () => cleanup?.();
  }, [
    selectedFixtureId,
    fixturesLoading,
    competitionFilter,
  ]);

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="live-sports-grid">
      <FootballPanels
        fixtures={fixtures}
        filteredFixtures={
          filteredFixtures
        }
        fixturesLoading={
          fixturesLoading
        }
        fixturesError={
          fixturesError
        }
        selectedFixtureId={
          selectedFixtureId
        }
        competitionItems={
          competitionItems
        }
        competitionFilter={
          competitionFilter
        }
        timeZone={timeZone}
        guideLoading={
          guideLoading
        }
        guideError={
          guideError
        }
        guideLength={
          guide.length
        }
        fixtureBroadcasts={
          fixtureBroadcasts
        }
        matchRef={matchRef}
        onCompetitionFilter={
          setCompetitionFilter
        }
        onSelectFixture={
          setSelectedFixtureId
        }
        onLaunchChannel={
          onLaunchChannel
        }
      />
    </div>
  );
}