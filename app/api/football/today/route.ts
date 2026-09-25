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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type SourceResponse = {
  success: boolean;
  fixtures?: FootballFixture[];
};

async function readSource(
  url: string
): Promise<FootballFixture[]> {
  try {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      (
        await response.json()
      ) as SourceResponse;

    return Array.isArray(
      data.fixtures
    )
      ? data.fixtures
      : [];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest
) {
  const url =
    new URL(
      request.url
    );

  const date =
    safeDate(
      url.searchParams.get(
        "date"
      )
    );

  const timeZone =
    safeTimeZone(
      url.searchParams.get(
        "timezone"
      )
    );

  const cacheKey =
    `football:today:${date}`;

  const cached =
    readCache<FootballFixture[]>(
      cacheKey
    );

  if (cached) {
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

    /*
     * Si doublon,
     * SportSRC gagne sur
     * ESPN pour l'Afrique.
     */
    const existing =
      map.get(key);

    if (!existing) {
      map.set(
        key,
        fixture
      );

      continue;
    }

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
    [...map.values()].sort(
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
   * Agrégateur :
   * 5 minutes.
   *
   * ESPN garde son cache
   * 10 min.
   * SportSRC garde son
   * cache 15 min.
   */
  writeCache(
    cacheKey,
    fixtures,
    5 * 60 * 1000
  );

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