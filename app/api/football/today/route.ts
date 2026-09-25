import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  type FootballFixture,
  fixtureKey,
  readCache,
  safeDate,
  safeTimeZone,
  writeCache,
} from "../_shared";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

type SourceResponse = {
  success: boolean;
  fixtures?: FootballFixture[];
};

async function readSource(
  url: string
): Promise<FootballFixture[]> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "[football/today] source HTTP error",
        response.status,
        url
      );

      return [];
    }

    const data =
      (await response.json()) as SourceResponse;

    return Array.isArray(
      data.fixtures
    )
      ? data.fixtures
      : [];
  } catch (error) {
    console.error(
      "[football/today] source fetch error",
      url,
      error
    );

    return [];
  }
}

export async function GET(
  request: NextRequest
) {
  const url =
    new URL(request.url);

  const date =
    safeDate(
      url.searchParams.get("date")
    );

  const timeZone =
    safeTimeZone(
      url.searchParams.get(
        "timezone"
      )
    );

  /*
   * IMPORTANT :
   * timezone dans la clé.
   *
   * Sinon Istanbul, Paris,
   * New York, etc. pourraient
   * partager le même cache.
   */
  const cacheKey =
    `football:today:${date}:${timeZone}`;

  const cached =
    readCache<FootballFixture[]>(
      cacheKey
    );

  /*
   * IMPORTANT :
   * [] est truthy en JavaScript.
   *
   * Donc on ne retourne le cache
   * QUE s'il contient réellement
   * des matchs.
   */
  if (
    Array.isArray(cached) &&
    cached.length > 0
  ) {
    return NextResponse.json({
      success: true,
      cached: true,

      date,

      timezone:
        timeZone,

      count:
        cached.length,

      fixtures:
        cached,
    });
  }

  const origin =
    url.origin;

  const query =
    new URLSearchParams({
      date,

      timezone:
        timeZone,
    });

  /*
   * Europe + Afrique
   * en parallèle.
   */
  const [
    europe,
    africa,
  ] =
    await Promise.all([
      readSource(
        `${origin}/api/football/europe?${query.toString()}`
      ),

      readSource(
        `${origin}/api/football/africa?${query.toString()}`
      ),
    ]);

  /*
   * Fusion + déduplication.
   */
  const map =
    new Map<
      string,
      FootballFixture
    >();

  for (
    const fixture of [
      ...europe,
      ...africa,
    ]
  ) {
    const key =
      fixtureKey(
        fixture
      );

    const existing =
      map.get(key);

    if (!existing) {
      map.set(
        key,
        fixture
      );

      continue;
    }

    /*
     * En cas de doublon,
     * SportSRC gagne pour
     * les matchs africains.
     */
    if (
      fixture.provider ===
        "sportsrc" &&
      existing.provider !==
        "sportsrc"
    ) {
      map.set(
        key,
        fixture
      );
    }
  }

  const fixtures =
    [...map.values()]
      .filter(
        (
          fixture
        ): fixture is FootballFixture =>
          !!fixture &&
          typeof fixture.startingAt ===
            "string"
      )
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            a.startingAt
          ).getTime() -
          new Date(
            b.startingAt
          ).getTime()
      );

  /*
   * IMPORTANT :
   *
   * On ne cache PAS
   * un résultat vide.
   *
   * Sinon une erreur temporaire
   * ESPN/SportSRC provoque
   * "Aucun match" pendant
   * plusieurs minutes.
   */
  if (
    fixtures.length > 0
  ) {
    writeCache(
      cacheKey,
      fixtures,
      5 * 60 * 1000
    );
  }

  return NextResponse.json({
    success: true,

    cached: false,

    date,

    timezone:
      timeZone,

    sources: {
      espn:
        europe.length,

      sportsrc:
        africa.length,
    },

    count:
      fixtures.length,

    fixtures,
  });
}
